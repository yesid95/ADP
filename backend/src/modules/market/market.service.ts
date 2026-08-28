import { Prisma } from "../../generated/prisma/client.js";
import type { RequestContext } from "../../shared/request-context.js";
import { AppError } from "../../shared/errors.js";
import { getPrisma } from "../../infrastructure/database/prisma.js";
import { inSerializableTransaction } from "../../shared/transaction.js";
import { writeAudit } from "../audit/audit.service.js";

export interface CreateFarmInput {
  municipalityId: number;
  name: string;
  vereda: string;
  publicLocationText: string;
  description?: string | undefined;
  roadAccessNotes?: string | undefined;
  productiveHectares?: string | undefined;
}

export interface CreateListingInput {
  farmId: string;
  cropVarietyId: number;
  estimatedQuantityKg: string;
  availableFromDate: string;
  cropConditionNotes?: string | undefined;
  expectedPriceCopPerKg?: string | undefined;
  allowsPartialPurchase: boolean;
  bidDeadlineAt: string;
}

async function assertFarmerRole(
  transaction: Prisma.TransactionClient,
  userId: string
): Promise<void> {
  const role = await transaction.userRole.findUnique({
    where: { userId_roleCode: { userId, roleCode: "FARMER" } },
    select: { userId: true }
  });
  if (!role) {
    throw new AppError(403, "FARMER_ROLE_REQUIRED", "Farmer role is required");
  }
}

export async function createFarm(
  ownerUserId: string,
  input: CreateFarmInput,
  context: RequestContext
) {
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    await assertFarmerRole(transaction, ownerUserId);
    const municipality = await transaction.municipality.findUnique({
      where: { id: input.municipalityId },
      select: { id: true }
    });
    if (!municipality) {
      throw new AppError(422, "MUNICIPALITY_NOT_FOUND", "Municipality does not exist");
    }

    const farm = await transaction.farm.create({
      data: {
        ownerUserId,
        municipalityId: input.municipalityId,
        name: input.name,
        vereda: input.vereda,
        publicLocationText: input.publicLocationText,
        status: "ACTIVE",
        ...(input.description ? { description: input.description } : {}),
        ...(input.roadAccessNotes ? { roadAccessNotes: input.roadAccessNotes } : {}),
        ...(input.productiveHectares
          ? { productiveHectares: new Prisma.Decimal(input.productiveHectares) }
          : {})
      }
    });

    await writeAudit(transaction, {
      actorUserId: ownerUserId,
      actionCode: "FARM_CREATE",
      entityType: "FARM",
      entityId: farm.id,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
    return farm;
  });
}

export async function createHarvestListing(
  ownerUserId: string,
  input: CreateListingInput,
  context: RequestContext
) {
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    await assertFarmerRole(transaction, ownerUserId);
    const farm = await transaction.farm.findUnique({
      where: { id: input.farmId },
      select: {
        id: true,
        ownerUserId: true,
        status: true,
        roadAccessNotes: true
      }
    });
    if (!farm || farm.ownerUserId !== ownerUserId) {
      throw new AppError(404, "FARM_NOT_FOUND", "Farm was not found");
    }
    if (farm.status !== "ACTIVE") {
      throw new AppError(409, "FARM_NOT_ACTIVE", "Farm must be active");
    }

    const cropVariety = await transaction.cropVariety.findFirst({
      where: { id: input.cropVarietyId, isActive: true },
      select: { id: true }
    });
    if (!cropVariety) {
      throw new AppError(422, "CROP_VARIETY_INVALID", "Crop variety is not active");
    }

    const deadline = new Date(input.bidDeadlineAt);
    if (deadline <= new Date()) {
      throw new AppError(422, "LISTING_DEADLINE_INVALID", "Bid deadline must be in the future");
    }

    const listing = await transaction.harvestListing.create({
      data: {
        farmId: input.farmId,
        cropVarietyId: input.cropVarietyId,
        estimatedQuantityKg: new Prisma.Decimal(input.estimatedQuantityKg),
        availableFromDate: new Date(input.availableFromDate + "T00:00:00.000Z"),
        roadAccessSnapshot: farm.roadAccessNotes,
        allowsPartialPurchase: input.allowsPartialPurchase,
        bidDeadlineAt: deadline,
        status: "DRAFT",
        ...(input.cropConditionNotes
          ? { cropConditionNotes: input.cropConditionNotes }
          : {}),
        ...(input.expectedPriceCopPerKg
          ? { expectedPriceCopPerKg: new Prisma.Decimal(input.expectedPriceCopPerKg) }
          : {})
      }
    });

    await transaction.listingStatusEvent.create({
      data: {
        listingId: listing.id,
        toStatus: "DRAFT",
        changedByUserId: ownerUserId,
        reasonCode: "CREATED"
      }
    });
    await writeAudit(transaction, {
      actorUserId: ownerUserId,
      actionCode: "LISTING_CREATE",
      entityType: "HARVEST_LISTING",
      entityId: listing.id,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
    return listing;
  });
}

export async function publishHarvestListing(
  ownerUserId: string,
  listingId: string,
  context: RequestContext
) {
  return inSerializableTransaction(async (transaction) => {
    await transaction.$queryRawUnsafe(
      "SELECT id FROM harvest_listings WHERE id = ? FOR UPDATE",
      listingId
    );
    const listing = await transaction.harvestListing.findUnique({
      where: { id: listingId },
      include: { farm: { select: { ownerUserId: true, status: true } } }
    });
    if (!listing || listing.farm.ownerUserId !== ownerUserId) {
      throw new AppError(404, "LISTING_NOT_FOUND", "Listing was not found");
    }
    if (listing.farm.status !== "ACTIVE") {
      throw new AppError(409, "FARM_NOT_ACTIVE", "Farm must be active");
    }
    if (listing.status !== "DRAFT") {
      throw new AppError(409, "LISTING_NOT_DRAFT", "Only draft listings can be published");
    }

    const publishedAt = new Date();
    if (listing.bidDeadlineAt <= publishedAt) {
      throw new AppError(422, "LISTING_DEADLINE_PASSED", "Bid deadline has already passed");
    }

    const updated = await transaction.harvestListing.update({
      where: { id: listingId },
      data: {
        status: "OPEN",
        publishedAt,
        version: { increment: 1 }
      }
    });
    await transaction.listingStatusEvent.create({
      data: {
        listingId,
        fromStatus: "DRAFT",
        toStatus: "OPEN",
        changedByUserId: ownerUserId,
        reasonCode: "PUBLISHED"
      }
    });
    await writeAudit(transaction, {
      actorUserId: ownerUserId,
      actionCode: "LISTING_PUBLISH",
      entityType: "HARVEST_LISTING",
      entityId: listingId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
    return updated;
  });
}

export async function listOpenHarvestListings() {
  const listings = await getPrisma().harvestListing.findMany({
    where: {
      status: "OPEN",
      bidDeadlineAt: { gt: new Date() },
      deletedAt: null,
      farm: { status: "ACTIVE", deletedAt: null }
    },
    select: {
      id: true,
      estimatedQuantityKg: true,
      availableFromDate: true,
      expectedPriceCopPerKg: true,
      allowsPartialPurchase: true,
      bidDeadlineAt: true,
      cropConditionNotes: true,
      cropVariety: { select: { code: true, name: true } },
      farm: {
        select: {
          name: true,
          vereda: true,
          publicLocationText: true,
          municipality: { select: { name: true, department: { select: { name: true } } } }
        }
      },
      photos: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, storageKey: true, mimeType: true, sortOrder: true }
      }
    },
    orderBy: [{ availableFromDate: "asc" }, { createdAt: "desc" }],
    take: 100
  });

  return listings.map((listing) => ({
    ...listing,
    estimatedQuantityKg: listing.estimatedQuantityKg.toFixed(3),
    expectedPriceCopPerKg: listing.expectedPriceCopPerKg?.toFixed(2) ?? null
  }));
}
