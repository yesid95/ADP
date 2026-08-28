import { Prisma } from "../generated/prisma/client.js";
import { getMarketPrisma } from "../infrastructure/database/prisma.js";

const MAX_ATTEMPTS = 3;

interface DriverConflictCause {
  kind?: unknown;
  originalCode?: unknown;
}

export function isRetryableTransactionError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code === "P2034") {
    return true;
  }
  if (error.code !== "P2010") {
    return false;
  }

  const adapterError = error.meta?.driverAdapterError as
    | { cause?: DriverConflictCause }
    | undefined;
  const cause = adapterError?.cause;
  return (
    cause?.kind === "TransactionWriteConflict" ||
    cause?.originalCode === "1213" ||
    cause?.originalCode === "1205"
  );
}

export async function inSerializableTransaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const prisma = getMarketPrisma();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000
      });
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === MAX_ATTEMPTS) {
        throw error;
      }
      const delayMs = 10 * 2 ** (attempt - 1) + Math.floor(Math.random() * 20);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Serializable transaction retry loop ended unexpectedly");
}
