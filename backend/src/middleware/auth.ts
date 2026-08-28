import type { RequestHandler } from "express";
import type { RoleCode } from "../generated/prisma/enums.js";
import { getEnv } from "../config/env.js";
import { getPrisma } from "../infrastructure/database/prisma.js";
import { AppError } from "../shared/errors.js";
import { verifyAccessToken } from "../shared/tokens.js";

export const authenticate: RequestHandler = async (request, _response, next) => {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    next(new AppError(401, "AUTH_REQUIRED", "Authentication is required"));
    return;
  }

  try {
    const claims = await verifyAccessToken(authorization.slice(7));
    const session = await getPrisma().authSession.findFirst({
      where: {
        id: claims.sessionId,
        userId: claims.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: "ACTIVE" }
      },
      select: { id: true, mfaVerifiedAt: true }
    });

    if (!session) {
      throw new AppError(401, "SESSION_INVALID", "The session is no longer valid");
    }

    const mfaVerified = Boolean(
      session.mfaVerifiedAt &&
        session.mfaVerifiedAt.getTime() >
          Date.now() - getEnv().MFA_SESSION_TTL_HOURS * 60 * 60 * 1_000
    );
    if (claims.mfaVerified !== mfaVerified) {
      throw new AppError(401, "SESSION_CLAIMS_STALE", "The session claims are no longer valid");
    }

    request.auth = claims;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError(401, "TOKEN_INVALID", "The access token is invalid or expired"));
  }
};

export function requireRole(...allowedRoles: RoleCode[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) {
      next(new AppError(401, "AUTH_REQUIRED", "Authentication is required"));
      return;
    }

    if (!allowedRoles.some((role) => request.auth?.roles.includes(role))) {
      next(new AppError(403, "ROLE_FORBIDDEN", "The authenticated role cannot perform this action"));
      return;
    }

    next();
  };
}

export const requireMfa: RequestHandler = (request, _response, next) => {
  if (!request.auth) {
    next(new AppError(401, "AUTH_REQUIRED", "Authentication is required"));
    return;
  }
  if (!request.auth.mfaVerified) {
    next(new AppError(403, "MFA_REQUIRED", "A recent MFA verification is required"));
    return;
  }
  next();
};

export function requireActor(request: Express.Request): NonNullable<Express.Request["auth"]> {
  if (!request.auth) {
    throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  }
  return request.auth;
}
