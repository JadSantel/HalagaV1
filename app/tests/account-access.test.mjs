import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createAuthPolicy } from "../src/server/auth-policy.ts";
import { hasAdultEligibility, isAtLeast18, requireAccountPrerequisites } from "../src/server/account-access.ts";
import { createAccountAccessReader } from "../src/server/repositories/accounts.ts";
import { openLocalDatabase } from "../scripts/local-database.mjs";

test("signup checks transient DOB with the eighteenth birthday evaluated in PHT", () => {
  const birth = new Date("2008-10-14T00:00:00Z");
  const before = new Date("2026-10-13T15:59:59.999Z");
  const birthday = new Date("2026-10-13T16:00:00Z");
  assert.equal(isAtLeast18(birth, before), false);
  assert.equal(isAtLeast18(birth, birthday), true);
  assert.equal(isAtLeast18(new Date(NaN), birthday), false);
  assert.equal(isAtLeast18(birth, new Date(NaN)), false);
  assert.equal(isAtLeast18(new Date("2027-01-01"), birthday), false);
  assert.equal(isAtLeast18(new Date("2008-02-29"), new Date("2026-02-28T15:59:59.999Z")), false);
  assert.equal(isAtLeast18(new Date("2008-02-29"), new Date("2026-02-28T16:00:00Z")), true);
  assert.equal(isAtLeast18(new Date("2000-02-29"), birthday), true);
});

test("stored adult prerequisites require a passed check and valid attestation without DOB", () => {
  const now = new Date("2026-10-14T00:00:00Z");
  const checked = new Date("2026-10-01T00:00:00Z");
  assert.equal(hasAdultEligibility(checked, checked, now), true);
  for (const [passed, attested] of [[null, checked], [checked, null], [new Date(NaN), checked],
    [checked, new Date(NaN)], [new Date("2026-10-15"), checked], [checked, new Date("2026-10-15")]]) {
    assert.equal(hasAdultEligibility(passed, attested, now), false);
  }
  assert.equal(hasAdultEligibility(checked, checked, new Date(NaN)), false);
});

test("all three action prerequisites fail closed without granting target or restriction authorization", () => {
  const account = { accountId: randomUUID(), displayName: "Synthetic", adultEligible: true, emailVerified: true, recentSignIn: false };
  for (const action of ["publish-listing", "send-inquiry", "submit-proposal"]) {
    for (const [value, code] of [[null, "UNAUTHORIZED"], [{ ...account, adultEligible: false }, "ADULT_ELIGIBILITY_REQUIRED"],
      [{ ...account, emailVerified: false }, "EMAIL_VERIFICATION_REQUIRED"]]) {
      assert.throws(() => requireAccountPrerequisites(value, action), (error) => error.code === code);
    }
    assert.equal(requireAccountPrerequisites(account, action), account, "Freshness is required for sensitive changes, not these prerequisites");
  }
  for (const action of [undefined, {}, "delete-account", "change-email"]) {
    assert.throws(() => requireAccountPrerequisites(account, action), (error) => error.code === "INVALID_INPUT");
  }
});

test("stored sessions resolve only their own account with private projections, renewal and safe failures", async () => {
  const connection = await openLocalDatabase();
  const schema = `account_access_${randomUUID().replaceAll("-", "")}`;
  let database;
  const lines = [];
  const originalError = console.error;
  console.error = (line) => lines.push(line);
  try {
    await connection.query(`CREATE SCHEMA "${schema}"`);
    await connection.query(`SET search_path TO "${schema}", public`);
    const migration = await readFile(new URL("../prisma/migrations/20261012130000_account_listing_foundation/migration.sql", import.meta.url), "utf8");
    await connection.query(migration);
    await connection.query(await readFile(new URL("../prisma/migrations/20261014090000_signup_transaction/migration.sql", import.meta.url), "utf8"));
    await connection.query(await readFile(new URL("../prisma/migrations/20261021110000_minimize_age_eligibility/migration.sql", import.meta.url), "utf8"));
    database = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }, { schema }), log: [] });
    const auth = betterAuth({
      ...createAuthPolicy({ NODE_ENV: "development", BETTER_AUTH_URL: "http://127.0.0.1:3000",
        BETTER_AUTH_SECRET: "synthetic-account-access-secret-for-tests-only" }),
      database: prismaAdapter(database, { provider: "postgresql", transaction: true }),
      emailAndPassword: { enabled: true, requireEmailVerification: false },
    });
    const queries = [];
    const read = createAccountAccessReader(auth, { userAccount: { findUnique: (query) => {
      queries.push(query);
      return database.userAccount.findUnique(query);
    } } });
    const capturedHeaders = [];
    const collectHeaders = (headers) => capturedHeaders.push(headers);
    assert.equal(await read(new Headers(), collectHeaders), null);
    assert.equal(await read(new Headers({ cookie: "better-auth.session_token=forged-synthetic-token" }), collectHeaders), null);
    const signup = await auth.api.signUpEmail({ body: {
      name: "Synthetic private auth name", email: "synthetic-owner@example.invalid", password: "synthetic-password-for-tests-only",
    }, asResponse: true });
    assert.equal(signup.status, 200);
    const { user } = await signup.json();
    const headers = new Headers({ cookie: signup.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") });
    assert.equal(await read(headers, collectHeaders), null, "No domain mapping means no account access; reading never creates it");
    const now = new Date();
    const account = await database.userAccount.create({ data: {
      authUserId: user.id, displayName: "Synthetic chosen display name", adultEligibilityCheckedAt: now, adultAttestedAt: now,
    } });
    await database.user.create({ data: { id: "synthetic-unrelated", name: "Unrelated private name", email: "unrelated@example.invalid" } });
    const unrelated = await database.userAccount.create({ data: {
      authUserId: "synthetic-unrelated", displayName: "Unrelated", adultEligibilityCheckedAt: now, adultAttestedAt: now, emailVerifiedAt: now,
    } });
    let access = await read(headers, collectHeaders);
    assert.deepEqual(access, { accountId: account.id, displayName: account.displayName, adultEligible: true, emailVerified: false, recentSignIn: true });
    assert.notEqual(access.accountId, unrelated.id);
    headers.set("x-account-id", unrelated.id);
    assert.equal((await read(headers, collectHeaders)).accountId, account.id, "Caller-supplied IDs cannot select another account");
    for (const query of queries) {
      assert.deepEqual(query, { where: { authUserId: user.id }, select: {
        id: true, displayName: true, adultEligibilityCheckedAt: true, adultAttestedAt: true, emailVerifiedAt: true, deletedAt: true,
      } });
    }
    assert.deepEqual(Object.keys(access).sort(), ["accountId", "adultEligible", "displayName", "emailVerified", "recentSignIn"]);
    await database.userAccount.update({ where: { id: account.id }, data: { emailVerifiedAt: now } });
    assert.equal((await read(headers, collectHeaders)).emailVerified, false, "Domain timestamp cannot override unverified identity");
    await database.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    await database.userAccount.update({ where: { id: account.id }, data: { emailVerifiedAt: null } });
    assert.equal((await read(headers, collectHeaders)).emailVerified, false, "Both records must agree until verification integration exists");
    await database.userAccount.update({ where: { id: account.id }, data: { emailVerifiedAt: now } });
    assert.equal((await read(headers, collectHeaders)).emailVerified, true);
    for (const data of [{ adultEligibilityCheckedAt: null }, { adultEligibilityCheckedAt: new Date(Date.now() + 86400000) }, { adultAttestedAt: null }]) {
      await database.userAccount.update({ where: { id: account.id }, data });
      assert.equal((await read(headers, collectHeaders)).adultEligible, false);
      await database.userAccount.update({ where: { id: account.id }, data: { adultEligibilityCheckedAt: account.adultEligibilityCheckedAt, adultAttestedAt: account.adultAttestedAt } });
    }
    const old = new Date(Date.now() - 2 * 86400000);
    await database.session.updateMany({ where: { userId: user.id }, data: { createdAt: old, updatedAt: old, expiresAt: new Date(old.getTime() + 7 * 86400000) } });
    access = await read(headers, collectHeaders);
    assert.equal(access.recentSignIn, false, "Renewal never refreshes sign-in age");
    assert.ok(capturedHeaders.at(-1).getSetCookie().some((cookie) => cookie.includes("session_token=")), "Renewal cookies reach the response boundary");
    const renewed = await database.session.findFirst({ where: { userId: user.id } });
    assert.equal(renewed.createdAt.getTime(), old.getTime());
    assert.ok(renewed.expiresAt.getTime() > Date.now() + 6 * 86400000);
    const sentinel = "SyntheticDOB-session-token-private-error";
    const failingDatabase = createAccountAccessReader(auth, { userAccount: { findUnique: async () => { throw new Error(sentinel); } } });
    await assert.rejects(failingDatabase(headers, collectHeaders), (error) => error.message === "INTERNAL_ERROR");
    await database.userAccount.update({ where: { id: account.id }, data: { deletedAt: new Date() } });
    assert.equal(await read(headers, collectHeaders), null);
    await database.userAccount.update({ where: { id: account.id }, data: { deletedAt: null } });
    await database.session.deleteMany({ where: { userId: user.id } });
    assert.equal(await read(headers, collectHeaders), null, "Live revoked sessions cannot retain cached access");
    const signedIn = await auth.api.signInEmail({ body: { email: user.email, password: "synthetic-password-for-tests-only" }, asResponse: true });
    assert.equal(signedIn.status, 200);
    const newHeaders = new Headers({ cookie: signedIn.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") });
    assert.ok(await read(newHeaders, collectHeaders));
    await database.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal(await read(newHeaders, collectHeaders), null);
    const failing = createAccountAccessReader({ api: { getSession: async () => { throw new Error(sentinel); } } }, database);
    await assert.rejects(failing(headers, collectHeaders), (error) => error.message === "INTERNAL_ERROR");
    assert.equal(JSON.stringify(lines).includes(sentinel), false);
    for (const line of lines) {
      const record = JSON.parse(line);
      assert.deepEqual(Object.keys(record).sort(), record.code ? ["code", "operation", "outcome"] : ["operation", "outcome"]);
      assert.equal(record.operation, "account-access");
    }
    assert.equal(JSON.stringify(lines).includes("2000-01-02"), false);
    assert.equal(JSON.stringify(lines).includes(user.email), false);
  } finally {
    console.error = originalError;
    await database?.$disconnect();
    await connection.query("SET search_path TO public");
    await connection.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await connection.end();
  }
});
