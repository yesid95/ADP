import { describe, expect, it } from "vitest";
import {
  contactFieldAad,
  decryptField,
  encryptField,
  normalizeEmail,
  normalizePhone
} from "../src/shared/crypto.js";

describe("contact cryptography", () => {
  const key = Buffer.alloc(32, 9);
  const aad = contactFieldAad("user-1", "email", 1);

  it("normalizes identifiers before lookup", () => {
    expect(normalizeEmail("  Productor@Ejemplo.COM ")).toBe("productor@ejemplo.com");
    expect(normalizePhone("+57 300-111-2233")).toBe("+573001112233");
  });

  it("round-trips an encrypted contact", () => {
    const encrypted = encryptField("productor@ejemplo.com", key, aad);
    expect(Buffer.from(encrypted).includes(Buffer.from("productor@ejemplo.com"))).toBe(false);
    expect(decryptField(encrypted, key, aad)).toBe("productor@ejemplo.com");
  });

  it("rejects decryption under another user or field", () => {
    const encrypted = encryptField("productor@ejemplo.com", key, aad);
    expect(() =>
      decryptField(encrypted, key, contactFieldAad("other-user", "email", 1))
    ).toThrow();
  });
});
