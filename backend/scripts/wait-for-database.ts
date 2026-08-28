import { waitForDatabase } from "../src/infrastructure/database/wait-for-database.js";

await waitForDatabase();
process.stdout.write("MySQL is ready\n");
