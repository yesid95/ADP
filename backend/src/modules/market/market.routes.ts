import { Router } from "express";
import { z } from "zod";
import { authenticate, requireActor, requireRole } from "../../middleware/auth.js";
import { getRequestContext } from "../../shared/request-context.js";
import {
  createFarm,
  createHarvestListing,
  listOpenHarvestListings,
  publishHarvestListing
} from "./market.service.js";

const uuidSchema = z.uuid();
const quantityDecimal = z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/);
const positiveMoney = z.string().regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/);
const hectaresDecimal = z.string().regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/);

const farmSchema = z.object({
  municipalityId: z.number().int().positive().max(65_535),
  name: z.string().trim().min(2).max(160),
  vereda: z.string().trim().min(2).max(120),
  publicLocationText: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2_000).optional(),
  roadAccessNotes: z.string().trim().max(500).optional(),
  productiveHectares: hectaresDecimal.refine((value) => Number(value) > 0).optional()
});

const listingSchema = z.object({
  farmId: uuidSchema,
  cropVarietyId: z.number().int().positive().max(65_535),
  estimatedQuantityKg: quantityDecimal.refine((value) => Number(value) > 0),
  availableFromDate: z.iso.date(),
  cropConditionNotes: z.string().trim().max(500).optional(),
  expectedPriceCopPerKg: positiveMoney.refine((value) => Number(value) > 0).optional(),
  allowsPartialPurchase: z.boolean().default(false),
  bidDeadlineAt: z.iso.datetime({ offset: true })
});

export function createMarketRouter(): Router {
  const router = Router();

  router.get("/listings", async (_request, response) => {
    response.json({ data: await listOpenHarvestListings() });
  });

  router.post(
    "/farms",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      const farm = await createFarm(
        actor.userId,
        farmSchema.parse(request.body),
        getRequestContext(request)
      );
      response.status(201).json({ data: farm });
    }
  );

  router.post(
    "/listings",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      const listing = await createHarvestListing(
        actor.userId,
        listingSchema.parse(request.body),
        getRequestContext(request)
      );
      response.status(201).json({
        data: {
          ...listing,
          estimatedQuantityKg: listing.estimatedQuantityKg.toFixed(3),
          expectedPriceCopPerKg: listing.expectedPriceCopPerKg?.toFixed(2) ?? null
        }
      });
    }
  );

  router.post(
    "/listings/:listingId/publish",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      const { listingId } = z.object({ listingId: uuidSchema }).parse(request.params);
      const listing = await publishHarvestListing(
        actor.userId,
        listingId,
        getRequestContext(request)
      );
      response.json({ data: listing });
    }
  );

  return router;
}
