import { Prisma } from "../../generated/prisma/client.js";
import type { ListingStatus } from "../../generated/prisma/enums.js";
import { getMarketPrisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors.js";
import type { RequestContext } from "../../shared/request-context.js";
import { inSerializableTransaction } from "../../shared/transaction.js";
import { writeAudit } from "../audit/audit.service.js";

export interface FarmUpdateInput {
  municipalityId?: number | undefined;
  name?: string | undefined;
  vereda?: string | undefined;
  publicLocationText?: string | undefined;
  description?: string | null | undefined;
  roadAccessNotes?: string | null | undefined;
  productiveHectares?: string | null | undefined;
}

export interface ListingUpdateInput {
  cropVarietyId?: number | undefined;
  estimatedQuantityKg?: string | undefined;
  availableFromDate?: string | undefined;
  cropConditionNotes?: string | null | undefined;
  expectedPriceCopPerKg?: string | null | undefined;
  allowsPartialPurchase?: boolean | undefined;
  bidDeadlineAt?: string | undefined;
}

interface CursorPage {
  cursor?: string | undefined;
  limit: number;
}

export interface PublicListingFilters extends CursorPage {
  municipalityId?: number | undefined;
  cropVarietyId?: number | undefined;
  availableFrom?: string | undefined;
  availableTo?: string | undefined;
}

function serializeFarm<T extends { productiveHectares: Prisma.Decimal | null }>(farm: T) {
  return {
    ...farm,
    productiveHectares: farm.productiveHectares?.toFixed(2) ?? null
  };
}

function serializeListing<
  T extends {
    estimatedQuantityKg: Prisma.Decimal;
    expectedPriceCopPerKg: Prisma.Decimal | null;
  }
>(listing: T) {
  return {
    ...listing,
    estimatedQuantityKg: listing.estimatedQuantityKg.toFixed(3),
    expectedPriceCopPerKg: listing.expectedPriceCopPerKg?.toFixed(2) ?? null
  };
}

function pageResult<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return {
    data,
    page: {
      nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null
    }
  };
}

export async function listOwnFarms(ownerUserId: string, page: CursorPage) {
  const rows = await getMarketPrisma().farm.findMany({
    where: { ownerUserId, deletedAt: null },
    include: {
      municipality: {
        select: { id: true, daneCode: true, name: true, department: { select: { name: true } } }
      },
      _count: { select: { listings: true } }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: page.limit + 1,
    ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {})
  });
  const result = pageResult(rows, page.limit);
  return { ...result, data: result.data.map(serializeFarm) };
}

export async function getOwnFarm(ownerUserId: string, farmId: string) {
  const farm = await getMarketPrisma().farm.findFirst({
    where: { id: farmId, ownerUserId, deletedAt: null },
    include: {
      municipality: {
        select: { id: true, daneCode: true, name: true, department: { select: { name: true } } }
      },
      _count: { select: { listings: true } }
    }
  });
  if (!farm) {
    throw new AppError(404, "FARM_NOT_FOUND", "Farm was not found");
  }
  return serializeFarm(farm);
}

export async function updateFarm(
  ownerUserId: string,
  farmId: string,
  input: FarmUpdateInput,
  context: RequestContext
) {
  const prisma = getMarketPrisma();
  return prisma.$transaction(async (transaction) => {
    const farm = await transaction.farm.findFirst({
      where: { id: farmId, ownerUserId, deletedAt: null },
      select: { id: true, status: true }
    });
    if (!farm) {
      throw new AppError(404, "FARM_NOT_FOUND", "Farm was not found");
    }
    if (farm.status === "ARCHIVED") {
      throw new AppError(409, "FARM_ARCHIVED", "Archived farms cannot be edited");
    }
    if (input.municipalityId !== undefined) {
      const municipality = await transaction.municipality.findUnique({
        where: { id: input.municipalityId },
        select: { id: true }
      });
      if (!municipality) {
        throw new AppError(422, "MUNICIPALITY_NOT_FOUND", "Municipality does not exist");
      }
    }

    const data: Prisma.FarmUncheckedUpdateInput = {
      version: { increment: 1 }
    };
    if (input.municipalityId !== undefined) data.municipalityId = input.municipalityId;
    if (input.name !== undefined) data.name = input.name;
    if (input.vereda !== undefined) data.vereda = input.vereda;
    if (input.publicLocationText !== undefined) data.publicLocationText = input.publicLocationText;
    if (input.description !== undefined) data.description = input.description;
    if (input.roadAccessNotes !== undefined) data.roadAccessNotes = input.roadAccessNotes;
    if (input.productiveHectares !== undefined) {
      data.productiveHectares =
        input.productiveHectares === null
          ? null
          : new Prisma.Decimal(input.productiveHectares);
    }

    const updated = await transaction.farm.update({ where: { id: farmId }, data });
    await writeAudit(transaction, {
      actorUserId: ownerUserId,
      actionCode: "FARM_UPDATE",
      entityType: "FARM",
      entityId: farmId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash,
      metadata: { fields: Object.keys(input).sort().join(",") }
    });
    return serializeFarm(updated);
  });
}

export async function archiveFarm(
  ownerUserId: string,
  farmId: string,
  context: RequestContext
): Promise<void> {
  await inSerializableTransaction(async (transaction) => {
    await transaction.$queryRawUnsafe("SELECT id FROM farms WHERE id = ? FOR UPDATE", farmId);
    const farm = await transaction.farm.findFirst({
      where: { id: farmId, ownerUserId, deletedAt: null },
      select: { id: true }
    });
    if (!farm) {
      throw new AppError(404, "FARM_NOT_FOUND", "Farm was not found");
    }
    const activeListingCount = await transaction.harvestListing.count({
      where: { farmId, status: { in: ["DRAFT", "OPEN"] }, deletedAt: null }
    });
    if (activeListingCount > 0) {
      throw new AppError(
        409,
        "FARM_HAS_ACTIVE_LISTINGS",
        "Archive or cancel active listings before archiving the farm"
      );
    }
    await transaction.farm.update({
      where: { id: farmId },
      data: { status: "ARCHIVED", deletedAt: new Date(), version: { increment: 1 } }
    });
    await writeAudit(transaction, {
      actorUserId: ownerUserId,
      actionCode: "FARM_ARCHIVE",
      entityType: "FARM",
      entityId: farmId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
  });
}

export async function listOwnListings(
  ownerUserId: string,
  page: CursorPage & { status?: ListingStatus | undefined }
) {
  const rows = await getMarketPrisma().harvestListing.findMany({
    where: {
      farm: { ownerUserId },
      deletedAt: null,
      ...(page.status ? { status: page.status } : {})
    },
    include: {
      cropVariety: { select: { code: true, name: true } },
      farm: { select: { id: true, name: true } },
      photos: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, mimeType: true, sizeBytes: true, sortOrder: true, createdAt: true }
      },
      _count: { select: { bids: true } }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: page.limit + 1,
    ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {})
  });
  const result = pageResult(rows, page.limit);
  return { ...result, data: result.data.map(serializeListing) };
}

export async function getPublicListing(listingId: string) {
  const listing = await getMarketPrisma().harvestListing.findFirst({
    where: {
      id: listingId,
      status: "OPEN",
      bidDeadlineAt: { gt: new Date() },
      deletedAt: null,
      farm: { status: "ACTIVE", deletedAt: null }
    },
    include: {
      cropVariety: { select: { code: true, name: true } },
      farm: {
        select: {
          name: true,
          vereda: true,
          publicLocationText: true,
          municipality: {
            select: { daneCode: true, name: true, department: { select: { name: true } } }
          }
        }
      },
      photos: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, mimeType: true, sizeBytes: true, sortOrder: true }
      }
    }
  });
  if (!listing) {
    throw new AppError(404, "LISTING_NOT_FOUND", "Listing was not found");
  }
  return serializeListing(listing);
}

export async function listPublicListings(filters: PublicListingFilters) {
  const rows = await getMarketPrisma().harvestListing.findMany({
    where: {
      status: "OPEN",
      bidDeadlineAt: { gt: new Date() },
      deletedAt: null,
      farm: {
        status: "ACTIVE",
        deletedAt: null,
        ...(filters.municipalityId ? { municipalityId: filters.municipalityId } : {})
      },
      ...(filters.cropVarietyId ? { cropVarietyId: filters.cropVarietyId } : {}),
      ...((filters.availableFrom || filters.availableTo)
        ? {
            availableFromDate: {
              ...(filters.availableFrom
                ? { gte: new Date(`${filters.availableFrom}T00:00:00.000Z`) }
                : {}),
              ...(filters.availableTo
                ? { lte: new Date(`${filters.availableTo}T00:00:00.000Z`) }
                : {})
            }
          }
        : {})
    },
    select: {
      id: true,
      estimatedQuantityKg: true,
      availableFromDate: true,
      expectedPriceCopPerKg: true,
      allowsPartialPurchase: true,
      bidDeadlineAt: true,
      cropConditionNotes: true,
      createdAt: true,
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
        select: { id: true, mimeType: true, sizeBytes: true, sortOrder: true }
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: filters.limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {})
  });
  const result = pageResult(rows, filters.limit);
  return { ...result, data: result.data.map(serializeListing) };
}

export async function updateDraftListing(
  ownerUserId: string,
  listingId: string,
  input: ListingUpdateInput,
  context: RequestContext
) {
  const prisma = getMarketPrisma();
  return prisma.$transaction(async (transaction) => {
    const listing = await transaction.harvestListing.findFirst({
      where: { id: listingId, farm: { ownerUserId }, deletedAt: null },
      select: { id: true, status: true }
    });
    if (!listing) {
      throw new AppError(404, "LISTING_NOT_FOUND", "Listing was not found");
    }
    if (listing.status !== "DRAFT") {
      throw new AppError(409, "LISTING_NOT_DRAFT", "Only draft listings can be edited");
    }
    if (input.cropVarietyId !== undefined) {
      const crop = await transaction.cropVariety.findFirst({
        where: { id: input.cropVarietyId, isActive: true },
        select: { id: true }
      });
      if (!crop) {
        throw new AppError(422, "CROP_VARIETY_INVALID", "Crop variety is not active");
      }
    }
    if (input.bidDeadlineAt && new Date(input.bidDeadlineAt) <= new Date()) {
      throw new AppError(422, "LISTING_DEADLINE_INVALID", "Bid deadline must be in the future");
    }

    const data: Prisma.HarvestListingUncheckedUpdateInput = {
      version: { increment: 1 }
    };
    if (input.cropVarietyId !== undefined) data.cropVarietyId = input.cropVarietyId;
    if (input.estimatedQuantityKg !== undefined) {
      data.estimatedQuantityKg = new Prisma.Decimal(input.estimatedQuantityKg);
    }
    if (input.availableFromDate !== undefined) {
      data.availableFromDate = new Date(`${input.availableFromDate}T00:00:00.000Z`);
    }
    if (input.cropConditionNotes !== undefined) {
      data.cropConditionNotes = input.cropConditionNotes;
    }
    if (input.expectedPriceCopPerKg !== undefined) {
      data.expectedPriceCopPerKg =
        input.expectedPriceCopPerKg === null
          ? null
          : new Prisma.Decimal(input.expectedPriceCopPerKg);
    }
    if (input.allowsPartialPurchase !== undefined) {
      data.allowsPartialPurchase = input.allowsPartialPurchase;
    }
    if (input.bidDeadlineAt !== undefined) {
      data.bidDeadlineAt = new Date(input.bidDeadlineAt);
    }

    const updated = await transaction.harvestListing.update({
      where: { id: listingId },
      data
    });
    await writeAudit(transaction, {
      actorUserId: ownerUserId,
      actionCode: "LISTING_UPDATE",
      entityType: "HARVEST_LISTING",
      entityId: listingId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash,
      metadata: { fields: Object.keys(input).sort().join(",") }
    });
    return serializeListing(updated);
  });
}

export async function cancelListing(
  ownerUserId: string,
  listingId: string,
  context: RequestContext
): Promise<void> {
  await inSerializableTransaction(async (transaction) => {
    await transaction.$queryRawUnsafe(
      "SELECT id FROM harvest_listings WHERE id = ? FOR UPDATE",
      listingId
    );
    const listing = await transaction.harvestListing.findFirst({
      where: { id: listingId, farm: { ownerUserId }, deletedAt: null },
      select: { id: true, status: true }
    });
    if (!listing) {
      throw new AppError(404, "LISTING_NOT_FOUND", "Listing was not found");
    }
    if (!(["DRAFT", "OPEN"] as ListingStatus[]).includes(listing.status)) {
      throw new AppError(409, "LISTING_NOT_CANCELLABLE", "Listing cannot be cancelled");
    }
    const bidCount = await transaction.bid.count({ where: { listingId } });
    if (bidCount > 0) {
      throw new AppError(
        409,
        "LISTING_HAS_BIDS",
        "Listings with bid activity cannot be deleted"
      );
    }
    const now = new Date();
    await transaction.harvestListing.update({
      where: { id: listingId },
      data: {
        status: "CANCELLED",
        closedAt: now,
        deletedAt: now,
        version: { increment: 1 }
      }
    });
    await transaction.listingStatusEvent.create({
      data: {
        listingId,
        fromStatus: listing.status,
        toStatus: "CANCELLED",
        changedByUserId: ownerUserId,
        reasonCode: "OWNER_CANCELLED"
      }
    });
    await writeAudit(transaction, {
      actorUserId: ownerUserId,
      actionCode: "LISTING_CANCEL",
      entityType: "HARVEST_LISTING",
      entityId: listingId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });
  });
}

export async function closeListing(
  ownerUserId: string,
  listingId: string,
  context: RequestContext
): Promise<void> {
  await inSerializableTransaction(async (transaction) => {
    await transaction.$queryRawUnsafe(
      "SELECT id FROM harvest_listings WHERE id = ? FOR UPDATE",
      listingId
    );
    const listing = await transaction.harvestListing.findFirst({
      where: { id: listingId, farm: { ownerUserId }, deletedAt: null },
      select: { id: true, status: true }
    });
    if (!listing) {
      throw new AppError(404, "LISTING_NOT_FOUND", "Listing was not found");
    }
    if (listing.status !== "OPEN") {
      throw new AppError(409, "LISTING_NOT_OPEN", "Only open listings can be closed");
    }
    const submittedBids = await transaction.bid.findMany({
      where: { listingId, status: "SUBMITTED" },
      select: { id: true }
    });
    const closedAt = new Date();
    await transaction.harvestListing.update({
      where: { id: listingId },
      data: { status: "CLOSED", closedAt, version: { increment: 1 } }
    });
    await transaction.bid.updateMany({
      where: { listingId, status: "SUBMITTED" },
      data: { status: "EXPIRED", version: { increment: 1 } }
    });
    await transaction.listingStatusEvent.create({
      data: {
        listingId,
        fromStatus: "OPEN",
        toStatus: "CLOSED",
        changedByUserId: ownerUserId,
        reasonCode: "OWNER_CLOSED"
      }
    });
    if (submittedBids.length > 0) {
      await transaction.bidStatusEvent.createMany({
        data: submittedBids.map(({ id }) => ({
          bidId: id,
          fromStatus: "SUBMITTED" as const,
          toStatus: "EXPIRED" as const,
          changedByUserId: ownerUserId,
          reasonCode: "LISTING_CLOSED"
        }))
      });
    }
    await writeAudit(transaction, {
      actorUserId: ownerUserId,
      actionCode: "LISTING_CLOSE",
      entityType: "HARVEST_LISTING",
      entityId: listingId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash,
      metadata: { expiredBidCount: submittedBids.length }
    });
  });
}
