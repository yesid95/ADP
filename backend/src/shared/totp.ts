import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function decodeBase32(value: string): Buffer {
  const normalized = value.toUpperCase().replaceAll("=", "").replaceAll(/\s/g, "");
  let bits = 0;
  let accumulator = 0;
  const output: number[] = [];
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) {
      throw new Error("Invalid Base32 secret");
    }
    accumulator = (accumulator << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((accumulator >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function totpAtStep(secret: string, step: bigint, digits = 6): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(step);
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = (digest.at(-1) ?? 0) & 15;
  const binary =
    (((digest[offset] ?? 0) & 127) << 24) |
    ((digest[offset + 1] ?? 0) << 16) |
    ((digest[offset + 2] ?? 0) << 8) |
    (digest[offset + 3] ?? 0);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function currentTotpStep(now = Date.now(), periodSeconds = 30): bigint {
  return BigInt(Math.floor(now / (periodSeconds * 1_000)));
}

export function verifyTotp(
  secret: string,
  code: string,
  now = Date.now(),
  window = 1
): bigint | undefined {
  if (!/^\d{6}$/.test(code)) {
    return undefined;
  }
  const currentStep = currentTotpStep(now);
  const supplied = Buffer.from(code);
  for (let offset = -window; offset <= window; offset += 1) {
    const step = currentStep + BigInt(offset);
    if (step < 0n) {
      continue;
    }
    const expected = Buffer.from(totpAtStep(secret, step));
    if (expected.length === supplied.length && timingSafeEqual(expected, supplied)) {
      return step;
    }
  }
  return undefined;
}
