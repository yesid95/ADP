import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("HTTP application", () => {
  const app = createApp();

  it("serves liveness without touching the database", async () => {
    const response = await request(app).get("/health/live");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-request-id"]).toBeTypeOf("string");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("returns a safe structured error for unknown routes", async () => {
    const response = await request(app).get("/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
    expect(response.body.error.requestId).toBeTypeOf("string");
    expect(JSON.stringify(response.body)).not.toContain("node_modules");
  });

  it("rejects invalid registration before accessing the database", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      displayName: "A",
      email: "not-an-email",
      password: "short",
      roles: []
    });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
