import "dotenv/config";
import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const base64Key = z.string().transform((value, context) => {
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) {
    context.addIssue({
      code: "custom",
      message: "must decode to exactly 32 bytes"
    });
    return z.NEVER;
  }
  return decoded;
});

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  TRUST_PROXY: booleanFromString,
  CORS_ORIGINS: z
    .string()
    .default("http://127.0.0.1:5173,http://localhost:5173")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_NAME: z.string().min(1),
  DATABASE_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  PRIVATE_UPLOAD_DIR: z.string().min(1).default("./uploads"),
  MAX_PHOTO_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .max(25 * 1_024 * 1_024)
    .default(10 * 1_024 * 1_024),
  JWT_SECRET_BASE64: base64Key,
  CONTACT_ENCRYPTION_KEY_BASE64: base64Key,
  CONTACT_LOOKUP_KEY_BASE64: base64Key,
  AUDIT_HMAC_KEY_BASE64: base64Key,
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30)
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const summary = z.prettifyError(result.error);
    throw new Error("Invalid backend environment:\n" + summary);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function resetEnvForTests(): void {
  cachedEnv = undefined;
}
