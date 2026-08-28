import type { Prisma } from "../../generated/prisma/client.js";
import type { AuditOutcome } from "../../generated/prisma/enums.js";
import { getEnv } from "../../config/env.js";
import {
  canonicalJson,
  databaseBytesEqual,
  hmacSha256
} from "../../shared/crypto.js";
import type { DatabaseBytes } from "../../shared/crypto.js";

export interface AuditInput {
  actorUserId?: string | undefined;
  actionCode: string;
  entityType: string;
  entityId?: string | undefined;
  outcome: AuditOutcome;
  requestId: string;
  ipHash?: DatabaseBytes | undefined;
  metadata?: Record<string, string | number | boolean | null> | undefined;
}

export function computeAuditEventHash(
  input: AuditInput,
  occurredAt: Date,
  previousHash: Uint8Array | null
): DatabaseBytes {
  const hashPayload = canonicalJson({
    occurredAt: occurredAt.toISOString(),
    actorUserId: input.actorUserId ?? null,
    actionCode: input.actionCode,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    outcome: input.outcome,
    requestId: input.requestId,
    metadata: input.metadata ?? null,
    previousHash: previousHash ? Buffer.from(previousHash).toString("hex") : null
  });
  return hmacSha256(hashPayload, getEnv().AUDIT_HMAC_KEY_BASE64);
}

export function verifyAuditEventHash(
  input: AuditInput,
  occurredAt: Date,
  previousHash: Uint8Array | null,
  eventHash: Uint8Array
): boolean {
  return databaseBytesEqual(
    computeAuditEventHash(input, occurredAt, previousHash),
    eventHash
  );
}

export async function writeAudit(
  transaction: Prisma.TransactionClient,
  input: AuditInput
): Promise<void> {
  const occurredAt = new Date();
  await transaction.$executeRawUnsafe("CALL lock_audit_chain_head(@adp_audit_head)");
  const heads = await transaction.$queryRawUnsafe<Array<{ current_hash: Uint8Array | null }>>(
    "SELECT @adp_audit_head AS current_hash"
  );
  const head = heads[0];
  if (!head) {
    throw new Error("Audit chain head is missing");
  }
  const previousHash: DatabaseBytes | null = head.current_hash
    ? Uint8Array.from(head.current_hash)
    : null;
  const eventHash = computeAuditEventHash(input, occurredAt, previousHash);

  await transaction.$executeRaw`
    INSERT INTO audit_events (
      occurred_at,
      actor_user_id,
      action_code,
      entity_type,
      entity_id,
      outcome,
      request_id,
      ip_hash,
      metadata,
      previous_hash,
      event_hash
    ) VALUES (
      ${occurredAt},
      ${input.actorUserId ?? null},
      ${input.actionCode},
      ${input.entityType},
      ${input.entityId ?? null},
      ${input.outcome},
      ${input.requestId},
      ${input.ipHash ?? null},
      ${input.metadata ? JSON.stringify(input.metadata) : null},
      ${previousHash},
      ${eventHash}
    )
  `;
}
