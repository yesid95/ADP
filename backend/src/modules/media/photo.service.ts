import { randomUUID } from "node:crypto";
import { getPrisma } from "../../infrastructure/database/prisma.js";
import { sha256 } from "../../shared/crypto.js";
import { AppError } from "../../shared/errors.js";
import type { RequestContext } from "../../shared/request-context.js";
import { inSerializableTransaction } from "../../shared/transaction.js";
import { writeAudit } from "../audit/audit.service.js";
import {
  readPrivatePhoto,
  removePrivatePhoto,
  writePrivatePhoto
} from "./photo-storage.js";

const MAX_PHOTOS_PER_LISTING = 20;

type SupportedMimeType = "image/jpeg" | "image/png" | "image/webp";

function extensionFor(mimeType: SupportedMimeType): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  return "webp";
}

function hasValidSignature(contents: Buffer, mimeType: SupportedMimeType): boolean {
  if (mimeType === "image/jpeg") {
    return contents.length >= 3 && contents[0] === 0xff && contents[1] === 0xd8 && contents[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return (
      contents.length >= 8 &&
      contents.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  return (
    contents.length >= 12 &&
    contents.subarray(0, 4).toString("ascii") === "RIFF" &&
    contents.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function photoDto(photo: {
  id: string;
  listingId: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  createdAt: Date;
}) {
  return {
    id: photo.id,
    mimeType: photo.mimeType,
    sizeBytes: photo.sizeBytes,
    sortOrder: photo.sortOrder,
    createdAt: photo.createdAt,
    url: `/api/v1/listings/${photo.listingId}/photos/${photo.id}`
  };
}

export async function uploadHarvestPhoto(
  ownerUserId: string,
  listingId: string,
  contents: Buffer,
  mimeType: SupportedMimeType,
  requestedSortOrder: number | undefined,
  context: RequestContext
) {
  if (contents.length === 0 || !hasValidSignature(contents, mimeType)) {
    throw new AppError(422, "PHOTO_CONTENT_INVALID", "Photo signature does not match its MIME type");
  }

  const id = randomUUID();
  const storageKey = `harvest/${listingId}/${id}.${extensionFor(mimeType)}`;
  await writePrivatePhoto(storageKey, contents);

  try {
    return await inSerializableTransaction(async (transaction) => {
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
      if (listing.status !== "DRAFT") {
        throw new AppError(409, "LISTING_NOT_DRAFT", "Photos can only be changed on drafts");
      }
      const existing = await transaction.harvestPhoto.findMany({
        where: { listingId },
        select: { sortOrder: true },
        orderBy: { sortOrder: "asc" }
      });
      if (existing.length >= MAX_PHOTOS_PER_LISTING) {
        throw new AppError(409, "PHOTO_LIMIT_REACHED", "A listing can contain up to 20 photos");
      }
      const sortOrder = requestedSortOrder ?? existing.length;
      if (sortOrder < 0 || sortOrder >= MAX_PHOTOS_PER_LISTING) {
        throw new AppError(422, "PHOTO_ORDER_INVALID", "Photo order must be between 0 and 19");
      }

      const photo = await transaction.harvestPhoto.create({
        data: {
          id,
          listingId,
          storageKey,
          mimeType,
          sizeBytes: contents.length,
          sha256: sha256(contents),
          sortOrder
        }
      });
      await writeAudit(transaction, {
        actorUserId: ownerUserId,
        actionCode: "LISTING_PHOTO_UPLOAD",
        entityType: "HARVEST_PHOTO",
        entityId: id,
        outcome: "SUCCESS",
        requestId: context.requestId,
        ipHash: context.ipHash,
        metadata: { listingId, mimeType, sizeBytes: contents.length }
      });
      return photoDto(photo);
    });
  } catch (error) {
    await removePrivatePhoto(storageKey);
    throw error;
  }
}

export async function readPublicHarvestPhoto(listingId: string, photoId: string) {
  const photo = await getPrisma().harvestPhoto.findFirst({
    where: {
      id: photoId,
      listingId,
      listing: {
        status: "OPEN",
        bidDeadlineAt: { gt: new Date() },
        deletedAt: null,
        farm: { status: "ACTIVE", deletedAt: null }
      }
    },
    select: { storageKey: true, mimeType: true, sha256: true }
  });
  if (!photo) {
    throw new AppError(404, "PHOTO_NOT_FOUND", "Photo was not found");
  }
  const contents = await readPrivatePhoto(photo.storageKey);
  if (!Buffer.from(sha256(contents)).equals(Buffer.from(photo.sha256))) {
    throw new AppError(409, "PHOTO_INTEGRITY_FAILED", "Stored photo failed integrity verification");
  }
  return { contents, mimeType: photo.mimeType };
}

export async function readOwnHarvestPhoto(
  ownerUserId: string,
  listingId: string,
  photoId: string
) {
  const photo = await getPrisma().harvestPhoto.findFirst({
    where: { id: photoId, listingId, listing: { farm: { ownerUserId } } },
    select: { storageKey: true, mimeType: true, sha256: true }
  });
  if (!photo) {
    throw new AppError(404, "PHOTO_NOT_FOUND", "Photo was not found");
  }
  const contents = await readPrivatePhoto(photo.storageKey);
  if (!Buffer.from(sha256(contents)).equals(Buffer.from(photo.sha256))) {
    throw new AppError(409, "PHOTO_INTEGRITY_FAILED", "Stored photo failed integrity verification");
  }
  return { contents, mimeType: photo.mimeType };
}

export async function deleteHarvestPhoto(
  ownerUserId: string,
  listingId: string,
  photoId: string,
  context: RequestContext
): Promise<void> {
  const storageKey = await inSerializableTransaction(async (transaction) => {
    await transaction.$queryRawUnsafe(
      "SELECT id FROM harvest_listings WHERE id = ? FOR UPDATE",
      listingId
    );
    const photo = await transaction.harvestPhoto.findFirst({
      where: { id: photoId, listingId, listing: { farm: { ownerUserId }, status: "DRAFT" } },
      select: { storageKey: true }
    });
    if (!photo) {
      throw new AppError(404, "PHOTO_NOT_FOUND", "Editable photo was not found");
    }
    await transaction.harvestPhoto.delete({ where: { id: photoId } });
    await writeAudit(transaction, {
      actorUserId: ownerUserId,
      actionCode: "LISTING_PHOTO_DELETE",
      entityType: "HARVEST_PHOTO",
      entityId: photoId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash,
      metadata: { listingId }
    });
    return photo.storageKey;
  });
  await removePrivatePhoto(storageKey);
}

export async function reorderHarvestPhotos(
  ownerUserId: string,
  listingId: string,
  photoIds: string[],
  context: RequestContext
): Promise<void> {
  await inSerializableTransaction(async (transaction) => {
    await transaction.$queryRawUnsafe(
      "SELECT id FROM harvest_listings WHERE id = ? FOR UPDATE",
      listingId
    );
    const listing = await transaction.harvestListing.findFirst({
      where: { id: listingId, farm: { ownerUserId }, status: "DRAFT", deletedAt: null },
      select: { id: true }
    });
    if (!listing) {
      throw new AppError(404, "LISTING_NOT_FOUND", "Editable listing was not found");
    }
    const photos = await transaction.harvestPhoto.findMany({
      where: { listingId },
      select: { id: true }
    });
    if (
      photos.length !== photoIds.length ||
      !photos.every(({ id }) => photoIds.includes(id))
    ) {
      throw new AppError(422, "PHOTO_ORDER_INCOMPLETE", "Order must contain every listing photo once");
    }

    for (let index = 0; index < photoIds.length; index += 1) {
      await transaction.harvestPhoto.update({
        where: { id: photoIds[index]! },
        data: { sortOrder: 60_000 + index }
      });
    }
    for (let index = 0; index < photoIds.length; index += 1) {
      await transaction.harvestPhoto.update({
        where: { id: photoIds[index]! },
        data: { sortOrder: index }
      });
    }
    await writeAudit(transaction, {
      actorUserId: ownerUserId,
      actionCode: "LISTING_PHOTO_REORDER",
      entityType: "HARVEST_LISTING",
      entityId: listingId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      ipHash: context.ipHash,
      metadata: { photoCount: photoIds.length }
    });
  });
}
