import { waitForDatabase } from "../../src/infrastructure/database/wait-for-database.js";

export default async function globalSetup(): Promise<void> {
  await waitForDatabase();
}
