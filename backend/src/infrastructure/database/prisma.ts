import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client.js";
import { getEnv } from "../../config/env.js";

function createPrismaClient(user?: string, password?: string) {
  const env = getEnv();
  const adapter = new PrismaMariaDb({
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    user: user ?? env.DATABASE_USER,
    password: password ?? env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    connectionLimit: env.DATABASE_CONNECTION_LIMIT,
    connectTimeout: 5_000,
    acquireTimeout: 10_000,
    idleTimeout: 60,
    ...(env.NODE_ENV === "production"
      ? { ssl: { rejectUnauthorized: true } }
      : { allowPublicKeyRetrieval: true })
  });

  return new PrismaClient({ adapter });
}

export type DatabaseClient = ReturnType<typeof createPrismaClient>;

let client: DatabaseClient | undefined;
let authClient: DatabaseClient | undefined;
let marketClient: DatabaseClient | undefined;

export function getPrisma(): DatabaseClient {
  if (!client) {
    client = createPrismaClient();
  }
  return client;
}

export function getAuthPrisma(): DatabaseClient {
  if (!authClient) {
    const env = getEnv();
    authClient = createPrismaClient(
      env.AUTH_DATABASE_USER ?? env.DATABASE_USER,
      env.AUTH_DATABASE_PASSWORD ?? env.DATABASE_PASSWORD
    );
  }
  return authClient;
}

export function getMarketPrisma(): DatabaseClient {
  if (!marketClient) {
    const env = getEnv();
    marketClient = createPrismaClient(
      env.MARKET_DATABASE_USER ?? env.DATABASE_USER,
      env.MARKET_DATABASE_PASSWORD ?? env.DATABASE_PASSWORD
    );
  }
  return marketClient;
}

export async function disconnectPrisma(): Promise<void> {
  await Promise.all(
    [client, authClient, marketClient]
      .filter((entry): entry is DatabaseClient => Boolean(entry))
      .map((entry) => entry.$disconnect())
  );
  client = undefined;
  authClient = undefined;
  marketClient = undefined;
}
