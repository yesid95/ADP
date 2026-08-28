import { randomUUID } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import type { RoleCode } from "../../generated/prisma/enums.js";
import { getEnv } from "../../config/env.js";
import { getPrisma } from "../../infrastructure/database/prisma.js";
import {
  decryptField,
  encryptField,
  mfaSecretAad,
  randomToken,
  sha256
} from "../../shared/crypto.js";
import { AppError } from "../../shared/errors.js";
import { verifyPassword } from "../../shared/password.js";
import { signAccessToken } from "../../shared/tokens.js";
import { generateTotpSecret, verifyTotp } from "../../shared/totp.js";
import type { RequestContext } from "../../shared/request-context.js";
import { writeAudit } from "../audit/audit.service.js";

const MFA_KEY_VERSION = 1;
const RECOVERY_CODE_COUNT = 10;

function normalizeRecoveryCode(value: string): string {
  return value.trim().toUpperCase().replaceAll(/\s|-/g, "");
}

async function getCredentialOrThrow(userId: string, password: string): Promise<void> {
  const credential = await getPrisma().passwordCredential.findUnique({ where: { userId } });
  if (!credential || !(await verifyPassword(credential.passwordHash, password))) {
    throw new AppError(401, "CURRENT_PASSWORD_INVALID", "The current password is incorrect");
  }
}

export async function consumeMfaCode(
  transaction: Prisma.TransactionClient,
  userId: string,
  rawCode: string
): Promise<Date> {
  const factor = await transaction.mfaFactor.findFirst({
    where: { userId, enabledAt: { not: null }, revokedAt: null },
    orderBy: { createdAt: "desc" }
  });
  if (!factor) {
    throw new AppError(403, "MFA_NOT_ENROLLED", "An active MFA factor is required");
  }

  const code = rawCode.trim();
  if (/^\d{6}$/.test(code)) {
    const secret = decryptField(
      factor.secretCiphertext,
      getEnv().MFA_ENCRYPTION_KEY_BASE64,
      mfaSecretAad(factor.id, factor.keyVersion)
    );
    const step = verifyTotp(secret, code);
    if (step === undefined) {
      throw new AppError(401, "MFA_CODE_INVALID", "The MFA code is invalid");
    }
    const consumed = await transaction.mfaFactor.updateMany({
      where: {
        id: factor.id,
        revokedAt: null,
        OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }]
      },
      data: { lastUsedStep: step }
    });
    if (consumed.count !== 1) {
      throw new AppError(409, "MFA_CODE_REUSED", "The MFA code was already used");
    }
  } else {
    const recoveryCode = await transaction.mfaRecoveryCode.findUnique({
      where: { codeHash: sha256(normalizeRecoveryCode(code)) },
      include: { factor: { select: { userId: true, revokedAt: true, enabledAt: true } } }
    });
    if (
      !recoveryCode ||
      recoveryCode.factorId !== factor.id ||
      recoveryCode.factor.userId !== userId ||
      recoveryCode.factor.revokedAt ||
      !recoveryCode.factor.enabledAt ||
      recoveryCode.usedAt
    ) {
      throw new AppError(401, "MFA_CODE_INVALID", "The MFA code is invalid");
    }
    const consumed = await transaction.mfaRecoveryCode.updateMany({
      where: { id: recoveryCode.id, usedAt: null },
      data: { usedAt: new Date() }
    });
    if (consumed.count !== 1) {
      throw new AppError(409, "MFA_CODE_REUSED", "The recovery code was already used");
    }
  }
  return new Date();
}

export async function getOwnMfaStatus(userId: string): Promise<{
  enabled: boolean;
  enabledAt: Date | null;
  remainingRecoveryCodes: number;
}> {
  const factor = await getPrisma().mfaFactor.findFirst({
    where: { userId, enabledAt: { not: null }, revokedAt: null },
    orderBy: { createdAt: "desc" },
    include: { recoveryCodes: { where: { usedAt: null }, select: { id: true } } }
  });
  return {
    enabled: Boolean(factor),
    enabledAt: factor?.enabledAt ?? null,
    remainingRecoveryCodes: factor?.recoveryCodes.length ?? 0
  };
}

export async function enrollTotp(
  userId: string,
  password: string,
  context: RequestContext
): Promise<{ factorId: string; secret: string; otpauthUri: string }> {
  await getCredentialOrThrow(userId, password);
  const prisma = getPrisma();
  const factorId = randomUUID();
  const secret = generateTotpSecret();

  await prisma.$transaction(async (transaction) => {
    const active = await transaction.mfaFactor.findFirst({
      where: { userId, enabledAt: { not: null }, revokedAt: null },
      select: { id: true }
    });
    if (active) {
      throw new AppError(409, "MFA_ALREADY_ENABLED", "MFA is already enabled");
    }
    await transaction.mfaFactor.updateMany({
      where: { userId, enabledAt: null, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    await transaction.mfaFactor.create({
      data: {
        id: factorId,
        userId,
        factorType: "TOTP",
        secretCiphertext: encryptField(
          secret,
          getEnv().MFA_ENCRYPTION_KEY_BASE64,
          mfaSecretAad(factorId, MFA_KEY_VERSION)
        ),
        keyVersion: MFA_KEY_VERSION,
        enabledAt: null
      }
    });
    await writeAudit(transaction, {
      actorUserId: userId,
      actionCode: "MFA_ENROLL_STARTED",
      entityType: "MFA_FACTOR",
      entityId: factorId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
  });

  const label = encodeURIComponent(`ADP:${userId}`);
  const otpauthUri = `otpauth://totp/${label}?secret=${secret}&issuer=ADP&algorithm=SHA1&digits=6&period=30`;
  return { factorId, secret, otpauthUri };
}

export async function confirmTotp(
  userId: string,
  sessionId: string,
  roles: RoleCode[],
  code: string,
  context: RequestContext
): Promise<{ accessToken: string; recoveryCodes: string[] }> {
  const prisma = getPrisma();
  const verifiedAt = new Date();
  const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    randomToken(9).toUpperCase()
  );

  await prisma.$transaction(async (transaction) => {
    const factor = await transaction.mfaFactor.findFirst({
      where: { userId, enabledAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" }
    });
    if (!factor) {
      throw new AppError(404, "MFA_ENROLLMENT_NOT_FOUND", "No pending MFA enrollment exists");
    }
    const secret = decryptField(
      factor.secretCiphertext,
      getEnv().MFA_ENCRYPTION_KEY_BASE64,
      mfaSecretAad(factor.id, factor.keyVersion)
    );
    const step = verifyTotp(secret, code);
    if (step === undefined) {
      throw new AppError(401, "MFA_CODE_INVALID", "The MFA code is invalid");
    }
    const enabled = await transaction.mfaFactor.updateMany({
      where: { id: factor.id, enabledAt: null, revokedAt: null },
      data: { enabledAt: verifiedAt, lastUsedStep: step }
    });
    if (enabled.count !== 1) {
      throw new AppError(409, "MFA_ENROLLMENT_CONFLICT", "MFA enrollment changed concurrently");
    }
    await transaction.mfaRecoveryCode.createMany({
      data: recoveryCodes.map((recoveryCode) => ({
        factorId: factor.id,
        codeHash: sha256(normalizeRecoveryCode(recoveryCode))
      }))
    });
    const sessionUpdated = await transaction.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { mfaVerifiedAt: verifiedAt }
    });
    if (sessionUpdated.count !== 1) {
      throw new AppError(401, "SESSION_INVALID", "The session is no longer valid");
    }
    await writeAudit(transaction, {
      actorUserId: userId,
      actionCode: "MFA_ENABLED",
      entityType: "MFA_FACTOR",
      entityId: factor.id,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
  });

  return {
    accessToken: await signAccessToken({
      userId,
      sessionId,
      roles,
      mfaVerified: true
    }),
    recoveryCodes
  };
}

export async function disableMfa(
  userId: string,
  sessionId: string,
  password: string,
  context: RequestContext
): Promise<void> {
  await getCredentialOrThrow(userId, password);
  await getPrisma().$transaction(async (transaction) => {
    await transaction.mfaFactor.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    await transaction.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { mfaVerifiedAt: null }
    });
    await writeAudit(transaction, {
      actorUserId: userId,
      actionCode: "MFA_DISABLED",
      entityType: "USER",
      entityId: userId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash,
      metadata: { sessionId }
    });
  });
}
