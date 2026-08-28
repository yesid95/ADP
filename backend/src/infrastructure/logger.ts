import pino from "pino";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import { getEnv } from "../config/env.js";

const REDACTED = "[REDACTED]";

export function createLogger(): pino.Logger {
  const env = getEnv();
  return pino({
    level: env.LOG_LEVEL,
    redact: {
      censor: REDACTED,
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
        "req.body.refreshToken",
        "req.body.token",
        "res.headers.set-cookie",
        "*.email",
        "*.phone",
        "*.passwordHash",
        "*.refreshTokenHash",
        "*.tokenHash",
        "*.secretCiphertext"
      ]
    }
  });
}

export function createHttpLogger(logger: pino.Logger) {
  return pinoHttp({
    logger,
    genReqId(request, response) {
      const incoming = request.headers["x-request-id"];
      const requestId =
        typeof incoming === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(incoming)
          ? incoming
          : randomUUID();
      response.setHeader("x-request-id", requestId);
      return requestId;
    },
    customLogLevel(_request, response, error) {
      if (error || response.statusCode >= 500) {
        return "error";
      }
      if (response.statusCode >= 400) {
        return "warn";
      }
      return "info";
    }
  });
}
