import { z } from "zod";
import { disconnectPrisma } from "../src/infrastructure/database/prisma.js";
import { seedDemoUsers } from "../src/modules/auth/demo-user-seed.service.js";

const seedEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DEMO_SEED_PASSWORD: z.string().min(16).max(128)
});

async function main(): Promise<void> {
  const input = seedEnvSchema.parse(process.env);
  if (input.NODE_ENV === "production") {
    throw new Error("Demo user seeding is disabled in production");
  }

  const accounts = await seedDemoUsers(input.DEMO_SEED_PASSWORD);
  for (const account of accounts) {
    console.log(
      `${account.created ? "Created" : "Rotated"}: ${account.email} [${account.role}]`
    );
  }
  console.log("The shared local demo password was not printed.");
}

main()
  .then(() => disconnectPrisma())
  .catch(async (error: unknown) => {
    console.error(error);
    await disconnectPrisma();
    process.exitCode = 1;
  });
