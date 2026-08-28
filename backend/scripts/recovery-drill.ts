import "dotenv/config";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto";
import {
  appendFile,
  mkdir,
  open,
  stat,
  writeFile
} from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";

const MAGIC = Buffer.from("ADPBKP01");
const IV_BYTES = 12;
const TAG_BYTES = 16;
const outputDirectory = resolve("var", "recovery");
const composePrefix = ["compose", "--env-file", ".env.docker"];

function requiredEncryptionKey(): Buffer {
  const value = process.env.BACKUP_ENCRYPTION_KEY_BASE64;
  if (!value) throw new Error("BACKUP_ENCRYPTION_KEY_BASE64 is required");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY_BASE64 must decode to 32 bytes");
  return key;
}

function child(command: string, args: string[]): ChildProcessWithoutNullStreams {
  return spawn(command, args, { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
}

function completion(process: ChildProcessWithoutNullStreams): Promise<void> {
  let stderr = "";
  process.stderr.setEncoding("utf8");
  process.stderr.on("data", (chunk: string) => { stderr += chunk; });
  return new Promise((resolvePromise, reject) => {
    process.once("error", reject);
    process.once("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(stderr.trim() || `Process exited with code ${String(code)}`));
    });
  });
}

async function runText(command: string, args: string[], input?: string): Promise<string> {
  const process = child(command, args);
  const done = completion(process);
  let stdout = "";
  process.stdout.setEncoding("utf8");
  process.stdout.on("data", (chunk: string) => { stdout += chunk; });
  process.stdin.end(input);
  await done;
  return stdout.trim();
}

function sourceExec(...args: string[]): string[] {
  return [...composePrefix, "exec", "-T", "mysql", ...args];
}

async function sourceSql(sql: string, account: "backup" | "migrator"): Promise<string> {
  const envName = account === "backup" ? "MYSQL_BACKUP_PASSWORD" : "MYSQL_MIGRATOR_PASSWORD";
  const user = account === "backup" ? "adp_backup" : "adp_migrator";
  return runText("docker", sourceExec(
    "sh", "-c", `MYSQL_PWD=\"$${envName}\" exec mysql -u${user} -N -B --binary-mode adp`
  ), sql);
}

async function containerSql(container: string, sql: string): Promise<string> {
  return runText("docker", [
    "exec", "-i", container, "sh", "-c",
    "MYSQL_PWD=\"$MYSQL_ROOT_PASSWORD\" exec mysql -uroot -N -B --binary-mode adp"
  ], sql);
}

async function sha256(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

async function encryptCommand(
  args: string[],
  destination: string,
  key: Buffer,
  inspect?: (text: string) => void
): Promise<void> {
  const process = child("docker", args);
  const done = completion(process);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const output = createWriteStream(destination, { flags: "wx" });
  output.write(MAGIC);
  output.write(iv);
  let inspected = "";
  const tap = new Transform({
    transform(chunk, _encoding, callback) {
      if (inspect && inspected.length < 2_000_000) inspected += chunk.toString("utf8");
      callback(null, chunk);
    }
  });
  process.stdin.end();
  await Promise.all([pipeline(process.stdout, tap, createGzip(), cipher, output), done]);
  await appendFile(destination, cipher.getAuthTag());
  inspect?.(inspected);
}

async function decryptInto(
  source: string,
  key: Buffer,
  destination: ChildProcessWithoutNullStreams
): Promise<void> {
  const metadata = await stat(source);
  const handle = await open(source, "r");
  const header = Buffer.alloc(MAGIC.length + IV_BYTES);
  const tag = Buffer.alloc(TAG_BYTES);
  await handle.read(header, 0, header.length, 0);
  await handle.read(tag, 0, TAG_BYTES, metadata.size - TAG_BYTES);
  await handle.close();
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Invalid backup header");
  const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(MAGIC.length));
  decipher.setAuthTag(tag);
  const done = completion(destination);
  await Promise.all([
    pipeline(
      createReadStream(source, { start: header.length, end: metadata.size - TAG_BYTES - 1 }),
      decipher,
      createGunzip(),
      destination.stdin
    ),
    done
  ]);
}

async function waitForMysql(container: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await runText("docker", [
        "exec", container, "sh", "-c",
        "MYSQL_PWD=\"$MYSQL_ROOT_PASSWORD\" mysql -uroot -N -B -e 'SELECT 1'"
      ]);
      return;
    } catch {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
    }
  }
  throw new Error("Restored MySQL did not become ready in 60 seconds");
}

async function tableCounts(query: (sql: string) => Promise<string>): Promise<Record<string, number>> {
  const tableOutput = await query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='adp' AND table_type='BASE TABLE' ORDER BY table_name;"
  );
  const result: Record<string, number> = {};
  for (const table of tableOutput.split(/\r?\n/).filter(Boolean)) {
    if (!/^[a-z0-9_]+$/i.test(table)) throw new Error(`Unsafe table name: ${table}`);
    result[table] = Number(await query(`SELECT COUNT(*) FROM \`${table}\`;`));
  }
  return result;
}

async function main(): Promise<void> {
  const key = requiredEncryptionKey();
  await mkdir(outputDirectory, { recursive: true });
  await runText("docker", [
    ...composePrefix, "--profile", "operations", "build", "mysql-tools"
  ]);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpFile = resolve(outputDirectory, `${stamp}-full.sql.gz.enc`);
  const binlogFile = resolve(outputDirectory, `${stamp}-binlog.sql.gz.enc`);
  const reportFile = resolve(outputDirectory, `${stamp}-report.json`);
  const restoreContainer = `adp-restore-${process.pid}-${randomBytes(3).toString("hex")}`;
  const restorePassword = randomBytes(24).toString("base64url");
  const markerName = `PITR_${randomBytes(8).toString("hex")}`;
  const markerId = 65_000;
  let markerInserted = false;
  let sourceFile = "";
  let sourcePosition = 0;

  const backupStarted = performance.now();
  await encryptCommand(sourceExec(
    "sh", "-c",
    "MYSQL_PWD=\"$MYSQL_BACKUP_PASSWORD\" exec mysqldump -uadp_backup --single-transaction --quick --routines --events --triggers --hex-blob --set-gtid-purged=OFF --source-data=2 --no-tablespaces --databases adp"
  ), dumpFile, key, (header) => {
    const match = header.match(/SOURCE_LOG_FILE='([^']+)', SOURCE_LOG_POS=(\d+)/);
    if (!match?.[1] || !match[2]) throw new Error("mysqldump did not expose a binlog coordinate");
    sourceFile = match[1];
    sourcePosition = Number(match[2]);
  });
  const backupSeconds = (performance.now() - backupStarted) / 1_000;

  try {
    const collision = Number(await sourceSql(
      `SELECT COUNT(*) FROM departments WHERE id=${markerId} OR dane_code='ZZ';`, "backup"
    ));
    if (collision !== 0) throw new Error("Reserved PITR marker id or code is already in use");
    await sourceSql(
      `INSERT INTO departments (id, dane_code, name) VALUES (${markerId}, 'ZZ', '${markerName}');`,
      "migrator"
    );
    markerInserted = true;
    const endStatus = (await sourceSql("SHOW BINARY LOG STATUS;", "backup")).split("\t");
    const endFile = endStatus[0] ?? "";
    const endPosition = Number(endStatus[1]);
    if (endFile !== sourceFile || !Number.isFinite(endPosition)) {
      throw new Error("Binary log rotated during drill; repeat with a multi-file archive window");
    }
    await encryptCommand([
      ...composePrefix, "--profile", "operations", "run", "--rm", "-T", "mysql-tools",
      "--skip-gtids", `--start-position=${sourcePosition}`,
      `--stop-position=${endPosition}`, `/var/lib/mysql/${sourceFile}`
    ], binlogFile, key);

    const restoreStarted = performance.now();
    await runText("docker", [
      "run", "-d", "--rm", "--name", restoreContainer, "--network", "none",
      "-e", `MYSQL_ROOT_PASSWORD=${restorePassword}`, "mysql:8.4",
      "--skip-log-bin", "--default-time-zone=+00:00",
      "--character-set-server=utf8mb4", "--collation-server=utf8mb4_0900_ai_ci"
    ]);
    await waitForMysql(restoreContainer);
    await decryptInto(dumpFile, key, child("docker", [
      "exec", "-i", restoreContainer, "sh", "-c",
      "MYSQL_PWD=\"$MYSQL_ROOT_PASSWORD\" exec mysql -uroot --binary-mode"
    ]));
    await decryptInto(binlogFile, key, child("docker", [
      "exec", "-i", restoreContainer, "sh", "-c",
      "MYSQL_PWD=\"$MYSQL_ROOT_PASSWORD\" exec mysql -uroot --binary-mode"
    ]));

    const sourceCounts = await tableCounts((sql) => sourceSql(sql, "backup"));
    const restoredCounts = await tableCounts((sql) => containerSql(restoreContainer, sql));
    if (JSON.stringify(sourceCounts) !== JSON.stringify(restoredCounts)) {
      throw new Error("Restored table counts do not match the source snapshot plus binlog");
    }
    const markerCount = Number(await containerSql(
      restoreContainer,
      `SELECT COUNT(*) FROM departments WHERE id=${markerId} AND name='${markerName}';`
    ));
    if (markerCount !== 1) throw new Error("PITR marker was not restored from the binary log");
    const objectCounts = (await containerSql(restoreContainer,
      "SELECT (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema='adp'), (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema='adp'), (SELECT COUNT(*) FROM information_schema.views WHERE table_schema='adp');"
    )).split("\t").map(Number);
    const rtoSeconds = (performance.now() - restoreStarted) / 1_000;
    const report = {
      completedAt: new Date().toISOString(),
      backup: {
        file: dumpFile,
        encryptedSha256: await sha256(dumpFile),
        bytes: (await stat(dumpFile)).size,
        seconds: Number(backupSeconds.toFixed(3))
      },
      pointInTime: {
        file: binlogFile,
        encryptedSha256: await sha256(binlogFile),
        sourceFile,
        sourcePosition,
        endPosition,
        markerRecovered: true,
        observedRpoSeconds: 0
      },
      restore: {
        isolatedNetwork: true,
        tableCount: Object.keys(restoredCounts).length,
        exactRowCountsMatched: true,
        triggers: objectCounts[0] ?? 0,
        routines: objectCounts[1] ?? 0,
        views: objectCounts[2] ?? 0,
        rtoSeconds: Number(rtoSeconds.toFixed(3))
      },
      objectives: { rpoSeconds: 900, rtoSeconds: 14_400, passed: rtoSeconds <= 14_400 }
    };
    await writeFile(reportFile, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } finally {
    if (markerInserted) {
      await sourceSql(`DELETE FROM departments WHERE id=${markerId} AND name='${markerName}';`, "migrator");
    }
    await runText("docker", ["rm", "-f", restoreContainer]).catch(() => undefined);
  }
}

await main();
