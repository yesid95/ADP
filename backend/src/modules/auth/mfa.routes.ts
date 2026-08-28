import { Router } from "express";
import { z } from "zod";
import { authenticate, requireActor, requireMfa } from "../../middleware/auth.js";
import { getRequestContext } from "../../shared/request-context.js";
import {
  confirmTotp,
  disableMfa,
  enrollTotp,
  getOwnMfaStatus
} from "./mfa.service.js";

const passwordSchema = z.object({ password: z.string().min(1).max(128) });
const codeSchema = z.object({ code: z.string().trim().min(6).max(64) });

export function createMfaRouter(): Router {
  const router = Router();

  router.get("/me/mfa", authenticate, async (request, response) => {
    const actor = requireActor(request);
    response.json({ data: await getOwnMfaStatus(actor.userId) });
  });

  router.post("/me/mfa/totp/enroll", authenticate, async (request, response) => {
    const actor = requireActor(request);
    const { password } = passwordSchema.parse(request.body);
    response.status(201).json({
      data: await enrollTotp(actor.userId, password, getRequestContext(request))
    });
  });

  router.post("/me/mfa/totp/confirm", authenticate, async (request, response) => {
    const actor = requireActor(request);
    const { code } = codeSchema.parse(request.body);
    response.json({
      data: await confirmTotp(
        actor.userId,
        actor.sessionId,
        actor.roles,
        code,
        getRequestContext(request)
      )
    });
  });

  router.post("/me/mfa/disable", authenticate, requireMfa, async (request, response) => {
    const actor = requireActor(request);
    const { password } = passwordSchema.parse(request.body);
    await disableMfa(actor.userId, actor.sessionId, password, getRequestContext(request));
    response.status(204).send();
  });

  return router;
}
