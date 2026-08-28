import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);
const migrationPath = new URL(
  "../prisma/migrations/20260828032000_init/migration.sql",
  import.meta.url
);

describe("database contract", () => {
  it("contains the 25 documented models and real foreign keys", async () => {
    const schema = await readFile(schemaPath, "utf8");
    const models = schema.match(/^model\s+[A-Za-z][A-Za-z0-9]*\s+\{/gm) ?? [];
    expect(models).toHaveLength(25);
    expect(schema).toContain('relationMode = "foreignKeys"');
    expect(schema).toContain("@@unique([listingId, bidId]");
    expect(schema).toContain("@@id([bidId, versionNo])");
  });

  it("hardens business invariants in the generated MySQL migration", async () => {
    const migration = await readFile(migrationPath, "utf8");
    expect(migration).toContain("PRIMARY KEY (\u0060listing_id\u0060)");
    expect(migration).toContain("listing_awards_listing_id_bid_id_fkey");
    expect(migration).toContain("REFERENCES \u0060bids\u0060(\u0060listing_id\u0060, \u0060id\u0060)");
    expect(migration).toContain("harvest_listings_quantity_positive_ck");
    expect(migration).toContain("bid_versions_advance_range_ck");
    expect(migration).toContain("auth_sessions_expiry_ck");
  });
});
