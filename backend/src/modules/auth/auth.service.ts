import { randomUUID } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import type { BuyerType, RoleCode } from "../../generated/prisma/enums.js";
import { getEnv } from "../../config/env.js";
import { getPrisma } from "../../infrastructure/database/prisma.js";
import { sendTransactionalMail } from "../../infrastructure/mail/mailer.js";
import { writeAudit } from "../audit/audit.service.js";
import {
  encryptField,
  contactFieldAad,
  hmacSha256,
  normalizeEmail,
  normalizePhone,
  randomToken,
  sha256
} from "../../shared/crypto.js";
import { AppError } from "../../shared/errors.js";
import { hashPassword, needsPasswordRehash, verifyPassword } from "../../shared/password.js";
import { signAccessToken } from "../../shared/tokens.js";
import type { RequestContext } from "../../shared/request-context.js";
import { consumeMfaCode } from "./mfa.service.js";

const CONTACT_KEY_VERSION = 1;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export interface RegisterInput {
  displayName: string;
  email: string;
  phone?: string | undefined;
  password: string;
  roles: Array<Exclude<RoleCode, "ADMIN">>;
  buyerType?: BuyerType | undefined;
}

export interface LoginInput {
  email: string;
  password: string;
  mfaCode?: string | undefined;
}

async function deliverTransactionalMail(
  mail: Parameters<typeof sendTransactionalMail>[0]
): Promise<void> {
  try {
    await sendTransactionalMail(mail);
  } catch {
    throw new AppError(
      503,
      "MAIL_DELIVERY_UNAVAILABLE",
      "The account action was saved, but email delivery is temporarily unavailable"
    );
  }
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  mfaRequired: boolean;
  mfaVerified: boolean;
}

function sessionExpiry(): Date {
  const days = getEnv().REFRESH_TOKEN_TTL_DAYS;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1_000);
}

async function issueSession(
  transaction: Prisma.TransactionClient,
  userId: string,
  roles: RoleCode[],
  context: RequestContext,
  rotatedFromSessionId?: string,
  mfaVerifiedAt?: Date
): Promise<TokenPair> {
  const sessionId = randomUUID();
  const refreshToken = randomToken();

  await transaction.authSession.create({
    data: {
      id: sessionId,
      userId,
      refreshTokenHash: sha256(refreshToken),
      expiresAt: sessionExpiry(),
      ...(rotatedFromSessionId ? { rotatedFromSessionId } : {}),
      ...(context.ipHash ? { ipPrefixHash: context.ipHash } : {}),
      ...(context.userAgentHash ? { userAgentHash: context.userAgentHash } : {}),
      ...(mfaVerifiedAt ? { mfaVerifiedAt } : {})
    }
  });

  return {
    accessToken: await signAccessToken({
      userId,
      sessionId,
      roles,
      mfaVerified: Boolean(mfaVerifiedAt)
    }),
    refreshToken,
    expiresInSeconds: getEnv().ACCESS_TOKEN_TTL_MINUTES * 60,
    mfaRequired: roles.includes("ADMIN") && !mfaVerifiedAt,
    mfaVerified: Boolean(mfaVerifiedAt)
  };
}

export async function registerUser(
  input: RegisterInput,
  context: RequestContext
): Promise<{
  user: { id: string; displayName: string; status: "PENDING"; roles: RoleCode[] };
  verificationToken?: string;
}> {
  const prisma = getPrisma();
  const env = getEnv();
  const userId = randomUUID();
  const email = normalizeEmail(input.email);
  const phone = input.phone ? normalizePhone(input.phone) : undefined;
  const verificationToken = randomToken();
  const passwordHash = await hashPassword(input.password);

  if (input.roles.includes("BUYER") && !input.buyerType) {
    throw new AppError(422, "BUYER_TYPE_REQUIRED", "buyerType is required for buyer accounts");
  }

  const user = await prisma.$transaction(async (transaction) => {
    const created = await transaction.user.create({
      data: {
        id: userId,
        displayName: input.displayName,
        status: "PENDING"
      },
      select: { id: true, displayName: true, status: true }
    });

    await transaction.userPrivateContact.create({
      data: {
        userId,
        emailCiphertext: encryptField(
          email,
          env.CONTACT_ENCRYPTION_KEY_BASE64,
          contactFieldAad(userId, "email", CONTACT_KEY_VERSION)
        ),
        emailLookupHash: hmacSha256(email, env.CONTACT_LOOKUP_KEY_BASE64),
        keyVersion: CONTACT_KEY_VERSION,
        ...(phone
          ? {
              phoneCiphertext: encryptField(
                phone,
                env.CONTACT_ENCRYPTION_KEY_BASE64,
                contactFieldAad(userId, "phone", CONTACT_KEY_VERSION)
              ),
              phoneLookupHash: hmacSha256(phone, env.CONTACT_LOOKUP_KEY_BASE64)
            }
          : {})
      }
    });

    await transaction.passwordCredential.create({
      data: {
        userId,
        passwordHash,
        passwordChangedAt: new Date()
      }
    });

    await transaction.userRole.createMany({
      data: input.roles.map((roleCode) => ({ userId, roleCode }))
    });

    if (input.roles.includes("FARMER")) {
      await transaction.farmerProfile.create({ data: { userId } });
    }
    if (input.roles.includes("BUYER") && input.buyerType) {
      await transaction.buyerProfile.create({
        data: { userId, buyerType: input.buyerType }
      });
    }

    await transaction.authToken.create({
      data: {
        userId,
        purpose: "VERIFY_EMAIL",
        tokenHash: sha256(verificationToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000)
      }
    });

    await writeAudit(transaction, {
      actionCode: "AUTH_REGISTER",
      entityType: "USER",
      entityId: userId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash,
      metadata: { roles: input.roles.join(",") }
    });

    return created;
  });

  await deliverTransactionalMail({ kind: "verify-email", to: email, token: verificationToken });

  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      status: "PENDING",
      roles: input.roles
    },
    ...(env.NODE_ENV === "production" ? {} : { verificationToken })
  };
}

export async function resendEmailVerification(
  rawEmail: string,
  context: RequestContext
): Promise<void> {
  const prisma = getPrisma();
  const env = getEnv();
  const email = normalizeEmail(rawEmail);
  const contact = await prisma.userPrivateContact.findUnique({
    where: { emailLookupHash: hmacSha256(email, env.CONTACT_LOOKUP_KEY_BASE64) },
    include: { user: { select: { status: true } } }
  });

  if (!contact || contact.emailVerifiedAt || contact.user.status !== "PENDING") {
    return;
  }

  const token = randomToken();
  await prisma.$transaction(async (transaction) => {
    await transaction.authToken.updateMany({
      where: {
        userId: contact.userId,
        purpose: "VERIFY_EMAIL",
        usedAt: null
      },
      data: { usedAt: new Date() }
    });
    await transaction.authToken.create({
      data: {
        userId: contact.userId,
        purpose: "VERIFY_EMAIL",
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000)
      }
    });
    await writeAudit(transaction, {
      actorUserId: contact.userId,
      actionCode: "AUTH_RESEND_VERIFICATION",
      entityType: "USER",
      entityId: contact.userId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
  });
  await deliverTransactionalMail({ kind: "verify-email", to: email, token });
}

export async function verifyEmail(token: string, context: RequestContext): Promise<void> {
  const prisma = getPrisma();
  const tokenHash = sha256(token);

  await prisma.$transaction(async (transaction) => {
    const record = await transaction.authToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, purpose: true, usedAt: true, expiresAt: true }
    });

    if (
      !record ||
      record.purpose !== "VERIFY_EMAIL" ||
      record.usedAt ||
      record.expiresAt <= new Date()
    ) {
      throw new AppError(400, "TOKEN_INVALID", "The verification token is invalid or expired");
    }

    const consumed = await transaction.authToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() }
    });
    if (consumed.count !== 1) {
      throw new AppError(409, "TOKEN_ALREADY_USED", "The verification token was already used");
    }

    await transaction.userPrivateContact.update({
      where: { userId: record.userId },
      data: { emailVerifiedAt: new Date() }
    });
    await transaction.user.update({
      where: { id: record.userId },
      data: { status: "ACTIVE", version: { increment: 1 } }
    });
    await writeAudit(transaction, {
      actorUserId: record.userId,
      actionCode: "AUTH_VERIFY_EMAIL",
      entityType: "USER",
      entityId: record.userId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
  });
}

export async function requestPasswordReset(
  rawEmail: string,
  context: RequestContext
): Promise<{ resetToken?: string }> {
  const prisma = getPrisma();
  const env = getEnv();
  const email = normalizeEmail(rawEmail);
  const contact = await prisma.userPrivateContact.findUnique({
    where: { emailLookupHash: hmacSha256(email, env.CONTACT_LOOKUP_KEY_BASE64) },
    include: { user: { select: { status: true } } }
  });

  if (!contact || contact.user.status !== "ACTIVE") {
    return {};
  }

  const token = randomToken();
  await prisma.$transaction(async (transaction) => {
    await transaction.authToken.updateMany({
      where: {
        userId: contact.userId,
        purpose: "RESET_PASSWORD",
        usedAt: null
      },
      data: { usedAt: new Date() }
    });
    await transaction.authToken.create({
      data: {
        userId: contact.userId,
        purpose: "RESET_PASSWORD",
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1_000)
      }
    });
    await writeAudit(transaction, {
      actorUserId: contact.userId,
      actionCode: "AUTH_REQUEST_PASSWORD_RESET",
      entityType: "USER",
      entityId: contact.userId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
  });
  await deliverTransactionalMail({ kind: "reset-password", to: email, token });
  return env.NODE_ENV === "production" ? {} : { resetToken: token };
}

export async function resetPassword(
  token: string,
  newPassword: string,
  context: RequestContext
): Promise<void> {
  const prisma = getPrisma();
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (transaction) => {
    const record = await transaction.authToken.findUnique({
      where: { tokenHash: sha256(token) },
      select: { id: true, userId: true, purpose: true, usedAt: true, expiresAt: true }
    });
    if (
      !record ||
      record.purpose !== "RESET_PASSWORD" ||
      record.usedAt ||
      record.expiresAt <= new Date()
    ) {
      throw new AppError(400, "TOKEN_INVALID", "The password reset token is invalid or expired");
    }
    const consumed = await transaction.authToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() }
    });
    if (consumed.count !== 1) {
      throw new AppError(409, "TOKEN_ALREADY_USED", "The reset token was already used");
    }
    await transaction.passwordCredential.update({
      where: { userId: record.userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null
      }
    });
    await transaction.authSession.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    await writeAudit(transaction, {
      actorUserId: record.userId,
      actionCode: "AUTH_RESET_PASSWORD",
      entityType: "USER",
      entityId: record.userId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  context: RequestContext
): Promise<void> {
  const prisma = getPrisma();
  const credential = await prisma.passwordCredential.findUnique({ where: { userId } });
  if (!credential || !(await verifyPassword(credential.passwordHash, currentPassword))) {
    throw new AppError(401, "CURRENT_PASSWORD_INVALID", "The current password is incorrect");
  }
  if (await verifyPassword(credential.passwordHash, newPassword)) {
    throw new AppError(422, "PASSWORD_REUSED", "The new password must be different");
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (transaction) => {
    await transaction.passwordCredential.update({
      where: { userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null
      }
    });
    await transaction.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    await writeAudit(transaction, {
      actorUserId: userId,
      actionCode: "AUTH_CHANGE_PASSWORD",
      entityType: "USER",
      entityId: userId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
  });
}

async function recordFailedLogin(
  userId: string,
  currentCount: number,
  context: RequestContext
): Promise<void> {
  const prisma = getPrisma();
  const nextCount = currentCount + 1;
  const lockedUntil =
    nextCount >= MAX_FAILED_LOGINS
      ? new Date(Date.now() + LOCK_MINUTES * 60 * 1_000)
      : null;

  await prisma.$transaction(async (transaction) => {
    await transaction.passwordCredential.update({
      where: { userId },
      data: {
        failedLoginCount: nextCount,
        lockedUntil
      }
    });
    await writeAudit(transaction, {
      actorUserId: userId,
      actionCode: "AUTH_LOGIN",
      entityType: "USER",
      entityId: userId,
      outcome: "DENIED",
      requestId: context.requestId,
      ipHash: context.ipHash,
      metadata: { reason: lockedUntil ? "ACCOUNT_TEMPORARILY_LOCKED" : "INVALID_CREDENTIALS" }
    });
  });
}

export async function loginUser(
  input: LoginInput,
  context: RequestContext
): Promise<TokenPair> {
  const prisma = getPrisma();
  const env = getEnv();
  const emailLookupHash = hmacSha256(
    normalizeEmail(input.email),
    env.CONTACT_LOOKUP_KEY_BASE64
  );
  const contact = await prisma.userPrivateContact.findUnique({
    where: { emailLookupHash },
    include: {
      user: {
        include: {
          passwordCredential: true,
          roles: { select: { roleCode: true } }
        }
      }
    }
  });

  const credential = contact?.user.passwordCredential;
  if (!contact || !credential) {
    await hashPassword(input.password);
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }

  if (credential.lockedUntil && credential.lockedUntil > new Date()) {
    throw new AppError(429, "ACCOUNT_LOCKED", "The account is temporarily locked");
  }

  const passwordMatches = await verifyPassword(credential.passwordHash, input.password);
  if (!passwordMatches) {
    await recordFailedLogin(contact.userId, credential.failedLoginCount, context);
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }

  if (contact.user.status !== "ACTIVE") {
    throw new AppError(403, "ACCOUNT_NOT_ACTIVE", "The account is not active");
  }

  const roles = contact.user.roles.map(({ roleCode }) => roleCode);
  return prisma.$transaction(async (transaction) => {
    await transaction.passwordCredential.update({
      where: { userId: contact.userId },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        ...(needsPasswordRehash(credential.passwordHash)
          ? { passwordHash: await hashPassword(input.password), passwordChangedAt: new Date() }
          : {})
      }
    });
    let mfaVerifiedAt: Date | undefined;
    if (input.mfaCode) {
      mfaVerifiedAt = await consumeMfaCode(transaction, contact.userId, input.mfaCode);
    }
    const tokens = await issueSession(
      transaction,
      contact.userId,
      roles,
      context,
      undefined,
      mfaVerifiedAt
    );
    await writeAudit(transaction, {
      actorUserId: contact.userId,
      actionCode: "AUTH_LOGIN",
      entityType: "USER",
      entityId: contact.userId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
    return tokens;
  });
}

export async function refreshSession(
  refreshToken: string,
  context: RequestContext
): Promise<TokenPair> {
  const prisma = getPrisma();
  const refreshTokenHash = sha256(refreshToken);
  const session = await prisma.authSession.findUnique({
    where: { refreshTokenHash },
    include: {
      user: {
        include: { roles: { select: { roleCode: true } } }
      }
    }
  });

  if (!session) {
    throw new AppError(401, "REFRESH_TOKEN_INVALID", "The refresh token is invalid");
  }
  if (session.revokedAt || session.expiresAt <= new Date()) {
    await prisma.authSession.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    throw new AppError(401, "REFRESH_TOKEN_REUSED", "The session family was revoked");
  }
  if (session.user.status !== "ACTIVE") {
    throw new AppError(403, "ACCOUNT_NOT_ACTIVE", "The account is not active");
  }

  const roles = session.user.roles.map(({ roleCode }) => roleCode);
  return prisma.$transaction(async (transaction) => {
    const revoked = await transaction.authSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date(), lastUsedAt: new Date() }
    });
    if (revoked.count !== 1) {
      throw new AppError(409, "SESSION_ROTATION_CONFLICT", "The session was already rotated");
    }

    const activeMfaVerification =
      session.mfaVerifiedAt &&
      session.mfaVerifiedAt.getTime() >
        Date.now() - getEnv().MFA_SESSION_TTL_HOURS * 60 * 60 * 1_000
        ? session.mfaVerifiedAt
        : undefined;
    const tokens = await issueSession(
      transaction,
      session.userId,
      roles,
      context,
      session.id,
      activeMfaVerification
    );
    await writeAudit(transaction, {
      actorUserId: session.userId,
      actionCode: "AUTH_REFRESH",
      entityType: "AUTH_SESSION",
      entityId: session.id,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
    return tokens;
  });
}

export async function logoutSession(
  refreshToken: string,
  context: RequestContext
): Promise<void> {
  const prisma = getPrisma();
  const session = await prisma.authSession.findUnique({
    where: { refreshTokenHash: sha256(refreshToken) },
    select: { id: true, userId: true, revokedAt: true }
  });
  if (!session || session.revokedAt) {
    return;
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() }
    });
    await writeAudit(transaction, {
      actorUserId: session.userId,
      actionCode: "AUTH_LOGOUT",
      entityType: "AUTH_SESSION",
      entityId: session.id,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
  });
}
