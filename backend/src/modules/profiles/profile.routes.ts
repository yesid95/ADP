import { Router } from "express";
import { z } from "zod";
import { authenticate, requireActor, requireRole } from "../../middleware/auth.js";
import { getRequestContext } from "../../shared/request-context.js";
import {
  deleteOwnAccount,
  getOwnProfile,
  replaceBuyerInterests,
  updateBuyerProfile,
  updateFarmerProfile,
  updateOwnIdentity
} from "./profile.service.js";

const buyerTypeSchema = z.enum([
  "WHOLESALER",
  "DISTRIBUTOR",
  "STORE",
  "RESTAURANT",
  "TRANSPORTER"
]);
const quantity = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/)
  .refine((value) => Number(value) > 0);

const identitySchema = z.object({
  displayName: z.string().trim().min(2).max(120)
});
const farmerProfileSchema = z.object({
  publicBio: z.string().trim().max(2_000).nullable()
});
const buyerProfileSchema = z.object({
  businessName: z.string().trim().min(2).max(160).nullable(),
  buyerType: buyerTypeSchema,
  description: z.string().trim().max(2_000).nullable()
});
const buyerInterestsSchema = z.object({
  crops: z
    .array(
      z.object({
        cropVarietyId: z.number().int().positive().max(65_535),
        minimumQuantityKg: quantity.optional(),
        maximumQuantityKg: quantity.optional()
      })
    )
    .max(100)
    .refine(
      (items) => new Set(items.map(({ cropVarietyId }) => cropVarietyId)).size === items.length,
      "Crop interests must be unique"
    ),
  municipalityIds: z
    .array(z.number().int().positive().max(65_535))
    .max(100)
    .refine((items) => new Set(items).size === items.length, "Municipalities must be unique")
});

export function createProfileRouter(): Router {
  const router = Router();

  router.get("/me", authenticate, async (request, response) => {
    const actor = requireActor(request);
    response.json({ data: await getOwnProfile(actor.userId) });
  });

  router.patch("/me", authenticate, async (request, response) => {
    const actor = requireActor(request);
    const { displayName } = identitySchema.parse(request.body);
    response.json({
      data: await updateOwnIdentity(
        actor.userId,
        displayName,
        getRequestContext(request)
      )
    });
  });

  router.put(
    "/me/farmer-profile",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      const { publicBio } = farmerProfileSchema.parse(request.body);
      response.json({
        data: await updateFarmerProfile(
          actor.userId,
          publicBio,
          getRequestContext(request)
        )
      });
    }
  );

  router.put(
    "/me/buyer-profile",
    authenticate,
    requireRole("BUYER"),
    async (request, response) => {
      const actor = requireActor(request);
      response.json({
        data: await updateBuyerProfile(
          actor.userId,
          buyerProfileSchema.parse(request.body),
          getRequestContext(request)
        )
      });
    }
  );

  router.put(
    "/me/buyer-interests",
    authenticate,
    requireRole("BUYER"),
    async (request, response) => {
      const actor = requireActor(request);
      const input = buyerInterestsSchema.parse(request.body);
      response.json({
        data: await replaceBuyerInterests(
          actor.userId,
          input.crops,
          input.municipalityIds,
          getRequestContext(request)
        )
      });
    }
  );

  router.delete("/me", authenticate, async (request, response) => {
    const actor = requireActor(request);
    await deleteOwnAccount(actor.userId, getRequestContext(request));
    response.status(204).send();
  });

  return router;
}
