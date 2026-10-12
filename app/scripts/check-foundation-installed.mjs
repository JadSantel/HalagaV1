import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { openLocalDatabase } from "./local-database.mjs";

let client;
try {
  client = await openLocalDatabase();
  const name = "20261012130000_account_listing_foundation";
  const sql = await readFile(new URL("../prisma/migrations/" + name + "/migration.sql", import.meta.url));
  const { rows } = await client.query(
    'SELECT checksum, finished_at, rolled_back_at FROM public._prisma_migrations WHERE migration_name=$1',
    [name],
  );
  assert.equal(rows.length, 1);
  assert.ok(rows[0].finished_at);
  assert.equal(rows[0].rolled_back_at, null);
  assert.equal(rows[0].checksum, createHash("sha256").update(sql).digest("hex"));
  const expectedConstraints = [
    "listing_id_currentRevisionNumber_fkey",
    "user_account_authUserId_fkey",
    "publication_availability_interval_listingId_cycleId_fkey",
    "listing_current_revision_required", "listing_closed_timestamp", "listing_expired_timestamp",
    "listing_revision_version_positive", "publication_cycle_number_positive",
    "publication_cycle_kind", "publication_cycle_thirty_days", "publication_availability_interval_order",
    "publication_availability_no_overlap", "listed_item_group_quantity_positive",
    "listing_media_byte_size_positive", "listing_media_sort_order_nonnegative",
  ];
  const constraints = await client.query(
    "SELECT conname FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND convalidated AND conname=ANY($1)",
    [expectedConstraints],
  );
  assert.equal(constraints.rowCount, expectedConstraints.length);
  const triggers = await client.query(
    "SELECT count(*)::int AS count FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled='O' AND t.tgname=ANY($1)",
    [[
      "publication_cycle_validate", "publication_availability_validate", "publication_cycle_immutable",
      "listing_revision_immutable", "listed_item_group_immutable", "diagnostic_answer_immutable",
      "ownership_declaration_immutable",
    ]],
  );
  assert.equal(triggers.rows[0].count, 7);
  console.log("Foundation migration checksum, 15 constraints and 7 history/publication triggers verified in local PostgreSQL.");
} catch {
  console.error("Foundation installation check failed. Check migration status and the local PostgreSQL schema; no credentials or record data were logged.");
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
}
