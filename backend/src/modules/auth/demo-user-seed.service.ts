import { randomUUID } from "node:crypto";
import type { BuyerType, RoleCode } from "../../generated/prisma/enums.js";
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

export interface DemoAccountDefinition {
  displayName: string;
  email: string;
  role: RoleCode;
  buyerType?: BuyerType | undefined;
}

export const DEFAULT_DEMO_ACCOUNTS: readonly DemoAccountDefinition[] = [
  {
    displayName: "Administrador de demostración",
    email: "admin@adp.local",
    role: "ADMIN"
  },
  {
    displayName: "Productor de demostración",
    email: "productor@adp.local",
    role: "FARMER"
  },
  {
    displayName: "Comprador de demostración",
    email: "comprador@adp.local",
    role: "BUYER",
    buyerType: "DISTRIBUTOR"
  }
];

export interface SeededDemoAccount {
  created: boolean;
  userId: string;
  email: string;
  role: RoleCode;
}

export function assertDemoUserSeedAllowed(nodeEnv: string): void {
  if (nodeEnv === "production") {
    throw new Error("Demo user seeding is disabled in production");
  }
}

export async function seedDemoUsers(
  password: string,
  accounts: readonly DemoAccountDefinition[] = DEFAULT_DEMO_ACCOUNTS
): Promise<SeededDemoAccount[]> {
  const env = getEnv();
  assertDemoUserSeedAllowed(env.NODE_ENV);

  const prisma = getAuthPrisma();
  const results: SeededDemoAccount[] = [];

  for (const account of accounts) {
    if (account.role === "BUYER" && !account.buyerType) {
      throw new Error(`buyerType is required for demo buyer ${account.email}`);
    }

    const email = normalizeEmail(account.email);
    const emailLookupHash = hmacSha256(email, env.CONTACT_LOOKUP_KEY_BASE64);
    const passwordHash = await hashPassword(password);
    const now = new Date();

    const result = await prisma.$transaction(async (transaction) => {
      const existingContact = await transaction.userPrivateContact.findUnique({
        where: { emailLookupHash },
        select: { userId: true }
      });
      const userId = existingContact?.userId ?? randomUUID();

      if (existingContact) {
        await transaction.user.update({
          where: { id: userId },
          data: {
            displayName: account.displayName,
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
          create: { userId, passwordHash, passwordChangedAt: now }
        });
        await transaction.authSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now }
        });
        await transaction.mfaFactor.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now }
        });
        await transaction.authToken.updateMany({
          where: { userId, usedAt: null },
          data: { usedAt: now }
        });
      } else {
        await transaction.user.create({
          data: {
            id: userId,
            displayName: account.displayName,
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
          data: { userId, passwordHash, passwordChangedAt: now }
        });
      }

      await transaction.userRole.deleteMany({ where: { userId } });
      await transaction.userRole.create({
        data: { userId, roleCode: account.role }
      });

      if (account.role === "FARMER") {
        await transaction.farmerProfile.upsert({
          where: { userId },
          update: {},
          create: { userId }
        });
      }
      if (account.role === "BUYER" && account.buyerType) {
        await transaction.buyerProfile.upsert({
          where: { userId },
          update: { buyerType: account.buyerType },
          create: { userId, buyerType: account.buyerType }
        });
      }

      await writeAudit(transaction, {
        actionCode: "DEMO_USER_SEEDED",
        entityType: "USER",
        entityId: userId,
        outcome: "SUCCESS",
        requestId: randomUUID(),
        metadata: {
          role: account.role,
          created: !existingContact
        }
      });

      return {
        created: !existingContact,
        userId,
        email,
        role: account.role
      };
    });

    results.push(result);
  }

  return results;
}
