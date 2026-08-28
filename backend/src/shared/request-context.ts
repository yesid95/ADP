import type { Request } from "express";
import { getEnv } from "../config/env.js";
import { hmacSha256, type DatabaseBytes } from "./crypto.js";

export interface RequestContext {
  requestId: string;
  ipHash?: DatabaseBytes;
  userAgentHash?: DatabaseBytes;
}

export function getRequestContext(request: Request): RequestContext {
  const key = getEnv().AUDIT_HMAC_KEY_BASE64;
  const ip = request.ip;
  const userAgent = request.get("user-agent");

  return {
    requestId: String(request.id),
    ...(ip ? { ipHash: hmacSha256(ip, key) } : {}),
    ...(userAgent ? { userAgentHash: hmacSha256(userAgent, key) } : {})
  };
}
