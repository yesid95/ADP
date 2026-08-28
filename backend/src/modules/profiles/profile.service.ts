import { Prisma } from "../../generated/prisma/client.js";
import type { BuyerType } from "../../generated/prisma/enums.js";
import { getEnv } from "../../config/env.js";
import { getPrisma } from "../../infrastructure/database/prisma.js";
import {
  contactFieldAad,
  decryptField
} from "../../shared/crypto.js";
import { AppError } from "../../shared/errors.js";
import type { RequestContext } from "../../shared/request-context.js";
import { writeAudit } from "../audit/audit.service.js";

export interface BuyerCropInterestInput {
  cropVarietyId: number;
  minimumQuantityKg?: string | undefined;
  maximumQuantityKg?: string | undefined;
}

function decimalOrUndefined(value: string | undefined): Prisma.Decimal | undefined {
  return value === undefined ? undefined : new Prisma.Decimal(value);
}

async function assertRole(
  transaction: Prisma.TransactionClient,
  userId: string,
  roleCode: "FARMER" | "BUYER"
): Promise<void> {
  const role = await transaction.userRole.findUnique({
    where: { userId_roleCode: { userId, roleCode } },
    select: { userId: true }
  });
  if (!role) {
    throw new AppError(403, `${roleCode}_ROLE_REQUIRED`, `${roleCode} role is required`);
  }
}

export async function getOwnProfile(userId: string) {
  const env = getEnv();
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    include: {
      privateContact: true,
      roles: { select: { roleCode: true } },
      farmerProfile: true,
      buyerProfile: true,
      buyerCropInterests: {
        include: { cropVariety: { select: { code: true, name: true } } },
        orderBy: { cropVarietyId: "asc" }
      },
      buyerMunicipalityInterests: {
        include: { municipality: { select: { daneCode: true, name: true } } },
        orderBy: { municipalityId: "asc" }
      }
    }
  });
  if (!user || user.status === "DELETED" || !user.privateContact) {
    throw new AppError(404, "PROFILE_NOT_FOUND", "Profile was not found");
  }

  const contact = user.privateContact;
  const email = decryptField(
    contact.emailCiphertext,
    env.CONTACT_ENCRYPTION_KEY_BASE64,
    contactFieldAad(user.id, "email", contact.keyVersion)
  );
  const phone = contact.phoneCiphertext
    ? decryptField(
        contact.phoneCiphertext,
        env.CONTACT_ENCRYPTION_KEY_BASE64,
        contactFieldAad(user.id, "phone", contact.keyVersion)
      )
    : null;

  return {
    id: user.id,
    displayName: user.displayName,
    status: user.status,
    roles: user.roles.map(({ roleCode }) => roleCode),
    contact: {
      email,
      phone,
      emailVerifiedAt: contact.emailVerifiedAt,
      phoneVerifiedAt: contact.phoneVerifiedAt
    },
    farmerProfile: user.farmerProfile,
    buyerProfile: user.buyerProfile,
    buyerInterests: {
      crops: user.buyerCropInterests.map((interest) => ({
        cropVarietyId: interest.cropVarietyId,
        cropVariety: interest.cropVariety,
        minimumQuantityKg: interest.minimumQuantityKg?.toFixed(3) ?? null,
        maximumQuantityKg: interest.maximumQuantityKg?.toFixed(3) ?? null
      })),
      municipalities: user.buyerMunicipalityInterests.map((interest) => ({
        municipalityId: interest.municipalityId,
        municipality: interest.municipality
      }))
    },
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export async function updateOwnIdentity(
  userId: string,
  displayName: string,
  context: RequestContext
) {
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.update({
      where: { id: userId },
      data: { displayName, version: { increment: 1 } },
      select: { id: true, displayName: true, updatedAt: true, version: true }
    });
    await writeAudit(transaction, {
      actorUserId: userId,
      actionCode: "PROFILE_UPDATE",
      entityType: "USER",
      entityId: userId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash,
      metadata: { fields: "displayName" }
    });
    return user;
  });
}

export async function updateFarmerProfile(
  userId: string,
  publicBio: string | null,
  context: RequestContext
) {
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    await assertRole(transaction, userId, "FARMER");
    const profile = await transaction.farmerProfile.upsert({
      where: { userId },
      create: { userId, publicBio },
      update: { publicBio }
    });
    await writeAudit(transaction, {
      actorUserId: userId,
      actionCode: "FARMER_PROFILE_UPDATE",
      entityType: "FARMER_PROFILE",
      entityId: userId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
    return profile;
  });
}

export async function updateBuyerProfile(
  userId: string,
  input: {
    businessName: string | null;
    buyerType: BuyerType;
    description: string | null;
  },
  context: RequestContext
) {
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    await assertRole(transaction, userId, "BUYER");
    const profile = await transaction.buyerProfile.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input
    });
    await writeAudit(transaction, {
      actorUserId: userId,
      actionCode: "BUYER_PROFILE_UPDATE",
      entityType: "BUYER_PROFILE",
      entityId: userId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
    return profile;
  });
}

export async function replaceBuyerInterests(
  userId: string,
  cropInterests: BuyerCropInterestInput[],
  municipalityIds: number[],
  context: RequestContext
) {
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    await assertRole(transaction, userId, "BUYER");

    const cropIds = cropInterests.map(({ cropVarietyId }) => cropVarietyId);
    const [activeCropCount, municipalityCount] = await Promise.all([
      transaction.cropVariety.count({
        where: { id: { in: cropIds }, isActive: true }
      }),
      transaction.municipality.count({ where: { id: { in: municipalityIds } } })
    ]);
    if (activeCropCount !== cropIds.length) {
      throw new AppError(422, "CROP_INTEREST_INVALID", "A crop variety is missing or inactive");
    }
    if (municipalityCount !== municipalityIds.length) {
      throw new AppError(422, "MUNICIPALITY_INTEREST_INVALID", "A municipality is missing");
    }

    for (const interest of cropInterests) {
      const minimum = decimalOrUndefined(interest.minimumQuantityKg);
      const maximum = decimalOrUndefined(interest.maximumQuantityKg);
      if (minimum && maximum && minimum.gt(maximum)) {
        throw new AppError(
          422,
          "CROP_INTEREST_RANGE_INVALID",
          "Minimum quantity cannot exceed maximum quantity"
        );
      }
    }

    await transaction.buyerCropInterest.deleteMany({ where: { buyerUserId: userId } });
    await transaction.buyerMunicipalityInterest.deleteMany({
      where: { buyerUserId: userId }
    });
    if (cropInterests.length > 0) {
      await transaction.buyerCropInterest.createMany({
        data: cropInterests.map((interest) => ({
          buyerUserId: userId,
          cropVarietyId: interest.cropVarietyId,
          ...(interest.minimumQuantityKg
            ? { minimumQuantityKg: new Prisma.Decimal(interest.minimumQuantityKg) }
            : {}),
          ...(interest.maximumQuantityKg
            ? { maximumQuantityKg: new Prisma.Decimal(interest.maximumQuantityKg) }
            : {})
        }))
      });
    }
    if (municipalityIds.length > 0) {
      await transaction.buyerMunicipalityInterest.createMany({
        data: municipalityIds.map((municipalityId) => ({
          buyerUserId: userId,
          municipalityId
        }))
      });
    }

    await writeAudit(transaction, {
      actorUserId: userId,
      actionCode: "BUYER_INTERESTS_REPLACE",
      entityType: "BUYER_PROFILE",
      entityId: userId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash,
      metadata: {
        cropCount: cropInterests.length,
        municipalityCount: municipalityIds.length
      }
    });
    return { cropCount: cropInterests.length, municipalityCount: municipalityIds.length };
  });
}

export async function deleteOwnAccount(
  userId: string,
  context: RequestContext
): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction(async (transaction) => {
    const deletedAt = new Date();
    await transaction.user.update({
      where: { id: userId },
      data: {
        status: "DELETED",
        deletedAt,
        version: { increment: 1 }
      }
    });
    await transaction.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: deletedAt }
    });
    await writeAudit(transaction, {
      actorUserId: userId,
      actionCode: "ACCOUNT_DELETE",
      entityType: "USER",
      entityId: userId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
  });
}
