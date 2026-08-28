import { z } from "zod";
import { disconnectPrisma } from "../src/infrastructure/database/prisma.js";
import { bootstrapAdmin } from "../src/modules/admin/admin-bootstrap.service.js";

const bootstrapEnvSchema = z.object({
  BOOTSTRAP_ADMIN_EMAIL: z.email().max(254),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(16).max(128),
  BOOTSTRAP_ADMIN_DISPLAY_NAME: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .default("Administrador ADP")
});

async function main(): Promise<void> {
  const input = bootstrapEnvSchema.parse(process.env);
  const result = await bootstrapAdmin({
    displayName: input.BOOTSTRAP_ADMIN_DISPLAY_NAME,
    email: input.BOOTSTRAP_ADMIN_EMAIL,
    password: input.BOOTSTRAP_ADMIN_PASSWORD
  });

  console.log(result.created ? "Administrator created." : "Administrator rotated.");
  console.log(`User ID: ${result.userId}`);
  console.log(`Email: ${result.email}`);
  console.log(`Sessions revoked: ${result.sessionsRevoked}`);
  console.log(`MFA factors revoked: ${result.mfaFactorsRevoked}`);
  console.log("The password was not printed. Enroll MFA before using administration endpoints.");
}

main()
  .then(() => disconnectPrisma())
  .catch(async (error: unknown) => {
    console.error(error);
    await disconnectPrisma();
    process.exitCode = 1;
  });
