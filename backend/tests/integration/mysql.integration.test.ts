import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  disconnectPrisma,
  getPrisma
} from "../../src/infrastructure/database/prisma.js";

interface TestAccount {
  userId: string;
  email: string;
  phone: string;
  displayName: string;
  accessToken: string;
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
  const phoneSuffix = label === "farmer" ? "1" : label === "buyer-a" ? "2" : "3";
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

  expect(registration.status).toBe(201);
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
    accessToken: login.body.accessToken
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
    await expect(prisma.municipality.count()).resolves.toBe(19);
    await expect(
      prisma.cropVariety.findUnique({ where: { code: "PLATANO_HARTON" } })
    ).resolves.toMatchObject({ isActive: true });
  });

  it("persists the complete anonymous bid and concurrent award lifecycle", async () => {
    const [farmer, buyerA, buyerB] = await Promise.all([
      createVerifiedAccount("FARMER", "farmer"),
      createVerifiedAccount("BUYER", "buyer-a"),
      createVerifiedAccount("BUYER", "buyer-b")
    ]);
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

    const publishResponse = await request(app)
      .post(`/api/v1/listings/${listingId}/publish`)
      .set("Authorization", authorization(farmer.accessToken));
    expect(publishResponse.status).toBe(200);

    const publicListings = await request(app).get(
      `/api/v1/listings?municipalityId=${municipality.id}&cropVarietyId=${crop.id}&limit=10`
    );
    expect(publicListings.status).toBe(200);
    expect(publicListings.body.data.some(({ id }: { id: string }) => id === listingId)).toBe(true);
    const publicListing = await request(app).get(`/api/v1/listings/${listingId}`);
    expect(publicListing.status).toBe(200);
    expect(publicListing.body.data.id).toBe(listingId);

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

    const deleteBuyer = await request(app)
      .delete("/api/v1/me")
      .set("Authorization", authorization(buyerB.accessToken));
    expect(deleteBuyer.status).toBe(204);
    const deletedSession = await request(app)
      .get("/api/v1/me")
      .set("Authorization", authorization(buyerB.accessToken));
    expect(deletedSession.status).toBe(401);
  });
});
