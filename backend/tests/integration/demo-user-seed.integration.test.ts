import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  disconnectPrisma,
  getPrisma
} from "../../src/infrastructure/database/prisma.js";
import {
  seedDemoUsers,
  type DemoAccountDefinition
} from "../../src/modules/auth/demo-user-seed.service.js";

const app = createApp();
const prisma = getPrisma();

afterAll(async () => {
  await disconnectPrisma();
});

describe("development demo user seed", () => {
  it("creates exact roles and rotates the shared local password idempotently", async () => {
    const suffix = randomUUID();
    const accounts: DemoAccountDefinition[] = [
      {
        displayName: "Seed Admin",
        email: `seed-admin.${suffix}@example.test`,
        role: "ADMIN"
      },
      {
        displayName: "Seed Farmer",
        email: `seed-farmer.${suffix}@example.test`,
        role: "FARMER"
      },
      {
        displayName: "Seed Buyer",
        email: `seed-buyer.${suffix}@example.test`,
        role: "BUYER",
        buyerType: "DISTRIBUTOR"
      }
    ];
    const firstPassword = "Demo-Seed-First-Password-2026!";
    const rotatedPassword = "Demo-Seed-Rotated-Password-2026!";

    const created = await seedDemoUsers(firstPassword, accounts);
    expect(created).toHaveLength(3);
    expect(created.every(({ created: wasCreated }) => wasCreated)).toBe(true);

    for (const account of created) {
      const persisted = await prisma.user.findUniqueOrThrow({
        where: { id: account.userId },
        include: { privateContact: true, roles: true }
      });
      expect(persisted.status).toBe("ACTIVE");
      expect(persisted.privateContact?.emailVerifiedAt).toBeInstanceOf(Date);
      expect(persisted.roles.map(({ roleCode }) => roleCode)).toEqual([account.role]);

      const login = await request(app).post("/api/v1/auth/login").send({
        email: account.email,
        password: firstPassword
      });
      expect(login.status).toBe(200);
      expect(login.body.mfaRequired).toBe(account.role === "ADMIN");
    }

    const rotated = await seedDemoUsers(rotatedPassword, accounts);
    expect(rotated.every(({ created: wasCreated }) => !wasCreated)).toBe(true);

    for (const account of rotated) {
      const oldLogin = await request(app).post("/api/v1/auth/login").send({
        email: account.email,
        password: firstPassword
      });
      expect(oldLogin.status).toBe(401);

      const newLogin = await request(app).post("/api/v1/auth/login").send({
        email: account.email,
        password: rotatedPassword
      });
      expect(newLogin.status).toBe(200);
    }
  });
});
