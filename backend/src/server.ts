import { createServer } from "node:http";
import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";
import { disconnectPrisma } from "./infrastructure/database/prisma.js";
import { createLogger } from "./infrastructure/logger.js";

const env = getEnv();
const logger = createLogger();
const server = createServer(createApp());
let shuttingDown = false;

server.listen(env.PORT, "0.0.0.0", () => {
  logger.info({ port: env.PORT, environment: env.NODE_ENV }, "ADP backend started");
});

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info({ signal }, "Graceful shutdown started");

  const forceExit = setTimeout(() => {
    logger.fatal("Graceful shutdown timed out");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async (error) => {
    if (error) {
      logger.error({ err: error }, "HTTP server failed to close");
      process.exitCode = 1;
    }
    await disconnectPrisma();
    clearTimeout(forceExit);
    logger.info("Graceful shutdown finished");
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

process.on("unhandledRejection", (error) => {
  logger.fatal({ err: error }, "Unhandled promise rejection");
  void shutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  void shutdown("uncaughtException");
});
