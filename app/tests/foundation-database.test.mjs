import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { openLocalDatabase } from "../scripts/local-database.mjs";
import { diffSchema, getExpectedSchema } from "@better-auth/core/db/internal";

const migrationUrl = new URL("../prisma/migrations/20261012130000_account_listing_foundation/migration.sql", import.meta.url);

test("foundation migration enforces storage invariants using rolled-back synthetic data", async (t) => {
  const client = await openLocalDatabase();
  const insert = async (table, data) => {
    const row = { id: randomUUID(), ...data };
    const columns = Object.keys(row);
    await client.query(
      `INSERT INTO "${table}" (${columns.map((key) => `"${key}"`).join(",")})
       VALUES (${columns.map((_, index) => `$${index + 1}`).join(",")})`, Object.values(row),
    );
    return row.id;
  };
  const rejected = async (sql, params, code, constraint) => {
    await client.query("SAVEPOINT rejected_write");
    let failure;
    try { await client.query(sql, params); } catch (error) { failure = error; }
    await client.query("ROLLBACK TO SAVEPOINT rejected_write");
    await client.query("RELEASE SAVEPOINT rejected_write");
    assert.ok(failure, "Invalid write must be rejected by PostgreSQL");
    assert.equal(failure.code, code);
    if (constraint) assert.equal(failure.constraint, constraint);
  };
  const start = new Date("2026-10-01T00:00:00+08:00");
  const expiry = new Date(start.getTime() + 30 * 86400000);
  try {
    const sql = await readFile(migrationUrl, "utf8");
    const fragment = await readFile(new URL("../../docs/architecture/PHYSICAL_SCHEMA_CONSTRAINTS.sql", import.meta.url), "utf8");
    assert.ok(sql.endsWith(fragment + "\nCOMMIT;\n") ||
      sql.endsWith(fragment + "\r\nCOMMIT;\r\n"), "SQL constraint fragment must match migration suffix");
    const schema = "halaga_verify_" + randomUUID().replaceAll("-", "");
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    // Replay the complete migration inside this rollback transaction.
    await client.query(sql.replace(/^BEGIN;\r?\n/, "").replace(/COMMIT;\r?\n$/, ""));
    await t.test("authentication tables match installed Better Auth core writes", async () => {
      const { rows } = await client.query(
        "SELECT table_name, column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema=$1", [schema],
      );
      const actual = [...new Set(rows.map((row) => row.table_name))].map((name) => ({
        name,
        columns: rows.filter((row) => row.table_name === name).map((row) => ({
          name: row.column_name, nullable: row.is_nullable === "YES", hasDefault: row.column_default !== null,
        })),
      }));
      assert.deepEqual(diffSchema(getExpectedSchema({ emailAndPassword: { enabled: true } }), actual), []);
    });
    const authId = await insert("user", { name: "Synthetic owner", email: "owner@example.invalid", updatedAt: start });
    const seller = await insert("user_account", { authUserId: authId, displayName: "Synthetic owner", updatedAt: start });
    const authBuyerId = await insert("user", { name: "Synthetic other", email: "other@example.invalid", updatedAt: start });
    const other = await insert("user_account", { authUserId: authBuyerId, displayName: "Synthetic other", updatedAt: start });
    const listing = await insert("listing", { sellerId: seller, updatedAt: start });
    const revisionData = {
      listingId: listing, version: 1, authoredById: seller, listingType: "SINGLE_ITEM",
      category: "LAPTOPS", title: "Synthetic laptop", description: "Not an actual item",
      barangayCode: "synthetic-only", priceExpectation: "9999999999.99",
    };
    const revision = await insert("listing_revision", revisionData);
    await client.query('UPDATE listing SET "currentRevisionNumber"=1 WHERE id=$1', [listing]);
    const secondListing = await insert("listing", { sellerId: seller, updatedAt: start });
    await insert("listing_revision", { ...revisionData, listingId: secondListing, version: 2 });
    const cycleData = { listingId: listing, revisionNumber: 1, cycleNumber: 1, kind: "INITIAL_PUBLICATION", confirmedById: seller, startsAt: start, expiresAt: expiry };
    const cycle = await insert("publication_cycle", cycleData);

    await t.test("current revision must exist on the same listing; non-draft cannot be incomplete", async () => {
      await rejected('UPDATE listing SET "currentRevisionNumber"=2 WHERE id=$1', [listing], "23503");
      await rejected("UPDATE listing SET status='VALIDATING' WHERE id=$1", [secondListing], "23514", "listing_current_revision_required");
      await rejected('UPDATE user_account SET "authUserId"=$1 WHERE id=$2', ["missing-auth", seller], "23503");
    });
    await t.test("lifecycle outcomes remain distinct and terminal timestamps are required", async () => {
      for (const status of ["VALIDATING", "HELD", "REJECTED", "REMOVED", "PUBLISHED", "RESOLVING_EXISTING_ACTIVITY", "PAUSED_BY_RESERVATION"]) {
        await client.query("UPDATE listing SET status=$1 WHERE id=$2", [status, listing]);
        assert.equal((await client.query("SELECT status FROM listing WHERE id=$1", [listing])).rows[0].status, status);
      }
      await rejected("UPDATE listing SET status='CLOSED' WHERE id=$1", [listing], "23514", "listing_closed_timestamp");
      await rejected("UPDATE listing SET status='EXPIRED' WHERE id=$1", [listing], "23514", "listing_expired_timestamp");
      await client.query('UPDATE listing SET status=\'EXPIRED\', "expiredAt"=$1 WHERE id=$2', [expiry, listing]);
      await client.query('UPDATE listing SET status=\'CLOSED\', "closedAt"=$1 WHERE id=$2', [expiry, listing]);
      // These tests prove representation/row consistency, not bilateral completion.
    });
    await t.test("quantity, revision number and media integrity reject invalid values", async () => {
      for (const quantity of [0, -1]) {
        await rejected('INSERT INTO listed_item_group (id,"revisionId",quantity,condition) VALUES ($1,$2,$3,\'UNTESTED_UNKNOWN\')',
          [randomUUID(), revision, quantity], "23514", "listed_item_group_quantity_positive");
      }
      await rejected('INSERT INTO listing_revision (id,"listingId",version,"authoredById","listingType",category,title,description,"barangayCode") VALUES ($1,$2,0,$3,\'SINGLE_ITEM\',\'LAPTOPS\',\'Synthetic\',\'Synthetic\',\'synthetic-only\')',
        [randomUUID(), listing, seller], "23514", "listing_revision_version_positive");
      for (const [size, order, constraint] of [[0, 0, "listing_media_byte_size_positive"], [10, -1, "listing_media_sort_order_nonnegative"]]) {
        await rejected('INSERT INTO listing_media (id,"revisionId","objectKey","contentSha256","mediaType","byteSize","sortOrder") VALUES ($1,$2,$3,\'synthetic-hash\',\'image/jpeg\',$4,$5)',
          [randomUUID(), revision, randomUUID(), size, order], "23514", constraint);
      }
    });
    await t.test("cycles enforce their 30-day PHT deadline and seller confirmation", async () => {
      const renewal = { ...cycleData, id: randomUUID(), cycleNumber: 2, kind: "RENEWAL" };
      const cycleSql = 'INSERT INTO publication_cycle (id,"listingId","revisionNumber","cycleNumber",kind,"confirmedById","startsAt","expiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)';
      const values = (row) => [row.id, row.listingId, row.revisionNumber, row.cycleNumber, row.kind, row.confirmedById, row.startsAt, row.expiresAt];
      await rejected(cycleSql, values({ ...renewal, expiresAt: start }), "23514", "publication_cycle_thirty_days");
      await rejected(cycleSql, values({ ...renewal, confirmedById: other }), "23514");
      await rejected(cycleSql, values({ ...renewal, cycleNumber: 3 }), "23514");
      await rejected('UPDATE publication_cycle SET "expiresAt"=$1 WHERE id=$2', [start, cycle], "23514");
      const secondCycle = await insert("publication_cycle", { ...cycleData, cycleNumber: 2, kind: "RENEWAL" });
      assert.equal((await client.query('SELECT count(*)::int AS count FROM publication_cycle WHERE "listingId"=$1', [listing])).rows[0].count, 2);
      assert.ok(secondCycle);
    });
    await t.test("availability stays within its cycle and cannot overlap across cycles", async () => {
      const end = new Date(start.getTime() + 3600000);
      const interval = await insert("publication_availability_interval", { listingId: listing, cycleId: cycle, startedAt: start, endedAt: end });
      const sql = 'INSERT INTO publication_availability_interval (id,"listingId","cycleId","startedAt","endedAt") VALUES ($1,$2,$3,$4,$5)';
      await rejected(sql, [randomUUID(), listing, cycle, start, new Date(start.getTime() - 1)], "23514", "publication_availability_interval_order");
      await rejected(sql, [randomUUID(), listing, cycle, new Date(start.getTime() - 1), end], "23514");
      await rejected(sql, [randomUUID(), listing, cycle, start, new Date(expiry.getTime() + 1)], "23514");
      const otherCycle = (await client.query('SELECT id FROM publication_cycle WHERE "listingId"=$1 AND "cycleNumber"=2', [listing])).rows[0].id;
      await rejected(sql, [randomUUID(), listing, otherCycle, start, end], "23P01", "publication_availability_no_overlap");
      await rejected(sql, [randomUUID(), secondListing, cycle, start, end], "23514");
      await rejected('UPDATE publication_availability_interval SET "endedAt"=$1 WHERE id=$2', [expiry, interval], "23514");
      const open = await insert("publication_availability_interval", { listingId: listing, cycleId: cycle, startedAt: end });
      await client.query('UPDATE publication_availability_interval SET "endedAt"=$1 WHERE id=$2', [expiry, open]);
    });
    await t.test("exact money and versioned JSON answers survive storage; history rejects updates", async () => {
      assert.equal((await client.query('SELECT "priceExpectation"::text AS amount FROM listing_revision WHERE id=$1', [revision])).rows[0].amount, "9999999999.99");
      const group = await insert("listed_item_group", { revisionId: revision, condition: "FULLY_FUNCTIONAL" });
      const answer = await insert("diagnostic_answer", { itemGroupId: group, schemaVersion: "laptop-diagnostics-en-v1", questionKey: "power", answer: JSON.stringify("on") });
      assert.equal((await client.query("SELECT answer FROM diagnostic_answer WHERE id=$1", [answer])).rows[0].answer, "on");
      await rejected('UPDATE listing_revision SET title=\'changed\' WHERE id=$1', [revision], "23514");
      await rejected('UPDATE listed_item_group SET quantity=2 WHERE id=$1', [group], "23514");
      await rejected('UPDATE diagnostic_answer SET answer=\'"nothing"\'::jsonb WHERE id=$1', [answer], "23514");
    });
    await t.test("synthetic declaration storage binds one immutable version, actor and time per exact revision", async () => {
      // Storage fixture only. This is NOT an accepted declaration wording version
      // or application capture path; those remain gated independently.
      const textVersion = "synthetic-storage-test-only";
      const declaration = await insert("ownership_declaration", { revisionId: revision, declaredById: seller,
        textVersion, attestedAt: start });
      const sql = 'INSERT INTO ownership_declaration (id,"revisionId","declaredById","textVersion","attestedAt") VALUES ($1,$2,$3,$4,$5)';
      await rejected(sql, [randomUUID(), revision, seller, textVersion, start], "23505", "ownership_declaration_revisionId_key");
      for (const [column, value] of [["revisionId", randomUUID()], ["declaredById", other],
        ["textVersion", "synthetic-change"], ["attestedAt", expiry]])
        await rejected(`UPDATE ownership_declaration SET "${column}"=$1 WHERE id=$2`, [value, declaration], "23514");
      const row = (await client.query('SELECT "revisionId","declaredById","textVersion","attestedAt" FROM ownership_declaration WHERE id=$1', [declaration])).rows[0];
      assert.deepEqual(row, { revisionId: revision, declaredById: seller, textVersion, attestedAt: start });
    });
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
});
