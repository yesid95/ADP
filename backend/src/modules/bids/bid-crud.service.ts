import type { BidStatus, Prisma } from "../../generated/prisma/client.js";
import { getPrisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors.js";
import type { RequestContext } from "../../shared/request-context.js";
import { inSerializableTransaction } from "../../shared/transaction.js";
import { writeAudit } from "../audit/audit.service.js";
import {
  findIdempotentResource,
  saveIdempotentResource,
  type IdempotencyContext
} from "../idempotency/idempotency.service.js";

interface BidPage {
  cursor?: string | undefined;
  limit: number;
  status?: BidStatus | undefined;
}

function serializeVersion<
  T extends {
    unitPriceCopPerKg: Prisma.Decimal;
    offeredQuantityKg: Prisma.Decimal;
    sellerLogisticsCostCop: Prisma.Decimal;
    advanceAmountCop: Prisma.Decimal;
  }
>(version: T) {
  const gross = version.unitPriceCopPerKg.mul(version.offeredQuantityKg);
  return {
    ...version,
    unitPriceCopPerKg: version.unitPriceCopPerKg.toFixed(2),
    offeredQuantityKg: version.offeredQuantityKg.toFixed(3),
    sellerLogisticsCostCop: version.sellerLogisticsCostCop.toFixed(2),
    advanceAmountCop: version.advanceAmountCop.toFixed(2),
    grossAmountCop: gross.toFixed(2),
    netAmountCop: gross.minus(version.sellerLogisticsCostCop).toFixed(2)
  };
}

type BidReader = Pick<Prisma.TransactionClient, "bid">;
const OWN_BID_INCLUDE = {
  listing: {
    select: {
      id: true,
      status: true,
      bidDeadlineAt: true,
      estimatedQuantityKg: true,
      cropVariety: { select: { code: true, name: true } },
      farm: { select: { name: true, publicLocationText: true } }
    }
  },
  versions: { orderBy: { versionNo: "desc" as const } },
  statusEvents: { orderBy: { createdAt: "asc" as const } }
} satisfies Prisma.BidInclude;
type OwnBidRecord = Prisma.BidGetPayload<{ include: typeof OWN_BID_INCLUDE }>;

async function loadOwnBid(
  buyerUserId: string,
  bidId: string,
  client: BidReader = getPrisma()
) {
  const bid = (await client.bid.findFirst({
    where: { id: bidId, buyerUserId },
    include: OWN_BID_INCLUDE
  })) as OwnBidRecord | null;
  if (!bid) {
    throw new AppError(404, "BID_NOT_FOUND", "Bid was not found");
  }
  return {
    ...bid,
    listing: {
      ...bid.listing,
      estimatedQuantityKg: bid.listing.estimatedQuantityKg.toFixed(3)
    },
    versions: bid.versions.map(serializeVersion),
    statusEvents: bid.statusEvents.map((event) => ({
      ...event,
      id: event.id.toString()
    }))
  };
}

export async function listOwnBids(buyerUserId: string, page: BidPage) {
  const rows = await getPrisma().bid.findMany({
    where: {
      buyerUserId,
      ...(page.status ? { status: page.status } : {})
    },
    include: {
      listing: {
        select: {
          id: true,
          status: true,
          availableFromDate: true,
          bidDeadlineAt: true,
          cropVariety: { select: { code: true, name: true } },
          farm: { select: { name: true, publicLocationText: true } }
        }
      },
      versions: { orderBy: { versionNo: "desc" }, take: 1 }
    },
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    take: page.limit + 1,
    ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {})
  });
  const hasMore = rows.length > page.limit;
  const selected = hasMore ? rows.slice(0, page.limit) : rows;
  return {
    data: selected.map((bid) => ({
      ...bid,
      currentVersion: bid.versions[0] ? serializeVersion(bid.versions[0]) : null,
      versions: undefined
    })),
    page: {
      nextCursor: hasMore ? (selected[selected.length - 1]?.id ?? null) : null
    }
  };
}

export async function getOwnBidHistory(buyerUserId: string, bidId: string) {
  return loadOwnBid(buyerUserId, bidId);
}

export async function withdrawBid(
  buyerUserId: string,
  bidId: string,
  idempotencyKey: string,
  context: RequestContext
) {
  const idempotency: IdempotencyContext = {
    userId: buyerUserId,
    operationCode: "WITHDRAW_BID",
    key: idempotencyKey,
    requestBody: { bidId }
  };

  return inSerializableTransaction(async (transaction) => {
    const previousBidId = await findIdempotentResource(transaction, idempotency);
    if (previousBidId) {
      return loadOwnBid(buyerUserId, previousBidId, transaction);
    }

    await transaction.$queryRawUnsafe("SELECT id FROM bids WHERE id = ? FOR UPDATE", bidId);
    const bid = await transaction.bid.findFirst({
      where: { id: bidId, buyerUserId },
      select: { id: true, status: true }
    });
    if (!bid) {
      throw new AppError(404, "BID_NOT_FOUND", "Bid was not found");
    }
    if (bid.status !== "SUBMITTED") {
      throw new AppError(409, "BID_NOT_WITHDRAWABLE", "Only submitted bids can be withdrawn");
    }
    const withdrawnAt = new Date();
    await transaction.bid.update({
      where: { id: bidId },
      data: {
        status: "WITHDRAWN",
        withdrawnAt,
        version: { increment: 1 }
      }
    });
    await transaction.bidStatusEvent.create({
      data: {
        bidId,
        fromStatus: "SUBMITTED",
        toStatus: "WITHDRAWN",
        changedByUserId: buyerUserId,
        reasonCode: "BUYER_WITHDREW"
      }
    });
    await saveIdempotentResource(transaction, idempotency, "BID", bidId, 200);
    await writeAudit(transaction, {
      actorUserId: buyerUserId,
      actionCode: "BID_WITHDRAW",
      entityType: "BID",
      entityId: bidId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash
    });

    return loadOwnBid(buyerUserId, bidId, transaction);
  });
}
