import { Prisma } from "../generated/prisma/client.js";
import { getPrisma } from "../infrastructure/database/prisma.js";

const MAX_ATTEMPTS = 3;

function isRetryableTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

export async function inSerializableTransaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const prisma = getPrisma();

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
