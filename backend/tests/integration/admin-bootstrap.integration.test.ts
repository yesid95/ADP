import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  disconnectPrisma,
  getPrisma
} from "../../src/infrastructure/database/prisma.js";
import { bootstrapAdmin } from "../../src/modules/admin/admin-bootstrap.service.js";

const app = createApp();
const prisma = getPrisma();

afterAll(async () => {
  await disconnectPrisma();
});

describe("administrator bootstrap", () => {
  it("creates an active verified administrator and safely rotates its credentials", async () => {
    const suffix = randomUUID();
    const email = `bootstrap.${suffix}@example.test`;
    const firstPassword = "Bootstrap-First-Password-2026!";
    const rotatedPassword = "Bootstrap-Rotated-Password-2026!";

    const created = await bootstrapAdmin({
      displayName: "Bootstrap Administrator",
      email,
      password: firstPassword
    });

    expect(created).toMatchObject({
      created: true,
      email,
      sessionsRevoked: 0,
      mfaFactorsRevoked: 0
    });

    const persisted = await prisma.user.findUniqueOrThrow({
      where: { id: created.userId },
      include: { privateContact: true, roles: true }
    });
    expect(persisted.status).toBe("ACTIVE");
    expect(persisted.privateContact?.emailVerifiedAt).toBeInstanceOf(Date);
    expect(persisted.roles.map(({ roleCode }) => roleCode)).toContain("ADMIN");

    const firstLogin = await request(app).post("/api/v1/auth/login").send({
      email,
      password: firstPassword
    });
    expect(firstLogin.status).toBe(200);
    expect(firstLogin.body).toMatchObject({ mfaRequired: true, mfaVerified: false });

    const rotated = await bootstrapAdmin({
      displayName: "Bootstrap Administrator Rotated",
      email: email.toUpperCase(),
      password: rotatedPassword
    });
    expect(rotated).toMatchObject({
      created: false,
      userId: created.userId,
      email,
      sessionsRevoked: 1
    });

    const oldPasswordLogin = await request(app).post("/api/v1/auth/login").send({
      email,
      password: firstPassword
    });
    expect(oldPasswordLogin.status).toBe(401);

    const rotatedLogin = await request(app).post("/api/v1/auth/login").send({
      email,
      password: rotatedPassword
    });
    expect(rotatedLogin.status).toBe(200);
    expect(rotatedLogin.body).toMatchObject({ mfaRequired: true, mfaVerified: false });

    const auditEvent = await prisma.auditEvent.findFirst({
      where: {
        entityId: created.userId,
        actionCode: "ADMIN_BOOTSTRAP_ROTATED"
      }
    });
    expect(auditEvent).not.toBeNull();
  });
});
