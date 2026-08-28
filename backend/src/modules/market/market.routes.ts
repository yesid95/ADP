import { Router } from "express";
import { z } from "zod";
import { authenticate, requireActor, requireRole } from "../../middleware/auth.js";
import { getRequestContext } from "../../shared/request-context.js";
import {
  createFarm,
  createHarvestListing,
  publishHarvestListing
} from "./market.service.js";
import {
  archiveFarm,
  cancelListing,
  closeListing,
  getOwnFarm,
  getPublicListing,
  listOwnFarms,
  listOwnListings,
  listPublicListings,
  updateDraftListing,
  updateFarm
} from "./market-crud.service.js";
import { getPublicCatalog } from "./catalog.service.js";

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

const farmUpdateSchema = z
  .object({
    municipalityId: z.number().int().positive().max(65_535).optional(),
    name: z.string().trim().min(2).max(160).optional(),
    vereda: z.string().trim().min(2).max(120).optional(),
    publicLocationText: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(2_000).nullable().optional(),
    roadAccessNotes: z.string().trim().max(500).nullable().optional(),
    productiveHectares: hectaresDecimal
      .refine((value) => Number(value) > 0)
      .nullable()
      .optional()
  })
  .refine((input) => Object.keys(input).length > 0, "At least one field is required");

const listingUpdateSchema = z
  .object({
    cropVarietyId: z.number().int().positive().max(65_535).optional(),
    estimatedQuantityKg: quantityDecimal
      .refine((value) => Number(value) > 0)
      .optional(),
    availableFromDate: z.iso.date().optional(),
    cropConditionNotes: z.string().trim().max(500).nullable().optional(),
    expectedPriceCopPerKg: positiveMoney
      .refine((value) => Number(value) > 0)
      .nullable()
      .optional(),
    allowsPartialPurchase: z.boolean().optional(),
    bidDeadlineAt: z.iso.datetime({ offset: true }).optional()
  })
  .refine((input) => Object.keys(input).length > 0, "At least one field is required");

const pageSchema = z.object({
  cursor: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
const publicListingQuerySchema = pageSchema.extend({
  municipalityId: z.coerce.number().int().positive().max(65_535).optional(),
  cropVarietyId: z.coerce.number().int().positive().max(65_535).optional(),
  availableFrom: z.iso.date().optional(),
  availableTo: z.iso.date().optional()
});
const ownListingQuerySchema = pageSchema.extend({
  status: z.enum(["DRAFT", "OPEN", "CLOSED", "AWARDED", "CANCELLED"]).optional()
});

export function createMarketRouter(): Router {
  const router = Router();

  router.get("/catalogs", async (_request, response) => {
    response.json({ data: await getPublicCatalog() });
  });

  router.get("/listings", async (request, response) => {
    response.json(await listPublicListings(publicListingQuerySchema.parse(request.query)));
  });

  router.get("/listings/:listingId", async (request, response) => {
    const { listingId } = z.object({ listingId: uuidSchema }).parse(request.params);
    response.json({ data: await getPublicListing(listingId) });
  });

  router.get(
    "/farms",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      response.json(await listOwnFarms(actor.userId, pageSchema.parse(request.query)));
    }
  );

  router.get(
    "/farms/:farmId",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      const { farmId } = z.object({ farmId: uuidSchema }).parse(request.params);
      response.json({ data: await getOwnFarm(actor.userId, farmId) });
    }
  );

  router.patch(
    "/farms/:farmId",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      const { farmId } = z.object({ farmId: uuidSchema }).parse(request.params);
      response.json({
        data: await updateFarm(
          actor.userId,
          farmId,
          farmUpdateSchema.parse(request.body),
          getRequestContext(request)
        )
      });
    }
  );

  router.delete(
    "/farms/:farmId",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      const { farmId } = z.object({ farmId: uuidSchema }).parse(request.params);
      await archiveFarm(actor.userId, farmId, getRequestContext(request));
      response.status(204).send();
    }
  );

  router.get(
    "/me/listings",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      response.json(
        await listOwnListings(actor.userId, ownListingQuerySchema.parse(request.query))
      );
    }
  );

  router.patch(
    "/listings/:listingId",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      const { listingId } = z.object({ listingId: uuidSchema }).parse(request.params);
      response.json({
        data: await updateDraftListing(
          actor.userId,
          listingId,
          listingUpdateSchema.parse(request.body),
          getRequestContext(request)
        )
      });
    }
  );

  router.delete(
    "/listings/:listingId",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      const { listingId } = z.object({ listingId: uuidSchema }).parse(request.params);
      await cancelListing(actor.userId, listingId, getRequestContext(request));
      response.status(204).send();
    }
  );

  router.post(
    "/listings/:listingId/close",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      const { listingId } = z.object({ listingId: uuidSchema }).parse(request.params);
      await closeListing(actor.userId, listingId, getRequestContext(request));
      response.status(204).send();
    }
  );

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
