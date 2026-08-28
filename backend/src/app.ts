import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { getEnv } from "./config/env.js";
import { getPrisma } from "./infrastructure/database/prisma.js";
import { createHttpLogger, createLogger } from "./infrastructure/logger.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createBidRouter } from "./modules/bids/bid.routes.js";
import { createMarketRouter } from "./modules/market/market.routes.js";
import { createProfileRouter } from "./modules/profiles/profile.routes.js";
import { errorHandler, notFoundHandler } from "./shared/errors.js";

export function createApp(): Express {
  const env = getEnv();
  const app = express();
  const logger = createLogger();

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);
  app.use(createHttpLogger(logger));
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "same-site" }
    })
  );
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || env.CORS_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["content-type", "authorization", "idempotency-key", "x-request-id"],
      exposedHeaders: ["x-request-id"],
      maxAge: 600
    })
  );
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false
    })
  );
  app.use(express.json({ limit: "64kb", strict: true }));

  app.get("/health/live", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/health/ready", async (_request, response) => {
    await getPrisma().$queryRawUnsafe("SELECT 1");
    response.json({ status: "ready" });
  });

  const api = express.Router();
  api.use("/auth", createAuthRouter());
  api.use(createProfileRouter());
  api.use(createMarketRouter());
  api.use(createBidRouter());
  app.use("/api/v1", api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
