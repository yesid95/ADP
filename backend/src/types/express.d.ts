import type { RoleCode } from "../generated/prisma/enums.js";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        sessionId: string;
        roles: RoleCode[];
      };
    }
  }
}

export {};
