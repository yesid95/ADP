import { randomUUID } from "node:crypto";
import request from "supertest";
import mariadb, { type Connection } from "mariadb";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  disconnectPrisma,
  getPrisma
} from "../../src/infrastructure/database/prisma.js";
import { currentTotpStep, totpAtStep } from "../../src/shared/totp.js";
import { databaseBytesEqual } from "../../src/shared/crypto.js";
import {
  verifyAuditEventHash,
  type AuditInput
} from "../../src/modules/audit/audit.service.js";
import { getEnv } from "../../src/config/env.js";

interface TestAccount {
  userId: string;
  email: string;
  phone: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  password: string;
}

const app = createApp();
const prisma = getPrisma();
const runId = randomUUID();
const runDigits = BigInt(`0x${runId.replaceAll("-", "").slice(0, 12)}`)
  .toString()
  .slice(-8)
  .padStart(8, "0");

function authorization(accessToken: string): string {
  return `Bearer ${accessToken}`;
}

async function createVerifiedAccount(
  role: "FARMER" | "BUYER",
  label: string
): Promise<TestAccount> {
  const email = `${label}.${runId}@example.test`;
  const phoneSuffix =
    { farmer: "1", "buyer-a": "2", "buyer-b": "3", admin: "4", managed: "5" }[
      label
    ] ?? "9";
  const phone = `+573${runDigits}${phoneSuffix}`;
  const displayName = `Integration ${label}`;
  const password = "Integration-Password-2026!";

  const registration = await request(app)
    .post("/api/v1/auth/register")
    .send({
      displayName,
      email,
      phone,
      password,
      roles: [role],
      ...(role === "BUYER" ? { buyerType: "DISTRIBUTOR" } : {})
    });

  expect(registration.status, JSON.stringify(registration.body)).toBe(201);
  expect(registration.body.verificationToken).toBeTypeOf("string");

  const verification = await request(app)
    .post("/api/v1/auth/verify-email")
    .send({ token: registration.body.verificationToken });
  expect(verification.status).toBe(204);

  const login = await request(app).post("/api/v1/auth/login").send({
    email,
    password
  });
  expect(login.status).toBe(200);
  expect(login.body.accessToken).toBeTypeOf("string");

  return {
    userId: registration.body.user.id,
    email,
    phone,
    displayName,
    accessToken: login.body.accessToken,
    refreshToken: login.body.refreshToken,
    password
  };
}

afterAll(async () => {
  await disconnectPrisma();
});

describe("MySQL 8.4 integration", () => {
  it("has the migrated relational contract and territorial seed", async () => {
    const versionRows = await prisma.$queryRawUnsafe<Array<{ version: string }>>(
      "SELECT VERSION() AS version"
    );
    const foreignKeyRows = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      "SELECT COUNT(*) AS total FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE()"
    );
    const checkRows = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      "SELECT COUNT(*) AS total FROM information_schema.check_constraints WHERE constraint_schema = DATABASE()"
    );

    expect(versionRows[0]?.version).toMatch(/^8\.4\./);
    expect(Number(foreignKeyRows[0]?.total)).toBeGreaterThanOrEqual(34);
    expect(Number(checkRows[0]?.total)).toBeGreaterThanOrEqual(30);
    const anonymousViewColumns = await prisma.$queryRawUnsafe<Array<{ columnName: string }>>(
      "SELECT COLUMN_NAME AS columnName FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'v_anonymous_bid_latest' ORDER BY ORDINAL_POSITION"
    );
    expect(anonymousViewColumns.map(({ columnName }) => columnName)).not.toContain(
      "buyer_user_id"
    );
    expect(anonymousViewColumns.map(({ columnName }) => columnName)).toContain(
      "anonymous_label"
    );
    await expect(prisma.municipality.count()).resolves.toBe(19);
    await expect(
      prisma.cropVariety.findUnique({ where: { code: "PLATANO_HARTON" } })
    ).resolves.toMatchObject({ isActive: true });
  });

  it("persists the complete anonymous bid and concurrent award lifecycle", async () => {
    const initialAuditHead = await prisma.auditChainHead.findUniqueOrThrow({
      where: { id: 1 }
    });
    const [farmer, buyerA, buyerB, admin, managed] = await Promise.all([
      createVerifiedAccount("FARMER", "farmer"),
      createVerifiedAccount("BUYER", "buyer-a"),
      createVerifiedAccount("BUYER", "buyer-b"),
      createVerifiedAccount("BUYER", "admin"),
      createVerifiedAccount("FARMER", "managed")
    ]);

    await prisma.userRole.create({
      data: { userId: admin.userId, roleCode: "ADMIN" }
    });
    const adminLogin = await request(app).post("/api/v1/auth/login").send({
      email: admin.email,
      password: admin.password
    });
    expect(adminLogin.status).toBe(200);
    expect(adminLogin.body).toMatchObject({ mfaRequired: true, mfaVerified: false });
    admin.accessToken = adminLogin.body.accessToken;

    const adminWithoutMfa = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", authorization(admin.accessToken));
    expect(adminWithoutMfa.status).toBe(403);
    expect(adminWithoutMfa.body.error.code).toBe("MFA_REQUIRED");

    const enrollment = await request(app)
      .post("/api/v1/me/mfa/totp/enroll")
      .set("Authorization", authorization(admin.accessToken))
      .send({ password: admin.password });
    expect(enrollment.status).toBe(201);
    expect(enrollment.body.data.otpauthUri).toContain("otpauth://totp/");
    const mfaCode = totpAtStep(enrollment.body.data.secret, currentTotpStep());
    const confirmation = await request(app)
      .post("/api/v1/me/mfa/totp/confirm")
      .set("Authorization", authorization(admin.accessToken))
      .send({ code: mfaCode });
    expect(confirmation.status).toBe(200);
    expect(confirmation.body.data.recoveryCodes).toHaveLength(10);
    admin.accessToken = confirmation.body.data.accessToken;

    const adminUsers = await request(app)
      .get("/api/v1/admin/users?role=FARMER&limit=100")
      .set("Authorization", authorization(admin.accessToken));
    expect(adminUsers.status).toBe(200);
    expect(adminUsers.body.data.some(({ id }: { id: string }) => id === managed.userId)).toBe(
      true
    );

    const replayedTotp = await request(app).post("/api/v1/auth/login").send({
      email: admin.email,
      password: admin.password,
      mfaCode
    });
    expect(replayedTotp.status).toBe(409);
    expect(replayedTotp.body.error.code).toBe("MFA_CODE_REUSED");

    const recoveryCode = confirmation.body.data.recoveryCodes[0] as string;
    const recoveryLogin = await request(app).post("/api/v1/auth/login").send({
      email: admin.email,
      password: admin.password,
      mfaCode: recoveryCode
    });
    expect(recoveryLogin.status).toBe(200);
    expect(recoveryLogin.body.mfaVerified).toBe(true);
    const recoveryReuse = await request(app).post("/api/v1/auth/login").send({
      email: admin.email,
      password: admin.password,
      mfaCode: recoveryCode
    });
    expect(recoveryReuse.status).toBe(401);
    admin.accessToken = recoveryLogin.body.accessToken;

    const managedRoles = await request(app)
      .put(`/api/v1/admin/users/${managed.userId}/roles`)
      .set("Authorization", authorization(admin.accessToken))
      .send({ roles: ["FARMER", "BUYER"], buyerType: "STORE" });
    expect(managedRoles.status).toBe(200);
    expect(
      managedRoles.body.data.roles
        .map(({ roleCode }: { roleCode: string }) => roleCode)
        .sort()
    ).toEqual(["BUYER", "FARMER"]);
    const revokedByRoleChange = await request(app)
      .get("/api/v1/me")
      .set("Authorization", authorization(managed.accessToken));
    expect(revokedByRoleChange.status).toBe(401);
    const managedLogin = await request(app).post("/api/v1/auth/login").send({
      email: managed.email,
      password: managed.password
    });
    expect(managedLogin.status).toBe(200);
    managed.accessToken = managedLogin.body.accessToken;

    const suspendManaged = await request(app)
      .patch(`/api/v1/admin/users/${managed.userId}/status`)
      .set("Authorization", authorization(admin.accessToken))
      .send({ status: "SUSPENDED" });
    expect(suspendManaged.status).toBe(200);
    const suspendedSession = await request(app)
      .get("/api/v1/me")
      .set("Authorization", authorization(managed.accessToken));
    expect(suspendedSession.status).toBe(401);
    const restoreManaged = await request(app)
      .patch(`/api/v1/admin/users/${managed.userId}/status`)
      .set("Authorization", authorization(admin.accessToken))
      .send({ status: "ACTIVE" });
    expect(restoreManaged.status).toBe(200);
    const selfRoleChange = await request(app)
      .put(`/api/v1/admin/users/${admin.userId}/roles`)
      .set("Authorization", authorization(admin.accessToken))
      .send({ roles: ["BUYER"] });
    expect(selfRoleChange.status).toBe(409);
    const municipality = await prisma.municipality.findUniqueOrThrow({
      where: { daneCode: "85001" }
    });
    const crop = await prisma.cropVariety.findUniqueOrThrow({
      where: { code: "PLATANO_HARTON" }
    });

    const ownProfile = await request(app)
      .get("/api/v1/me")
      .set("Authorization", authorization(buyerA.accessToken));
    expect(ownProfile.status).toBe(200);
    expect(ownProfile.body.data.contact).toMatchObject({
      email: buyerA.email,
      phone: buyerA.phone
    });
    expect(JSON.stringify(ownProfile.body)).not.toContain("Ciphertext");

    const updatedBuyerName = `Buyer A ${runId}`;
    const businessName = `Comprador privado ${runId}`;
    const identityUpdate = await request(app)
      .patch("/api/v1/me")
      .set("Authorization", authorization(buyerA.accessToken))
      .send({ displayName: updatedBuyerName });
    expect(identityUpdate.status).toBe(200);
    buyerA.displayName = updatedBuyerName;

    const buyerProfileUpdate = await request(app)
      .put("/api/v1/me/buyer-profile")
      .set("Authorization", authorization(buyerA.accessToken))
      .send({
        businessName,
        buyerType: "WHOLESALER",
        description: "Perfil actualizado por integración"
      });
    expect(buyerProfileUpdate.status).toBe(200);

    const interestsUpdate = await request(app)
      .put("/api/v1/me/buyer-interests")
      .set("Authorization", authorization(buyerA.accessToken))
      .send({
        crops: [
          {
            cropVarietyId: crop.id,
            minimumQuantityKg: "500.000",
            maximumQuantityKg: "5000.000"
          }
        ],
        municipalityIds: [municipality.id]
      });
    expect(interestsUpdate.status).toBe(200);
    expect(interestsUpdate.body.data).toEqual({ cropCount: 1, municipalityCount: 1 });

    const farmerProfileUpdate = await request(app)
      .put("/api/v1/me/farmer-profile")
      .set("Authorization", authorization(farmer.accessToken))
      .send({ publicBio: "Productor de integración en Casanare" });
    expect(farmerProfileUpdate.status).toBe(200);

    const forbiddenBuyerProfile = await request(app)
      .put("/api/v1/me/buyer-interests")
      .set("Authorization", authorization(farmer.accessToken))
      .send({ crops: [], municipalityIds: [] });
    expect(forbiddenBuyerProfile.status).toBe(403);

    const farmResponse = await request(app)
      .post("/api/v1/farms")
      .set("Authorization", authorization(farmer.accessToken))
      .send({
        municipalityId: municipality.id,
        name: `Finca integración ${runId}`,
        vereda: "La prueba",
        publicLocationText: "Yopal, Casanare",
        productiveHectares: "12.50"
      });
    expect(farmResponse.status).toBe(201);
    const farmId = farmResponse.body.data.id as string;

    const farmUpdate = await request(app)
      .patch(`/api/v1/farms/${farmId}`)
      .set("Authorization", authorization(farmer.accessToken))
      .send({
        description: "Finca actualizada por integración",
        roadAccessNotes: "Acceso para camión"
      });
    expect(farmUpdate.status).toBe(200);
    expect(farmUpdate.body.data.description).toBe("Finca actualizada por integración");

    const ownFarm = await request(app)
      .get(`/api/v1/farms/${farmId}`)
      .set("Authorization", authorization(farmer.accessToken));
    expect(ownFarm.status).toBe(200);
    const farmPage = await request(app)
      .get("/api/v1/farms?limit=1")
      .set("Authorization", authorization(farmer.accessToken));
    expect(farmPage.status).toBe(200);
    expect(farmPage.body.data[0].id).toBe(farmId);

    const listingResponse = await request(app)
      .post("/api/v1/listings")
      .set("Authorization", authorization(farmer.accessToken))
      .send({
        farmId,
        cropVarietyId: crop.id,
        estimatedQuantityKg: "2500.000",
        availableFromDate: new Date(Date.now() + 86_400_000)
          .toISOString()
          .slice(0, 10),
        cropConditionNotes: "Lote de integración",
        expectedPriceCopPerKg: "1750.00",
        allowsPartialPurchase: true,
        bidDeadlineAt: new Date(Date.now() + 3_600_000).toISOString()
      });
    expect(listingResponse.status).toBe(201);
    const listingId = listingResponse.body.data.id as string;

    const listingUpdate = await request(app)
      .patch(`/api/v1/listings/${listingId}`)
      .set("Authorization", authorization(farmer.accessToken))
      .send({
        cropConditionNotes: "Lote de integración actualizado",
        expectedPriceCopPerKg: "1775.00"
      });
    expect(listingUpdate.status).toBe(200);
    expect(listingUpdate.body.data.expectedPriceCopPerKg).toBe("1775.00");

    const ownListings = await request(app)
      .get("/api/v1/me/listings?status=DRAFT&limit=10")
      .set("Authorization", authorization(farmer.accessToken));
    expect(ownListings.status).toBe(200);
    expect(ownListings.body.data.some(({ id }: { id: string }) => id === listingId)).toBe(true);

    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const firstPhoto = await request(app)
      .post(`/api/v1/listings/${listingId}/photos`)
      .set("Authorization", authorization(farmer.accessToken))
      .set("Content-Type", "image/jpeg")
      .set("X-Sort-Order", "0")
      .send(jpegBytes);
    expect(firstPhoto.status).toBe(201);
    const firstPhotoId = firstPhoto.body.data.id as string;
    const secondPhoto = await request(app)
      .post(`/api/v1/listings/${listingId}/photos`)
      .set("Authorization", authorization(farmer.accessToken))
      .set("Content-Type", "image/png")
      .set("X-Sort-Order", "1")
      .send(pngBytes);
    expect(secondPhoto.status).toBe(201);
    const secondPhotoId = secondPhoto.body.data.id as string;
    const duplicatePhoto = await request(app)
      .post(`/api/v1/listings/${listingId}/photos`)
      .set("Authorization", authorization(farmer.accessToken))
      .set("Content-Type", "image/jpeg")
      .set("X-Sort-Order", "2")
      .send(jpegBytes);
    expect(duplicatePhoto.status).toBe(409);

    const reorderPhotos = await request(app)
      .put(`/api/v1/listings/${listingId}/photos/order`)
      .set("Authorization", authorization(farmer.accessToken))
      .send({ photoIds: [secondPhotoId, firstPhotoId] });
    expect(reorderPhotos.status).toBe(204);
    const ownPhoto = await request(app)
      .get(`/api/v1/me/listings/${listingId}/photos/${firstPhotoId}`)
      .set("Authorization", authorization(farmer.accessToken));
    expect(ownPhoto.status).toBe(200);
    expect(ownPhoto.headers["content-type"]).toContain("image/jpeg");

    const publishResponse = await request(app)
      .post(`/api/v1/listings/${listingId}/publish`)
      .set("Authorization", authorization(farmer.accessToken));
    expect(publishResponse.status).toBe(200);

    const publicListings = await request(app).get(
      `/api/v1/listings?municipalityId=${municipality.id}&cropVarietyId=${crop.id}&limit=10`
    );
    expect(publicListings.status).toBe(200);
    expect(publicListings.body.data.some(({ id }: { id: string }) => id === listingId)).toBe(true);
    expect(JSON.stringify(publicListings.body)).not.toContain("storageKey");
    expect(JSON.stringify(publicListings.body)).not.toContain("harvest/");
    const publicListing = await request(app).get(`/api/v1/listings/${listingId}`);
    expect(publicListing.status).toBe(200);
    expect(publicListing.body.data.id).toBe(listingId);
    const publicPhoto = await request(app).get(
      `/api/v1/listings/${listingId}/photos/${firstPhotoId}`
    );
    expect(publicPhoto.status).toBe(200);
    expect(publicPhoto.headers["cache-control"]).toBe("public, max-age=300");

    const immutablePhotoSet = await request(app)
      .post(`/api/v1/listings/${listingId}/photos`)
      .set("Authorization", authorization(farmer.accessToken))
      .set("Content-Type", "image/jpeg")
      .send(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0xd9]));
    expect(immutablePhotoSet.status).toBe(409);

    async function submitBid(account: TestAccount, price: string, suffix: string) {
      const response = await request(app)
        .post(`/api/v1/listings/${listingId}/bids`)
        .set("Authorization", authorization(account.accessToken))
        .set("Idempotency-Key", `submit-${runId}-${suffix}`)
        .send({
          unitPriceCopPerKg: price,
          offeredQuantityKg: "2500.000",
          transportIncluded: true,
          pickupAtFarm: true,
          sellerLogisticsCostCop: "0.00",
          advanceAmountCop: "500000.00",
          paymentTermDays: 5
        });
      expect(response.status, JSON.stringify(response.body)).toBe(201);
      return response.body.data.id as string;
    }

    const [bidAId, bidBId] = await Promise.all([
      submitBid(buyerA, "1800.00", "a"),
      submitBid(buyerB, "1825.00", "b")
    ]);

    const protectedDelete = await request(app)
      .delete(`/api/v1/listings/${listingId}`)
      .set("Authorization", authorization(farmer.accessToken));
    expect(protectedDelete.status).toBe(409);

    const revision = await request(app)
      .post(`/api/v1/bids/${bidAId}/versions`)
      .set("Authorization", authorization(buyerA.accessToken))
      .set("Idempotency-Key", `revise-${runId}-a`)
      .send({
        unitPriceCopPerKg: "1850.00",
        offeredQuantityKg: "2500.000",
        transportIncluded: true,
        pickupAtFarm: true,
        sellerLogisticsCostCop: "0.00",
        advanceAmountCop: "750000.00",
        paymentTermDays: 3
      });
    expect(revision.status).toBe(200);
    await expect(prisma.bidVersion.count({ where: { bidId: bidAId } })).resolves.toBe(2);

    const ownBids = await request(app)
      .get("/api/v1/me/bids?status=SUBMITTED&limit=10")
      .set("Authorization", authorization(buyerA.accessToken));
    expect(ownBids.status).toBe(200);
    expect(ownBids.body.data.some(({ id }: { id: string }) => id === bidAId)).toBe(true);
    const bidHistory = await request(app)
      .get(`/api/v1/me/bids/${bidAId}`)
      .set("Authorization", authorization(buyerA.accessToken));
    expect(bidHistory.status).toBe(200);
    expect(bidHistory.body.data.versions).toHaveLength(2);
    const foreignBidHistory = await request(app)
      .get(`/api/v1/me/bids/${bidAId}`)
      .set("Authorization", authorization(buyerB.accessToken));
    expect(foreignBidHistory.status).toBe(404);

    const comparison = await request(app)
      .get(`/api/v1/listings/${listingId}/bids`)
      .set("Authorization", authorization(farmer.accessToken));
    expect(comparison.status).toBe(200);
    expect(comparison.body.data).toHaveLength(2);
    const anonymousPayload = JSON.stringify(comparison.body);
    for (const account of [buyerA, buyerB]) {
      expect(anonymousPayload).not.toContain(account.userId);
      expect(anonymousPayload).not.toContain(account.email);
      expect(anonymousPayload).not.toContain(account.displayName);
    }
    expect(anonymousPayload).not.toContain(businessName);

    const inputs = Array.from({ length: 100 }, (_, index) => ({
      bidId: index % 2 === 0 ? bidAId : bidBId,
      key: `award-${runId}-${String(index).padStart(3, "0")}`
    }));
    const attempts = await Promise.all(
      inputs.map(async (input) => ({
        ...input,
        response: await request(app)
          .post(`/api/v1/listings/${listingId}/award`)
          .set("Authorization", authorization(farmer.accessToken))
          .set("Idempotency-Key", input.key)
          .send({ bidId: input.bidId })
      }))
    );

    const successful = attempts.filter(({ response }) => response.status === 200);
    expect(successful).toHaveLength(1);
    expect(attempts.every(({ response }) => [200, 409].includes(response.status))).toBe(true);
    await expect(prisma.listingAward.count({ where: { listingId } })).resolves.toBe(1);

    const winner = successful[0];
    expect(winner).toBeDefined();
    if (!winner) {
      throw new Error("Concurrent award did not produce a winner");
    }

    const idempotentRetry = await request(app)
      .post(`/api/v1/listings/${listingId}/award`)
      .set("Authorization", authorization(farmer.accessToken))
      .set("Idempotency-Key", winner.key)
      .send({ bidId: winner.bidId });
    expect(idempotentRetry.status).toBe(200);

    const reveal = await request(app)
      .get(`/api/v1/listings/${listingId}/award/contact`)
      .set("Authorization", authorization(farmer.accessToken));
    expect(reveal.status).toBe(200);
    const expectedBuyer = winner.bidId === bidAId ? buyerA : buyerB;
    expect(reveal.body.data).toMatchObject({
      displayName: expectedBuyer.displayName,
      email: expectedBuyer.email,
      phone: expectedBuyer.phone
    });

    async function createAdditionalListing(label: string) {
      const response = await request(app)
        .post("/api/v1/listings")
        .set("Authorization", authorization(farmer.accessToken))
        .send({
          farmId,
          cropVarietyId: crop.id,
          estimatedQuantityKg: "1000.000",
          availableFromDate: new Date(Date.now() + 172_800_000)
            .toISOString()
            .slice(0, 10),
          cropConditionNotes: label,
          expectedPriceCopPerKg: "1700.00",
          allowsPartialPurchase: false,
          bidDeadlineAt: new Date(Date.now() + 7_200_000).toISOString()
        });
      expect(response.status).toBe(201);
      return response.body.data.id as string;
    }

    const closedListingId = await createAdditionalListing("Cierre manual");
    const publishClosedListing = await request(app)
      .post(`/api/v1/listings/${closedListingId}/publish`)
      .set("Authorization", authorization(farmer.accessToken));
    expect(publishClosedListing.status).toBe(200);

    const withdrawableBid = await request(app)
      .post(`/api/v1/listings/${closedListingId}/bids`)
      .set("Authorization", authorization(buyerA.accessToken))
      .set("Idempotency-Key", `submit-withdraw-${runId}`)
      .send({
        unitPriceCopPerKg: "1725.00",
        offeredQuantityKg: "1000.000",
        transportIncluded: true,
        pickupAtFarm: true,
        sellerLogisticsCostCop: "0.00",
        advanceAmountCop: "0.00",
        paymentTermDays: 2
      });
    expect(withdrawableBid.status).toBe(201);
    const withdrawableBidId = withdrawableBid.body.data.id as string;
    const withdrawalKey = `withdraw-${runId}`;
    const withdrawal = await request(app)
      .post(`/api/v1/bids/${withdrawableBidId}/withdraw`)
      .set("Authorization", authorization(buyerA.accessToken))
      .set("Idempotency-Key", withdrawalKey);
    expect(withdrawal.status).toBe(200);
    expect(withdrawal.body.data.status).toBe("WITHDRAWN");
    const withdrawalRetry = await request(app)
      .post(`/api/v1/bids/${withdrawableBidId}/withdraw`)
      .set("Authorization", authorization(buyerA.accessToken))
      .set("Idempotency-Key", withdrawalKey);
    expect(withdrawalRetry.status).toBe(200);

    const closeListingResponse = await request(app)
      .post(`/api/v1/listings/${closedListingId}/close`)
      .set("Authorization", authorization(farmer.accessToken));
    expect(closeListingResponse.status).toBe(204);

    const cancelledListingId = await createAdditionalListing("Cancelación de borrador");
    const cancelListingResponse = await request(app)
      .delete(`/api/v1/listings/${cancelledListingId}`)
      .set("Authorization", authorization(farmer.accessToken));
    expect(cancelListingResponse.status).toBe(204);

    const archiveFarmResponse = await request(app)
      .delete(`/api/v1/farms/${farmId}`)
      .set("Authorization", authorization(farmer.accessToken));
    expect(archiveFarmResponse.status).toBe(204);

    const unknownReset = await request(app)
      .post("/api/v1/auth/request-password-reset")
      .send({ email: `missing.${runId}@example.test` });
    expect(unknownReset.status).toBe(202);
    expect(unknownReset.body).toEqual({ accepted: true });

    const resetRequest = await request(app)
      .post("/api/v1/auth/request-password-reset")
      .send({ email: buyerB.email });
    expect(resetRequest.status).toBe(202);
    expect(resetRequest.body.resetToken).toBeTypeOf("string");
    const resetPasswordValue = "Reset-Integration-Password-2026!";
    const passwordReset = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: resetRequest.body.resetToken, newPassword: resetPasswordValue });
    expect(passwordReset.status).toBe(204);
    const resetTokenReuse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: resetRequest.body.resetToken, newPassword: "Another-Password-2026!" });
    expect(resetTokenReuse.status).toBe(400);
    const revokedAfterReset = await request(app)
      .get("/api/v1/me")
      .set("Authorization", authorization(buyerB.accessToken));
    expect(revokedAfterReset.status).toBe(401);
    const oldPasswordLogin = await request(app).post("/api/v1/auth/login").send({
      email: buyerB.email,
      password: buyerB.password
    });
    expect(oldPasswordLogin.status).toBe(401);
    const resetLogin = await request(app).post("/api/v1/auth/login").send({
      email: buyerB.email,
      password: resetPasswordValue
    });
    expect(resetLogin.status).toBe(200);
    buyerB.accessToken = resetLogin.body.accessToken;

    const changedPasswordValue = "Changed-Integration-Password-2026!";
    const passwordChange = await request(app)
      .post("/api/v1/me/password")
      .set("Authorization", authorization(buyerA.accessToken))
      .send({
        currentPassword: buyerA.password,
        newPassword: changedPasswordValue
      });
    expect(passwordChange.status).toBe(204);
    const revokedAfterChange = await request(app)
      .get("/api/v1/me")
      .set("Authorization", authorization(buyerA.accessToken));
    expect(revokedAfterChange.status).toBe(401);
    const changedLogin = await request(app).post("/api/v1/auth/login").send({
      email: buyerA.email,
      password: changedPasswordValue
    });
    expect(changedLogin.status).toBe(200);

    const deleteBuyer = await request(app)
      .delete("/api/v1/me")
      .set("Authorization", authorization(buyerB.accessToken));
    expect(deleteBuyer.status).toBe(204);
    const deletedSession = await request(app)
      .get("/api/v1/me")
      .set("Authorization", authorization(buyerB.accessToken));
    expect(deletedSession.status).toBe(401);

    const newAuditEvents = await prisma.auditEvent.findMany({
      ...(initialAuditHead.lastEventId
        ? { where: { id: { gt: initialAuditHead.lastEventId } } }
        : {}),
      orderBy: { id: "asc" }
    });
    expect(newAuditEvents.length).toBeGreaterThan(20);
    let previousHash = initialAuditHead.currentHash;
    for (const event of newAuditEvents) {
      if (previousHash) {
        expect(event.previousHash).not.toBeNull();
        expect(
          databaseBytesEqual(event.previousHash ?? new Uint8Array(), previousHash)
        ).toBe(true);
      } else {
        expect(event.previousHash).toBeNull();
      }
      const auditInput: AuditInput = {
        ...(event.actorUserId ? { actorUserId: event.actorUserId } : {}),
        actionCode: event.actionCode,
        entityType: event.entityType,
        ...(event.entityId ? { entityId: event.entityId } : {}),
        outcome: event.outcome,
        requestId: event.requestId,
        ...(event.ipHash ? { ipHash: event.ipHash } : {}),
        ...(event.metadata
          ? { metadata: event.metadata as AuditInput["metadata"] }
          : {})
      };
      expect(
        verifyAuditEventHash(auditInput, event.occurredAt, event.previousHash, event.eventHash)
      ).toBe(true);
      previousHash = event.eventHash;
    }
    const finalAuditHead = await prisma.auditChainHead.findUniqueOrThrow({ where: { id: 1 } });
    expect(finalAuditHead.lastEventId).toBe(newAuditEvents.at(-1)?.id);
    expect(
      databaseBytesEqual(
        finalAuditHead.currentHash ?? new Uint8Array(),
        newAuditEvents.at(-1)?.eventHash ?? new Uint8Array()
      )
    ).toBe(true);
  });

  it("enforces technical account boundaries and append-only tables", async () => {
    const env = getEnv();
    if (
      !env.AUTH_DATABASE_USER ||
      !env.AUTH_DATABASE_PASSWORD ||
      !env.MARKET_DATABASE_USER ||
      !env.MARKET_DATABASE_PASSWORD ||
      !env.AUDIT_DATABASE_USER ||
      !env.AUDIT_DATABASE_PASSWORD ||
      !env.AUDITOR_DATABASE_USER ||
      !env.AUDITOR_DATABASE_PASSWORD
    ) {
      throw new Error("Technical database credentials are required for integration tests");
    }

    async function connect(user: string, password: string): Promise<Connection> {
      return mariadb.createConnection({
        host: env.DATABASE_HOST,
        port: env.DATABASE_PORT,
        user,
        password,
        database: env.DATABASE_NAME,
        allowPublicKeyRetrieval: true
      });
    }

    const auth = await connect(env.AUTH_DATABASE_USER, env.AUTH_DATABASE_PASSWORD);
    const market = await connect(env.MARKET_DATABASE_USER, env.MARKET_DATABASE_PASSWORD);
    const auditWriter = await connect(env.AUDIT_DATABASE_USER, env.AUDIT_DATABASE_PASSWORD);
    const auditor = await connect(env.AUDITOR_DATABASE_USER, env.AUDITOR_DATABASE_PASSWORD);
    try {
      await expect(auth.query("SELECT COUNT(*) AS total FROM users")).resolves.toBeDefined();
      await expect(auth.query("SELECT COUNT(*) AS total FROM farms")).rejects.toMatchObject({
        errno: 1142
      });

      await expect(market.query("SELECT COUNT(*) AS total FROM farms")).resolves.toBeDefined();
      await expect(
        market.query("SELECT email_ciphertext FROM user_private_contacts LIMIT 1")
      ).rejects.toMatchObject({ errno: 1142 });
      await expect(
        market.query("UPDATE bid_versions SET observations = observations LIMIT 1")
      ).rejects.toMatchObject({ errno: 1142 });
      await expect(
        market.query("UPDATE audit_events SET outcome = outcome LIMIT 1")
      ).rejects.toMatchObject({ errno: 1142 });
      await expect(
        market.query("UPDATE audit_chain_heads SET current_hash = current_hash WHERE id = 1")
      ).rejects.toMatchObject({ errno: 1142 });

      await expect(auditWriter.query("SELECT * FROM audit_events LIMIT 1")).rejects.toMatchObject({
        errno: 1142
      });
      await expect(
        auditWriter.query(
          "INSERT INTO audit_events (occurred_at, action_code, entity_type, outcome, request_id, previous_hash, event_hash) VALUES (NOW(3), 'FORGED_EVENT', 'SYSTEM', 'FAILED', UUID(), RANDOM_BYTES(32), RANDOM_BYTES(32))"
        )
      ).rejects.toBeDefined();

      await expect(auditor.query("SELECT COUNT(*) AS total FROM audit_events")).resolves.toBeDefined();
      await expect(
        auditor.query("DELETE FROM audit_events WHERE 1 = 0")
      ).rejects.toMatchObject({ errno: 1142 });
    } finally {
      await Promise.all([auth.end(), market.end(), auditWriter.end(), auditor.end()]);
    }
  });
});
