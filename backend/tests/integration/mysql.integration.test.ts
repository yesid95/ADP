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

    const listingResponse = await request(app)
      .post("/api/v1/listings")
      .set("Authorization", authorization(farmer.accessToken))
      .send({
        farmId: farmResponse.body.data.id,
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

    const publishResponse = await request(app)
      .post(`/api/v1/listings/${listingId}/publish`)
      .set("Authorization", authorization(farmer.accessToken));
    expect(publishResponse.status).toBe(200);

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
  });
});
