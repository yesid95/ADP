import { SignJWT, jwtVerify } from "jose";
import type { RoleCode } from "../generated/prisma/enums.js";
import { getEnv } from "../config/env.js";

const ISSUER = "adp-backend";
const AUDIENCE = "adp-web";

export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
  roles: RoleCode[];
  mfaVerified: boolean;
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  const env = getEnv();
  return new SignJWT({ roles: claims.roles, mfa: claims.mfaVerified })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.userId)
    .setJti(claims.sessionId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TOKEN_TTL_MINUTES + "m")
    .sign(env.JWT_SECRET_BASE64);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const env = getEnv();
  const { payload } = await jwtVerify(token, env.JWT_SECRET_BASE64, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ["HS256"]
  });

  if (
    !payload.sub ||
    !payload.jti ||
    !Array.isArray(payload.roles) ||
    typeof payload.mfa !== "boolean"
  ) {
    throw new Error("Token claims are incomplete");
  }

  return {
    userId: payload.sub,
    sessionId: payload.jti,
    roles: payload.roles as RoleCode[],
    mfaVerified: payload.mfa
  };
}
