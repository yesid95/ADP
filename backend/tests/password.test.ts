import { describe, expect, it } from "vitest";
import {
  hashPassword,
  needsPasswordRehash,
  verifyPassword
} from "../src/shared/password.js";

describe("password hashing", () => {
  it("uses Argon2id and verifies only the correct password", async () => {
    const hash = await hashPassword("UnaClaveLarga-Y-Unica-2026");
    expect(hash).toContain("$argon2id$");
    await expect(verifyPassword(hash, "UnaClaveLarga-Y-Unica-2026")).resolves.toBe(true);
    await expect(verifyPassword(hash, "ClaveIncorrecta")).resolves.toBe(false);
    expect(needsPasswordRehash(hash)).toBe(false);
  });
});
