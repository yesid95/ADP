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
    .default(
      "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174"
    )
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
  AUTH_DATABASE_USER: z.string().min(1).optional(),
  AUTH_DATABASE_PASSWORD: z.string().min(1).optional(),
  MARKET_DATABASE_USER: z.string().min(1).optional(),
  MARKET_DATABASE_PASSWORD: z.string().min(1).optional(),
  AUDIT_DATABASE_USER: z.string().min(1).optional(),
  AUDIT_DATABASE_PASSWORD: z.string().min(1).optional(),
  AUDITOR_DATABASE_USER: z.string().min(1).optional(),
  AUDITOR_DATABASE_PASSWORD: z.string().min(1).optional(),
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
  MFA_ENCRYPTION_KEY_BASE64: base64Key,
  MFA_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(12),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  MAIL_MODE: z.enum(["token", "smtp"]).default("token"),
  APP_PUBLIC_URL: z.url().default("http://127.0.0.1:5173"),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
  SMTP_SECURE: booleanFromString,
  SMTP_REQUIRE_TLS: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM: z.string().min(3).optional()
}).superRefine((env, context) => {
  if (env.NODE_ENV === "production" && env.MAIL_MODE !== "smtp") {
    context.addIssue({
      code: "custom",
      path: ["MAIL_MODE"],
      message: "must be smtp in production"
    });
  }
  if (env.NODE_ENV === "production") {
    for (const field of [
      "AUTH_DATABASE_USER",
      "AUTH_DATABASE_PASSWORD",
      "MARKET_DATABASE_USER",
      "MARKET_DATABASE_PASSWORD"
    ] as const) {
      if (!env[field]) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "is required in production for database privilege separation"
        });
      }
    }
  }
  if (env.MAIL_MODE === "smtp") {
    for (const field of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"] as const) {
      if (!env[field]) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "is required when MAIL_MODE=smtp"
        });
      }
    }
  }
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
