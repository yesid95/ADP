import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  requireActor,
  requireMfa,
  requireRole
} from "../../middleware/auth.js";
import { getRequestContext } from "../../shared/request-context.js";
import { listUsers, replaceUserRoles, updateUserStatus } from "./admin.service.js";

const userIdSchema = z.uuid();
const roleSchema = z.enum(["FARMER", "BUYER", "ADMIN"]);
const buyerTypeSchema = z.enum([
  "WHOLESALER",
  "DISTRIBUTOR",
  "STORE",
  "RESTAURANT",
  "TRANSPORTER"
]);
const listSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "DELETED"]).optional(),
  role: roleSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.uuid().optional()
});
const statusSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });
const rolesSchema = z.object({
  roles: z
    .array(roleSchema)
    .min(1)
    .max(3)
    .transform((roles) => [...new Set(roles)]),
  buyerType: buyerTypeSchema.optional()
});

export function createAdminRouter(): Router {
  const router = Router();
  router.use("/admin", authenticate, requireRole("ADMIN"), requireMfa);

  router.get("/admin/users", async (request, response) => {
    response.json(await listUsers(listSchema.parse(request.query)));
  });

  router.patch("/admin/users/:userId/status", async (request, response) => {
    const actor = requireActor(request);
    const userId = userIdSchema.parse(request.params.userId);
    const { status } = statusSchema.parse(request.body);
    response.json({
      data: await updateUserStatus(actor.userId, userId, status, getRequestContext(request))
    });
  });

  router.put("/admin/users/:userId/roles", async (request, response) => {
    const actor = requireActor(request);
    const userId = userIdSchema.parse(request.params.userId);
    const { roles, buyerType } = rolesSchema.parse(request.body);
    response.json({
      data: await replaceUserRoles(
        actor.userId,
        userId,
        roles,
        buyerType,
        getRequestContext(request)
      )
    });
  });

  return router;
}
