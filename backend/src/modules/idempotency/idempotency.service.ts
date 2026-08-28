import type { Prisma } from "../../generated/prisma/client.js";
import type { IncomingHttpHeaders } from "node:http";
import {
  canonicalJson,
  databaseBytesEqual,
  sha256,
  type DatabaseBytes
} from "../../shared/crypto.js";
import { AppError } from "../../shared/errors.js";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1_000;

export interface IdempotencyContext {
  userId: string;
  operationCode: string;
  key: string;
  requestBody: unknown;
}

interface PreparedIdempotency {
  userId: string;
  operationCode: string;
  keyHash: DatabaseBytes;
  requestHash: DatabaseBytes;
}

function prepare(input: IdempotencyContext): PreparedIdempotency {
  return {
    userId: input.userId,
    operationCode: input.operationCode,
    keyHash: sha256(input.key),
    requestHash: sha256(canonicalJson(input.requestBody))
  };
}

export async function findIdempotentResource(
  transaction: Prisma.TransactionClient,
  input: IdempotencyContext
): Promise<string | null> {
  const prepared = prepare(input);
  const existing = await transaction.idempotencyRecord.findUnique({
    where: {
      userId_operationCode_idempotencyKeyHash: {
        userId: prepared.userId,
        operationCode: prepared.operationCode,
        idempotencyKeyHash: prepared.keyHash
      }
    },
    select: { requestHash: true, resourceId: true }
  });

  if (!existing) {
    return null;
  }
  if (!databaseBytesEqual(existing.requestHash, prepared.requestHash)) {
    throw new AppError(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "The idempotency key was already used with different content"
    );
  }
  if (!existing.resourceId) {
    throw new AppError(409, "IDEMPOTENCY_INCOMPLETE", "The previous operation is incomplete");
  }
  return existing.resourceId;
}

export async function saveIdempotentResource(
  transaction: Prisma.TransactionClient,
  input: IdempotencyContext,
  resourceType: string,
  resourceId: string,
  responseCode: number
): Promise<void> {
  const prepared = prepare(input);
  await transaction.idempotencyRecord.create({
    data: {
      userId: prepared.userId,
      operationCode: prepared.operationCode,
      idempotencyKeyHash: prepared.keyHash,
      requestHash: prepared.requestHash,
      resourceType,
      resourceId,
      responseCode,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS)
    }
  });
}

export function readIdempotencyKey(headers: IncomingHttpHeaders): string {
  const value = headers["idempotency-key"];
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{16,128}$/.test(value)) {
    throw new AppError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Key must contain 16 to 128 letters, numbers, underscores or hyphens"
    );
  }
  return value;
}
