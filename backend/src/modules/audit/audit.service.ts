import type { Prisma } from "../../generated/prisma/client.js";
import type { AuditOutcome } from "../../generated/prisma/enums.js";
import { getEnv } from "../../config/env.js";
import { canonicalJson, hmacSha256 } from "../../shared/crypto.js";
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

export async function writeAudit(
  transaction: Prisma.TransactionClient,
  input: AuditInput
): Promise<void> {
  const occurredAt = new Date();
  const hashPayload = canonicalJson({
    occurredAt: occurredAt.toISOString(),
    actorUserId: input.actorUserId ?? null,
    actionCode: input.actionCode,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    outcome: input.outcome,
    requestId: input.requestId,
    metadata: input.metadata ?? null
  });
  const eventHash = hmacSha256(hashPayload, getEnv().AUDIT_HMAC_KEY_BASE64);

  await transaction.auditEvent.create({
    data: {
      occurredAt,
      actionCode: input.actionCode,
      entityType: input.entityType,
      outcome: input.outcome,
      requestId: input.requestId,
      eventHash,
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.ipHash ? { ipHash: input.ipHash } : {}),
      ...(input.metadata
        ? { metadata: input.metadata as Prisma.InputJsonValue }
        : {})
    }
  });
}
