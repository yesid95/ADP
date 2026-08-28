import { Prisma } from "../../generated/prisma/client.js";
import { getEnv } from "../../config/env.js";
import { getPrisma } from "../../infrastructure/database/prisma.js";
import {
  contactFieldAad,
  decryptField
} from "../../shared/crypto.js";
import { AppError } from "../../shared/errors.js";
import type { RequestContext } from "../../shared/request-context.js";
import { inSerializableTransaction } from "../../shared/transaction.js";
import { writeAudit } from "../audit/audit.service.js";
import {
  findIdempotentResource,
  saveIdempotentResource,
  type IdempotencyContext
} from "../idempotency/idempotency.service.js";
import {
  validateBidTerms,
  type BidTermsInput,
  type ValidatedBidTerms
} from "./bid-policy.js";

function versionData(terms: ValidatedBidTerms) {
  return {
    unitPriceCopPerKg: terms.unitPriceCopPerKg,
    offeredQuantityKg: terms.offeredQuantityKg,
    transportIncluded: terms.transportIncluded,
    pickupAtFarm: terms.pickupAtFarm,
    sellerLogisticsCostCop: terms.sellerLogisticsCostCop,
    advanceAmountCop: terms.advanceAmountCop,
    paymentTermDays: terms.paymentTermDays,
    ...(terms.continuityMonths !== undefined
      ? { continuityMonths: terms.continuityMonths }
      : {}),
    ...(terms.continuityNotes ? { continuityNotes: terms.continuityNotes } : {}),
    ...(terms.observations ? { observations: terms.observations } : {})
  };
}

function anonymousLabel(index: number): string {
  if (index < 26) {
    return String.fromCharCode(65 + index);
  }
  return "B" + String(index + 1);
}

async function assertBuyerRole(
  transaction: Prisma.TransactionClient,
  userId: string
): Promise<void> {
  const role = await transaction.userRole.findUnique({
    where: { userId_roleCode: { userId, roleCode: "BUYER" } },
    select: { userId: true }
  });
  if (!role) {
    throw new AppError(403, "BUYER_ROLE_REQUIRED", "Buyer role is required");
  }
}

async function loadBidForResponse(transaction: Prisma.TransactionClient, bidId: string) {
  const bid = await transaction.bid.findUnique({
    where: { id: bidId },
    include: {
      versions: { orderBy: { versionNo: "desc" }, take: 1 }
    }
  });
  if (!bid || bid.versions.length !== 1) {
    throw new AppError(409, "BID_INCOMPLETE", "Bid or current version was not found");
  }
  return bid;
}

export async function submitBid(
  buyerUserId: string,
  listingId: string,
  termsInput: BidTermsInput,
  idempotencyKey: string,
  context: RequestContext
) {
  const idempotency: IdempotencyContext = {
    userId: buyerUserId,
    operationCode: "SUBMIT_BID",
    key: idempotencyKey,
    requestBody: { listingId, terms: termsInput }
  };

  return inSerializableTransaction(async (transaction) => {
    const previousBidId = await findIdempotentResource(transaction, idempotency);
    if (previousBidId) {
      return loadBidForResponse(transaction, previousBidId);
    }

    await assertBuyerRole(transaction, buyerUserId);
    await transaction.$queryRawUnsafe(
      "SELECT id FROM harvest_listings WHERE id = ? FOR UPDATE",
      listingId
    );
    const listing = await transaction.harvestListing.findUnique({
      where: { id: listingId },
      include: { farm: { select: { ownerUserId: true } } }
    });
    if (!listing) {
      throw new AppError(404, "LISTING_NOT_FOUND", "Listing was not found");
    }
    if (listing.status !== "OPEN") {
      throw new AppError(409, "LISTING_NOT_OPEN", "Listing is not open");
    }
    if (listing.bidDeadlineAt <= new Date()) {
      throw new AppError(409, "LISTING_DEADLINE_PASSED", "Bid deadline has passed");
    }
    if (listing.farm.ownerUserId === buyerUserId) {
      throw new AppError(403, "SELF_BIDDING_FORBIDDEN", "Farm owners cannot bid on their listing");
    }

    const existing = await transaction.bid.findUnique({
      where: {
        listingId_buyerUserId: { listingId, buyerUserId }
      },
      select: { id: true }
    });
    if (existing) {
      throw new AppError(409, "BID_ALREADY_EXISTS", "Buyer already has a bid for this listing");
    }

    const terms = validateBidTerms(termsInput, listing);
    const existingBidCount = await transaction.bid.count({ where: { listingId } });
    const bid = await transaction.bid.create({
      data: {
        listingId,
        buyerUserId,
        anonymousLabel: anonymousLabel(existingBidCount),
        currentVersionNo: 1,
        versions: {
          create: {
            versionNo: 1,
            ...versionData(terms)
          }
        }
      },
      include: { versions: true }
    });

    await transaction.bidStatusEvent.create({
      data: {
        bidId: bid.id,
        toStatus: "SUBMITTED",
        changedByUserId: buyerUserId,
        reasonCode: "CREATED"
      }
    });
    await saveIdempotentResource(transaction, idempotency, "BID", bid.id, 201);
    await writeAudit(transaction, {
      actorUserId: buyerUserId,
      actionCode: "BID_SUBMIT",
      entityType: "BID",
      entityId: bid.id,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash,
      metadata: { listingId, versionNo: 1 }
    });
    return bid;
  });
}

export async function reviseBid(
  buyerUserId: string,
  bidId: string,
  termsInput: BidTermsInput,
  idempotencyKey: string,
  context: RequestContext
) {
  const idempotency: IdempotencyContext = {
    userId: buyerUserId,
    operationCode: "REVISE_BID",
    key: idempotencyKey,
    requestBody: { bidId, terms: termsInput }
  };

  return inSerializableTransaction(async (transaction) => {
    const previousBidId = await findIdempotentResource(transaction, idempotency);
    if (previousBidId) {
      return loadBidForResponse(transaction, previousBidId);
    }

    await transaction.$queryRawUnsafe("SELECT id FROM bids WHERE id = ? FOR UPDATE", bidId);
    const bid = await transaction.bid.findUnique({
      where: { id: bidId },
      include: { listing: true }
    });
    if (!bid || bid.buyerUserId !== buyerUserId) {
      throw new AppError(404, "BID_NOT_FOUND", "Bid was not found");
    }

    await transaction.$queryRawUnsafe(
      "SELECT id FROM harvest_listings WHERE id = ? FOR UPDATE",
      bid.listingId
    );
    if (bid.status !== "SUBMITTED") {
      throw new AppError(409, "BID_NOT_EDITABLE", "Only submitted bids can be revised");
    }
    if (bid.listing.status !== "OPEN" || bid.listing.bidDeadlineAt <= new Date()) {
      throw new AppError(409, "LISTING_NOT_OPEN", "Listing no longer accepts bid revisions");
    }

    const terms = validateBidTerms(termsInput, bid.listing);
    const nextVersionNo = bid.currentVersionNo + 1;
    await transaction.bidVersion.create({
      data: {
        bidId,
        versionNo: nextVersionNo,
        ...versionData(terms)
      }
    });
    await transaction.bid.update({
      where: { id: bidId },
      data: {
        currentVersionNo: nextVersionNo,
        version: { increment: 1 }
      }
    });

    await saveIdempotentResource(transaction, idempotency, "BID", bidId, 200);
    await writeAudit(transaction, {
      actorUserId: buyerUserId,
      actionCode: "BID_REVISE",
      entityType: "BID",
      entityId: bidId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash,
      metadata: { versionNo: nextVersionNo }
    });
    return loadBidForResponse(transaction, bidId);
  });
}

export async function listAnonymousBids(farmerUserId: string, listingId: string) {
  const prisma = getPrisma();
  const listing = await prisma.harvestListing.findFirst({
    where: { id: listingId, farm: { ownerUserId: farmerUserId } },
    select: { id: true }
  });
  if (!listing) {
    throw new AppError(404, "LISTING_NOT_FOUND", "Listing was not found");
  }

  const bids = await prisma.bid.findMany({
    where: { listingId },
    select: {
      id: true,
      anonymousLabel: true,
      status: true,
      currentVersionNo: true,
      submittedAt: true,
      versions: {
        orderBy: { versionNo: "desc" },
        take: 1,
        select: {
          versionNo: true,
          unitPriceCopPerKg: true,
          offeredQuantityKg: true,
          transportIncluded: true,
          pickupAtFarm: true,
          sellerLogisticsCostCop: true,
          advanceAmountCop: true,
          paymentTermDays: true,
          continuityMonths: true,
          continuityNotes: true,
          observations: true,
          createdAt: true
        }
      }
    },
    orderBy: { submittedAt: "asc" }
  });

  return bids.map((bid) => {
    const version = bid.versions[0];
    if (!version) {
      throw new AppError(409, "BID_INCOMPLETE", "Bid has no current version");
    }
    const gross = version.unitPriceCopPerKg.mul(version.offeredQuantityKg);
    return {
      id: bid.id,
      anonymousLabel: bid.anonymousLabel,
      status: bid.status,
      currentVersionNo: bid.currentVersionNo,
      submittedAt: bid.submittedAt,
      terms: {
        ...version,
        unitPriceCopPerKg: version.unitPriceCopPerKg.toFixed(2),
        offeredQuantityKg: version.offeredQuantityKg.toFixed(3),
        sellerLogisticsCostCop: version.sellerLogisticsCostCop.toFixed(2),
        advanceAmountCop: version.advanceAmountCop.toFixed(2),
        grossAmountCop: gross.toFixed(2),
        netAmountCop: gross.minus(version.sellerLogisticsCostCop).toFixed(2)
      }
    };
  });
}

export async function awardBid(
  farmerUserId: string,
  listingId: string,
  bidId: string,
  idempotencyKey: string,
  context: RequestContext
) {
  const idempotency: IdempotencyContext = {
    userId: farmerUserId,
    operationCode: "ACCEPT_BID",
    key: idempotencyKey,
    requestBody: { listingId, bidId }
  };

  try {
    return await inSerializableTransaction(async (transaction) => {
      const previousListingId = await findIdempotentResource(transaction, idempotency);
      if (previousListingId) {
        const previous = await transaction.listingAward.findUnique({
          where: { listingId: previousListingId }
        });
        if (!previous) {
          throw new AppError(409, "IDEMPOTENCY_INCOMPLETE", "Award result was not found");
        }
        return previous;
      }

      await transaction.$queryRawUnsafe(
        "SELECT id FROM harvest_listings WHERE id = ? FOR UPDATE",
        listingId
      );
      const listing = await transaction.harvestListing.findUnique({
        where: { id: listingId },
        include: { farm: { select: { ownerUserId: true } } }
      });
      if (!listing || listing.farm.ownerUserId !== farmerUserId) {
        throw new AppError(404, "LISTING_NOT_FOUND", "Listing was not found");
      }
      if (listing.status !== "OPEN") {
        throw new AppError(409, "LISTING_NOT_OPEN", "Listing is not open");
      }
      if (listing.bidDeadlineAt <= new Date()) {
        throw new AppError(409, "LISTING_DEADLINE_PASSED", "Bid deadline has passed");
      }

      await transaction.$queryRawUnsafe("SELECT id FROM bids WHERE id = ? FOR UPDATE", bidId);
      const bid = await transaction.bid.findUnique({ where: { id: bidId } });
      if (!bid || bid.listingId !== listingId) {
        throw new AppError(422, "BID_LISTING_MISMATCH", "Bid does not belong to the listing");
      }
      if (bid.status !== "SUBMITTED") {
        throw new AppError(409, "BID_NOT_ACCEPTABLE", "Bid is not submitted");
      }
      const bidVersion = await transaction.bidVersion.findUnique({
        where: {
          bidId_versionNo: { bidId, versionNo: bid.currentVersionNo }
        }
      });
      if (!bidVersion) {
        throw new AppError(409, "BID_VERSION_STALE", "Current bid version was not found");
      }

      const submittedBids = await transaction.bid.findMany({
        where: { listingId, status: "SUBMITTED" },
        select: { id: true }
      });
      const acceptedAt = new Date();
      const award = await transaction.listingAward.create({
        data: {
          listingId,
          bidId,
          bidVersionNo: bid.currentVersionNo,
          acceptedByUserId: farmerUserId,
          acceptedAt
        }
      });
      await transaction.harvestListing.update({
        where: { id: listingId },
        data: {
          status: "AWARDED",
          closedAt: acceptedAt,
          version: { increment: 1 }
        }
      });
      await transaction.bid.update({
        where: { id: bidId },
        data: { status: "ACCEPTED", version: { increment: 1 } }
      });
      await transaction.bid.updateMany({
        where: { listingId, id: { not: bidId }, status: "SUBMITTED" },
        data: { status: "REJECTED", version: { increment: 1 } }
      });

      await transaction.listingStatusEvent.create({
        data: {
          listingId,
          fromStatus: "OPEN",
          toStatus: "AWARDED",
          changedByUserId: farmerUserId,
          reasonCode: "BID_ACCEPTED"
        }
      });
      await transaction.bidStatusEvent.createMany({
        data: submittedBids.map(({ id }) => ({
          bidId: id,
          fromStatus: "SUBMITTED" as const,
          toStatus: id === bidId ? ("ACCEPTED" as const) : ("REJECTED" as const),
          changedByUserId: farmerUserId,
          reasonCode: id === bidId ? "SELECTED" : "OTHER_BID_SELECTED"
        }))
      });
      await saveIdempotentResource(
        transaction,
        idempotency,
        "LISTING_AWARD",
        listingId,
        200
      );
      await writeAudit(transaction, {
        actorUserId: farmerUserId,
        actionCode: "BID_ACCEPT",
        entityType: "LISTING_AWARD",
        entityId: listingId,
        outcome: "SUCCESS",
        requestId: context.requestId,
        ipHash: context.ipHash,
        metadata: { bidId, bidVersionNo: bid.currentVersionNo }
      });
      return award;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "ALREADY_AWARDED", "Listing already has an accepted bid");
    }
    throw error;
  }
}

export async function revealAwardedBuyerContact(
  farmerUserId: string,
  listingId: string,
  context: RequestContext
) {
  const env = getEnv();
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const award = await transaction.listingAward.findUnique({
      where: { listingId },
      include: {
        listing: { include: { farm: { select: { ownerUserId: true } } } },
        bid: {
          include: {
            buyer: {
              include: {
                privateContact: true,
                buyerProfile: true
              }
            }
          }
        }
      }
    });
    if (!award || award.listing.farm.ownerUserId !== farmerUserId) {
      throw new AppError(404, "AWARD_NOT_FOUND", "Award was not found");
    }
    const buyer = award.bid.buyer;
    const contact = buyer.privateContact;
    if (!contact) {
      throw new AppError(409, "BUYER_CONTACT_MISSING", "Buyer contact is unavailable");
    }

    const email = decryptField(
      contact.emailCiphertext,
      env.CONTACT_ENCRYPTION_KEY_BASE64,
      contactFieldAad(buyer.id, "email", contact.keyVersion)
    );
    const phone = contact.phoneCiphertext
      ? decryptField(
          contact.phoneCiphertext,
          env.CONTACT_ENCRYPTION_KEY_BASE64,
          contactFieldAad(buyer.id, "phone", contact.keyVersion)
        )
      : null;

    if (!award.buyerIdentityRevealedAt) {
      await transaction.listingAward.update({
        where: { listingId },
        data: { buyerIdentityRevealedAt: new Date() }
      });
    }
    await writeAudit(transaction, {
      actorUserId: farmerUserId,
      actionCode: "BUYER_CONTACT_REVEAL",
      entityType: "LISTING_AWARD",
      entityId: listingId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash,
      metadata: { buyerUserId: buyer.id }
    });

    return {
      displayName: buyer.displayName,
      businessName: buyer.buyerProfile?.businessName ?? null,
      email,
      phone
    };
  });
}
