import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { isRetryableTransactionError } from "./transaction.js";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new AppError(404, "ROUTE_NOT_FOUND", "Route not found"));
};

function fromPrisma(error: Prisma.PrismaClientKnownRequestError): AppError {
  if (error.code === "P2002") {
    return new AppError(409, "RESOURCE_CONFLICT", "A unique value already exists");
  }
  if (error.code === "P2003") {
    return new AppError(409, "RELATION_CONFLICT", "A related resource prevents this operation");
  }
  if (error.code === "P2025") {
    return new AppError(404, "RESOURCE_NOT_FOUND", "Resource not found");
  }
  if (isRetryableTransactionError(error)) {
    return new AppError(409, "CONCURRENT_UPDATE", "The operation conflicted with another request");
  }
  return new AppError(500, "DATABASE_ERROR", "The database operation failed");
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  let safeError: AppError;

  if (error instanceof AppError) {
    safeError = error;
  } else if (error instanceof ZodError) {
    safeError = new AppError(422, "VALIDATION_ERROR", "Request validation failed", error.issues);
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    safeError = fromPrisma(error);
  } else {
    safeError = new AppError(500, "INTERNAL_ERROR", "An unexpected error occurred");
  }

  if (safeError.statusCode >= 500) {
    request.log?.error({ err: error, errorCode: safeError.code }, "Request failed");
  }

  response.status(safeError.statusCode).json({
    error: {
      code: safeError.code,
      message: safeError.message,
      ...(safeError.details === undefined ? {} : { details: safeError.details }),
      requestId: request.id
    }
  });
};
