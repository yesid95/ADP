import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes
} from "node:crypto";

const NONCE_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export type DatabaseBytes = Uint8Array<ArrayBuffer>;

function toDatabaseBytes(value: Uint8Array): DatabaseBytes {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

export function normalizeEmail(value: string): string {
  return value.trim().normalize("NFKC").toLowerCase();
}

export function normalizePhone(value: string): string {
  const normalized = value.trim().replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("Phone must use E.164 format");
  }
  return normalized;
}

export function encryptField(
  plaintext: string,
  key: Buffer,
  additionalAuthenticatedData: string
): DatabaseBytes {
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(additionalAuthenticatedData, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return toDatabaseBytes(Buffer.concat([nonce, tag, ciphertext]));
}

export function decryptField(
  payload: Uint8Array,
  key: Buffer,
  additionalAuthenticatedData: string
): string {
  const buffer = Buffer.from(payload);
  if (buffer.length <= NONCE_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Encrypted payload is malformed");
  }

  const nonce = buffer.subarray(0, NONCE_LENGTH);
  const tag = buffer.subarray(NONCE_LENGTH, NONCE_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buffer.subarray(NONCE_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(Buffer.from(additionalAuthenticatedData, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function hmacSha256(value: string | Buffer, key: Buffer): DatabaseBytes {
  return toDatabaseBytes(createHmac("sha256", key).update(value).digest());
}

export function sha256(value: string | Buffer): DatabaseBytes {
  return toDatabaseBytes(createHash("sha256").update(value).digest());
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function sortForCanonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForCanonicalJson);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortForCanonicalJson(entry)])
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortForCanonicalJson(value));
}

export function databaseBytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

export function contactFieldAad(
  userId: string,
  field: "email" | "phone",
  keyVersion: number
): string {
  return "user_private_contacts:" + userId + ":" + field + ":" + keyVersion;
}
