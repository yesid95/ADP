import { randomUUID } from "node:crypto";
import { getEnv } from "../../config/env.js";
import { getAuthPrisma } from "../../infrastructure/database/prisma.js";
import {
  contactFieldAad,
  encryptField,
  hmacSha256,
  normalizeEmail
} from "../../shared/crypto.js";
import { hashPassword } from "../../shared/password.js";
import { writeAudit } from "../audit/audit.service.js";

const CONTACT_KEY_VERSION = 1;

export interface BootstrapAdminInput {
  displayName: string;
  email: string;
  password: string;
}

export interface BootstrapAdminResult {
  created: boolean;
  userId: string;
  email: string;
  sessionsRevoked: number;
  mfaFactorsRevoked: number;
}

export async function bootstrapAdmin(
  input: BootstrapAdminInput
): Promise<BootstrapAdminResult> {
  const prisma = getAuthPrisma();
  const env = getEnv();
  const email = normalizeEmail(input.email);
  const emailLookupHash = hmacSha256(email, env.CONTACT_LOOKUP_KEY_BASE64);
  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    const existingContact = await transaction.userPrivateContact.findUnique({
      where: { emailLookupHash },
      select: { userId: true }
    });

    const userId = existingContact?.userId ?? randomUUID();
    let sessionsRevoked = 0;
    let mfaFactorsRevoked = 0;

    if (existingContact) {
      await transaction.user.update({
        where: { id: userId },
        data: {
          displayName: input.displayName,
          status: "ACTIVE",
          deletedAt: null
        }
      });
      await transaction.userPrivateContact.update({
        where: { userId },
        data: {
          emailCiphertext: encryptField(
            email,
            env.CONTACT_ENCRYPTION_KEY_BASE64,
            contactFieldAad(userId, "email", CONTACT_KEY_VERSION)
          ),
          keyVersion: CONTACT_KEY_VERSION,
          emailVerifiedAt: now
        }
      });
      await transaction.passwordCredential.upsert({
        where: { userId },
        update: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginCount: 0,
          lockedUntil: null
        },
        create: {
          userId,
          passwordHash,
          passwordChangedAt: now
        }
      });
      sessionsRevoked = (
        await transaction.authSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now }
        })
      ).count;
      mfaFactorsRevoked = (
        await transaction.mfaFactor.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now }
        })
      ).count;
      await transaction.authToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now }
      });
    } else {
      await transaction.user.create({
        data: {
          id: userId,
          displayName: input.displayName,
          status: "ACTIVE"
        }
      });
      await transaction.userPrivateContact.create({
        data: {
          userId,
          emailCiphertext: encryptField(
            email,
            env.CONTACT_ENCRYPTION_KEY_BASE64,
            contactFieldAad(userId, "email", CONTACT_KEY_VERSION)
          ),
          emailLookupHash,
          keyVersion: CONTACT_KEY_VERSION,
          emailVerifiedAt: now
        }
      });
      await transaction.passwordCredential.create({
        data: {
          userId,
          passwordHash,
          passwordChangedAt: now
        }
      });
    }

    await transaction.userRole.upsert({
      where: { userId_roleCode: { userId, roleCode: "ADMIN" } },
      update: {},
      create: { userId, roleCode: "ADMIN" }
    });

    await writeAudit(transaction, {
      actionCode: existingContact ? "ADMIN_BOOTSTRAP_ROTATED" : "ADMIN_BOOTSTRAP_CREATED",
      entityType: "USER",
      entityId: userId,
      outcome: "SUCCESS",
      requestId: randomUUID(),
      metadata: {
        sessionsRevoked,
        mfaFactorsRevoked
      }
    });

    return {
      created: !existingContact,
      userId,
      email,
      sessionsRevoked,
      mfaFactorsRevoked
    };
  });
}
