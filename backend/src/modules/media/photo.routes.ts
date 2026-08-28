import { raw, Router, type Response } from "express";
import { z } from "zod";
import { getEnv } from "../../config/env.js";
import { authenticate, requireActor, requireRole } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors.js";
import { getRequestContext } from "../../shared/request-context.js";
import {
  deleteHarvestPhoto,
  readOwnHarvestPhoto,
  readPublicHarvestPhoto,
  reorderHarvestPhotos,
  uploadHarvestPhoto
} from "./photo.service.js";

const uuidSchema = z.uuid();
const pathSchema = z.object({ listingId: uuidSchema, photoId: uuidSchema });
const supportedMime = z.enum(["image/jpeg", "image/png", "image/webp"]);

function sendPhoto(
  response: Response,
  photo: { contents: Buffer; mimeType: string },
  cacheControl: string
): void {
  response.setHeader("content-type", photo.mimeType);
  response.setHeader("content-length", String(photo.contents.length));
  response.setHeader("cache-control", cacheControl);
  response.send(photo.contents);
}

export function createPhotoRouter(): Router {
  const router = Router();
  const photoBody = raw({
    type: ["image/jpeg", "image/png", "image/webp"],
    limit: getEnv().MAX_PHOTO_BYTES
  });

  router.post(
    "/listings/:listingId/photos",
    authenticate,
    requireRole("FARMER"),
    photoBody,
    async (request, response) => {
      const actor = requireActor(request);
      const { listingId } = z.object({ listingId: uuidSchema }).parse(request.params);
      const mimeType = supportedMime.parse(request.get("content-type"));
      if (!Buffer.isBuffer(request.body)) {
        throw new AppError(422, "PHOTO_BODY_REQUIRED", "A binary photo body is required");
      }
      const sortHeader = request.get("x-sort-order");
      const sortOrder = sortHeader
        ? z.coerce.number().int().min(0).max(19).parse(sortHeader)
        : undefined;
      const photo = await uploadHarvestPhoto(
        actor.userId,
        listingId,
        request.body,
        mimeType,
        sortOrder,
        getRequestContext(request)
      );
      response.status(201).json({ data: photo });
    }
  );

  router.put(
    "/listings/:listingId/photos/order",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      const { listingId } = z.object({ listingId: uuidSchema }).parse(request.params);
      const { photoIds } = z
        .object({
          photoIds: z
            .array(uuidSchema)
            .max(20)
            .refine((ids) => new Set(ids).size === ids.length, "Photo IDs must be unique")
        })
        .parse(request.body);
      await reorderHarvestPhotos(
        actor.userId,
        listingId,
        photoIds,
        getRequestContext(request)
      );
      response.status(204).send();
    }
  );

  router.delete(
    "/listings/:listingId/photos/:photoId",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      const { listingId, photoId } = pathSchema.parse(request.params);
      await deleteHarvestPhoto(
        actor.userId,
        listingId,
        photoId,
        getRequestContext(request)
      );
      response.status(204).send();
    }
  );

  router.get("/listings/:listingId/photos/:photoId", async (request, response) => {
    const { listingId, photoId } = pathSchema.parse(request.params);
    sendPhoto(
      response,
      await readPublicHarvestPhoto(listingId, photoId),
      "public, max-age=300"
    );
  });

  router.get(
    "/me/listings/:listingId/photos/:photoId",
    authenticate,
    requireRole("FARMER"),
    async (request, response) => {
      const actor = requireActor(request);
      const { listingId, photoId } = pathSchema.parse(request.params);
      sendPhoto(
        response,
        await readOwnHarvestPhoto(actor.userId, listingId, photoId),
        "private, no-store"
      );
    }
  );

  return router;
}
