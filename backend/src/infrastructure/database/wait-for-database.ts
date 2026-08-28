import mariadb from "mariadb";
import { getEnv } from "../../config/env.js";

const RETRY_DELAY_MS = 1_000;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function waitForDatabase(timeoutMs = 60_000): Promise<void> {
  const env = getEnv();
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    let connection: Awaited<ReturnType<typeof mariadb.createConnection>> | undefined;
    try {
      connection = await mariadb.createConnection({
        host: env.DATABASE_HOST,
        port: env.DATABASE_PORT,
        user: env.DATABASE_USER,
        password: env.DATABASE_PASSWORD,
        database: env.DATABASE_NAME,
        connectTimeout: 3_000,
        ...(env.NODE_ENV === "production"
          ? { ssl: { rejectUnauthorized: true } }
          : { allowPublicKeyRetrieval: true })
      });
      await connection.query("SELECT 1");
      return;
    } catch (error) {
      lastError = error;
      await delay(RETRY_DELAY_MS);
    } finally {
      await connection?.end();
    }
  }

  throw new Error(`MySQL did not become ready within ${timeoutMs}ms`, {
    cause: lastError
  });
}
