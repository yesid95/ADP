import { describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "../src/shared/tokens.js";

describe("access tokens", () => {
  it("signs and verifies the minimum non-sensitive claims", async () => {
    const token = await signAccessToken({
      userId: "00000000-0000-4000-8000-000000000001",
      sessionId: "00000000-0000-4000-8000-000000000002",
      roles: ["FARMER"],
      mfaVerified: false
    });
    const claims = await verifyAccessToken(token);
    expect(claims).toEqual({
      userId: "00000000-0000-4000-8000-000000000001",
      sessionId: "00000000-0000-4000-8000-000000000002",
      roles: ["FARMER"],
      mfaVerified: false
    });
    expect(token).not.toContain("productor@ejemplo.com");
  });
});
