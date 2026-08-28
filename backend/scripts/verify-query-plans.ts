import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";
import mariadb from "mariadb";

interface ExplainRow {
  table: string;
  type: string;
  possible_keys: string | null;
  key: string | null;
  rows: number | string;
  Extra: string;
}

interface ExpectedAccess {
  table: string;
  indexes: string[];
}

interface PlanDefinition {
  name: string;
  sql: string;
  expected: ExpectedAccess[];
}

const plans: PlanDefinition[] = [
  {
    name: "open listings by crop, municipality and date",
    sql: `SELECT hl.id
      FROM farms f JOIN harvest_listings hl ON hl.farm_id = f.id
      WHERE f.municipality_id = (SELECT MIN(id) FROM municipalities)
        AND f.status = 'ACTIVE'
        AND hl.crop_variety_id = (SELECT MIN(id) FROM crop_varieties)
        AND hl.status = 'OPEN'
        AND hl.available_from_date >= CURRENT_DATE
      ORDER BY hl.available_from_date, hl.id LIMIT 100`,
    expected: [
      { table: "f", indexes: ["farms_municipality_status_idx"] },
      { table: "hl", indexes: ["harvest_listings_search_idx", "harvest_listings_farm_created_idx"] }
    ]
  },
  {
    name: "listings owned by a farm",
    sql: `SELECT id FROM harvest_listings
      WHERE farm_id = (SELECT MIN(id) FROM farms)
      ORDER BY created_at DESC, id DESC LIMIT 100`,
    expected: [{ table: "harvest_listings", indexes: ["harvest_listings_farm_created_idx"] }]
  },
  {
    name: "active bids for a listing",
    sql: `SELECT id FROM bids
      WHERE listing_id = (SELECT MIN(id) FROM harvest_listings) AND status = 'SUBMITTED'
      ORDER BY submitted_at DESC LIMIT 100`,
    expected: [{ table: "bids", indexes: ["bids_listing_status_idx"] }]
  },
  {
    name: "bids owned by a buyer",
    sql: `SELECT id FROM bids
      WHERE buyer_user_id = (SELECT MIN(buyer_user_id) FROM bids) AND status = 'SUBMITTED'
      ORDER BY submitted_at DESC LIMIT 100`,
    expected: [{ table: "bids", indexes: ["bids_buyer_status_idx"] }]
  },
  {
    name: "current bid version",
    sql: `SELECT * FROM bid_versions
      WHERE bid_id = (SELECT MIN(id) FROM bids)
      ORDER BY version_no DESC LIMIT 1`,
    expected: [{ table: "bid_versions", indexes: ["PRIMARY"] }]
  },
  {
    name: "listing status timeline",
    sql: `SELECT * FROM listing_status_events
      WHERE listing_id = (SELECT MIN(id) FROM harvest_listings)
      ORDER BY created_at, id LIMIT 100`,
    expected: [{ table: "listing_status_events", indexes: ["listing_status_events_timeline_idx"] }]
  },
  {
    name: "active sessions for a user",
    sql: `SELECT id FROM auth_sessions
      WHERE user_id = (SELECT MIN(id) FROM users) AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP(3)
      ORDER BY expires_at LIMIT 100`,
    expected: [{ table: "auth_sessions", indexes: ["auth_sessions_user_active_idx"] }]
  },
  {
    name: "audit events by entity and period",
    sql: `SELECT id FROM audit_events
      WHERE entity_type = 'HARVEST_LISTING'
        AND entity_id = (SELECT MIN(entity_id) FROM audit_events WHERE entity_type = 'HARVEST_LISTING')
        AND occurred_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY
      ORDER BY occurred_at DESC LIMIT 100`,
    expected: [{ table: "audit_events", indexes: ["audit_events_entity_idx"] }]
  }
];

function required(parsed: Record<string, string> | undefined, key: string): string {
  const value = parsed?.[key];
  if (!value) throw new Error(`${key} is required in .env.docker`);
  return value;
}

function indexes(row: ExplainRow): string[] {
  return [row.key, ...(row.possible_keys?.split(",") ?? [])].filter(
    (value): value is string => Boolean(value)
  );
}

async function main(): Promise<void> {
  const parsed = config({ path: ".env.docker" }).parsed;
  const connection = await mariadb.createConnection({
    host: "127.0.0.1",
    port: 3306,
    user: "adp_backup",
    password: required(parsed, "MYSQL_BACKUP_PASSWORD"),
    database: "adp",
    connectTimeout: 5_000
  });
  try {
    const results = [];
    for (const plan of plans) {
      const rows = await connection.query(`EXPLAIN ${plan.sql}`) as ExplainRow[];
      const missing = plan.expected.filter((expectation) => {
        const row = rows.find((candidate) => candidate.table === expectation.table);
        return !row || !expectation.indexes.some((index) => indexes(row).includes(index));
      });
      const scanRisks = rows.filter(
        (row) => row.type === "ALL" && Number(row.rows) > 1_000
      ).map((row) => ({ table: row.table, estimatedRows: Number(row.rows) }));
      const analyzed = await connection.query(`EXPLAIN ANALYZE ${plan.sql}`) as Array<Record<string, string>>;
      results.push({
        name: plan.name,
        passed: missing.length === 0 && scanRisks.length === 0,
        expected: plan.expected,
        missing,
        scanRisks,
        explain: rows.map((row) => ({
          table: row.table,
          accessType: row.type,
          selectedKey: row.key,
          possibleKeys: row.possible_keys,
          estimatedRows: Number(row.rows),
          extra: row.Extra
        })),
        analyze: analyzed.map((row) => Object.values(row).join(" ")).join("\n")
      });
    }
    const statusRows = await connection.query(
      "SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected','Threads_running','Connections','Aborted_connects','Slow_queries','Uptime')"
    ) as Array<{ Variable_name: string; Value: string }>;
    const sizeRows = await connection.query(
      "SELECT COALESCE(SUM(data_length),0) data_bytes, COALESCE(SUM(index_length),0) index_bytes, COUNT(*) objects FROM information_schema.tables WHERE table_schema='adp'"
    ) as Array<{ data_bytes: bigint; index_bytes: bigint; objects: bigint }>;
    const passed = results.every((result) => result.passed);
    const report = {
      completedAt: new Date().toISOString(),
      mysqlVersion: String((await connection.query("SELECT VERSION() version") as Array<{ version: string }>)[0]?.version),
      passed,
      plans: results,
      status: Object.fromEntries(statusRows.map((row) => [row.Variable_name, Number(row.Value)])),
      storage: {
        dataBytes: Number(sizeRows[0]?.data_bytes ?? 0),
        indexBytes: Number(sizeRows[0]?.index_bytes ?? 0),
        objects: Number(sizeRows[0]?.objects ?? 0)
      }
    };
    const directory = resolve("var", "operations");
    await mkdir(directory, { recursive: true });
    const file = resolve(directory, `${new Date().toISOString().replace(/[:.]/g, "-")}-query-plans.json`);
    await writeFile(file, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    if (!passed) process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

await main();
