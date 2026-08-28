import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { getRequestContext } from "../../shared/request-context.js";
import {
  loginUser,
  logoutSession,
  requestPasswordReset,
  refreshSession,
  registerUser,
  resendEmailVerification,
  resetPassword,
  verifyEmail
} from "./auth.service.js";

const roleSchema = z.enum(["FARMER", "BUYER"]);
const buyerTypeSchema = z.enum([
  "WHOLESALER",
  "DISTRIBUTOR",
  "STORE",
  "RESTAURANT",
  "TRANSPORTER"
]);

const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  phone: z.string().trim().max(20).optional(),
  password: z.string().min(12).max(128),
  roles: z.array(roleSchema).min(1).max(2).transform((roles) => [...new Set(roles)]),
  buyerType: buyerTypeSchema.optional()
});

const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128)
});

const tokenSchema = z.object({
  token: z.string().min(32).max(512)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(32).max(512)
});

const emailSchema = z.object({ email: z.email().max(254) });
const resetPasswordSchema = z.object({
  token: z.string().min(32).max(512),
  newPassword: z.string().min(12).max(128)
});

export function createAuthRouter(): Router {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false
  });

  router.use(limiter);

  router.post("/register", async (request, response) => {
    const result = await registerUser(
      registerSchema.parse(request.body),
      getRequestContext(request)
    );
    response.status(201).json(result);
  });

  router.post("/verify-email", async (request, response) => {
    const { token } = tokenSchema.parse(request.body);
    await verifyEmail(token, getRequestContext(request));
    response.status(204).send();
  });

  router.post("/resend-verification", async (request, response) => {
    const { email } = emailSchema.parse(request.body);
    await resendEmailVerification(email, getRequestContext(request));
    response.status(204).send();
  });

  router.post("/request-password-reset", async (request, response) => {
    const { email } = emailSchema.parse(request.body);
    const result = await requestPasswordReset(email, getRequestContext(request));
    response.status(202).json({ accepted: true, ...result });
  });

  router.post("/reset-password", async (request, response) => {
    const input = resetPasswordSchema.parse(request.body);
    await resetPassword(input.token, input.newPassword, getRequestContext(request));
    response.status(204).send();
  });

  router.post("/login", async (request, response) => {
    const result = await loginUser(loginSchema.parse(request.body), getRequestContext(request));
    response.json(result);
  });

  router.post("/refresh", async (request, response) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    const result = await refreshSession(refreshToken, getRequestContext(request));
    response.json(result);
  });

  router.post("/logout", async (request, response) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    await logoutSession(refreshToken, getRequestContext(request));
    response.status(204).send();
  });

  return router;
}
