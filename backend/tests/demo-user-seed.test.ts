import { describe, expect, it } from "vitest";
import { assertDemoUserSeedAllowed } from "../src/modules/auth/demo-user-seed.service.js";

describe("demo user seed guard", () => {
  it("allows non-production environments", () => {
    expect(() => assertDemoUserSeedAllowed("development")).not.toThrow();
    expect(() => assertDemoUserSeedAllowed("test")).not.toThrow();
  });

  it("rejects production", () => {
    expect(() => assertDemoUserSeedAllowed("production")).toThrow(
      "Demo user seeding is disabled in production"
    );
  });
});
