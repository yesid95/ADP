import { describe, expect, it } from "vitest";
import {
  decodeBase32,
  encodeBase32,
  totpAtStep,
  verifyTotp
} from "../src/shared/totp.js";

describe("TOTP", () => {
  it("round-trips Base32 without padding", () => {
    const value = Buffer.from("ADP encrypted MFA secret", "utf8");
    expect(decodeBase32(encodeBase32(value))).toEqual(value);
  });

  it("matches RFC 6238 SHA-1 vectors", () => {
    const secret = encodeBase32(Buffer.from("12345678901234567890", "ascii"));
    expect(totpAtStep(secret, 1n, 8)).toBe("94287082");
    expect(totpAtStep(secret, 37037036n, 8)).toBe("07081804");
  });

  it("accepts only a code inside the configured time window", () => {
    const secret = encodeBase32(Buffer.from("12345678901234567890", "ascii"));
    const now = 59_000;
    const code = totpAtStep(secret, 1n);
    expect(verifyTotp(secret, code, now)).toBe(1n);
    expect(verifyTotp(secret, "000000", now, 0)).toBeUndefined();
  });
});
