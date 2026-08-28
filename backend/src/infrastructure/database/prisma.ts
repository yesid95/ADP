import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client.js";
import { getEnv } from "../../config/env.js";

function createPrismaClient() {
  const env = getEnv();
  const adapter = new PrismaMariaDb({
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    connectionLimit: env.DATABASE_CONNECTION_LIMIT,
    connectTimeout: 5_000,
    acquireTimeout: 10_000,
    idleTimeout: 60,
    ...(env.NODE_ENV === "production"
      ? { ssl: { rejectUnauthorized: true } }
      : {})
  });

  return new PrismaClient({ adapter });
}

export type DatabaseClient = ReturnType<typeof createPrismaClient>;

let client: DatabaseClient | undefined;

export function getPrisma(): DatabaseClient {
  if (!client) {
    client = createPrismaClient();
  }
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (!client) {
    return;
  }
  await client.$disconnect();
  client = undefined;
}
