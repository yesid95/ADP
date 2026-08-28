import { Router } from "express";
import { z } from "zod";
import { authenticate, requireActor, requireRole } from "../../middleware/auth.js";
import { getRequestContext } from "../../shared/request-context.js";
import { readIdempotencyKey } from "../idempotency/idempotency.service.js";
import {
  awardBid,
  listAnonymousBids,
  revealAwardedBuyerContact,
  reviseBid,
  submitBid
} from "./bid.service.js";

const uuidSchema = z.uuid();
const quantity = z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/);
const money = z.string().regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/);

const bidTermsSchema = z.object({
  unitPriceCopPerKg: money,
  offeredQuantityKg: quantity,
  transportIncluded: z.boolean(),
  pickupAtFarm: z.boolean(),
  sellerLogisticsCostCop: money.default("0"),
  advanceAmountCop: money.default("0"),
  paymentTermDays: z.number().int().min(0).max(365),
  continuityMonths: z.number().int().min(1).max(120).optional(),
  continuityNotes: z.string().trim().max(500).optional(),
  observations: z.string().trim().max(2_000).optional()
});

export function createBidRouter(): Router {
  const router = Router();

  router.post(
    "/listings/:listingId/bids",
    authenticate,
    requireRole("BUYER"),
    async (request, response) => {
      const actor = requireActor(request);
      const { listingId } = z.object({ listingId: uuidSchema }).parse(request.params);
      const terms = bidTermsSchema.parse(request.body);
      const bid = await submitBid(
        actor.userId,
        listingId,
        terms,
        readIdempotencyKey(request.headers),
        getRequestContext(request)
      );
      response.status(201).json({ data: bid });
    }
  );

  router.post(
    "/bids/:bidId/versions",
    authenticate,
    requireRole("BUYER"),
    async (request, response) => {
      const actor = requireActor(request);
      const { bidId } = z.object({ bidId: uuidSchema }).parse(request.params);
      const bid = await reviseBid(
        actor.userId,
        bidId,
        bidTermsSchema.parse(request.body),
        readIdempotencyKey(request.headers),
        getRequestContext(request)
      );
      response.json({ data: bid });
    }
  );

  router.get(
    "/listings/:listingId/bids",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      const { listingId } = z.object({ listingId: uuidSchema }).parse(request.params);
      response.json({ data: await listAnonymousBids(actor.userId, listingId) });
    }
  );

  router.post(
    "/listings/:listingId/award",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      const { listingId } = z.object({ listingId: uuidSchema }).parse(request.params);
      const { bidId } = z.object({ bidId: uuidSchema }).parse(request.body);
      const award = await awardBid(
        actor.userId,
        listingId,
        bidId,
        readIdempotencyKey(request.headers),
        getRequestContext(request)
      );
      response.json({ data: award });
    }
  );

  router.get(
    "/listings/:listingId/award/contact",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      const { listingId } = z.object({ listingId: uuidSchema }).parse(request.params);
      response.json({
        data: await revealAwardedBuyerContact(
          actor.userId,
          listingId,
          getRequestContext(request)
        )
      });
    }
  );

  return router;
}
