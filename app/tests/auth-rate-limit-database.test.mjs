import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createAuthPolicy } from "../src/server/auth-policy.ts";
import { openLocalDatabase } from "../scripts/local-database.mjs";

test("two auth instances share atomic PostgreSQL limits with synthetic isolated counters", async () => {
  const connection = await openLocalDatabase();
  const schema = `auth_test_${randomUUID().replaceAll("-", "")}`;
  const clients = [];
  try {
    await connection.query(`CREATE SCHEMA "${schema}"`);
    await connection.query(`SET search_path TO "${schema}"`);
    await connection.query(await readFile(new URL("../prisma/migrations/20261013090000_auth_rate_limits/migration.sql", import.meta.url), "utf8"));
    const policy = createAuthPolicy({
      NODE_ENV: "production", BETTER_AUTH_URL: "https://app.example.test",
      BETTER_AUTH_SECRET: "synthetic-database-policy-secret-for-tests-only",
      AUTH_TRUSTED_IP_HEADER: "x-synthetic-client-ip",
    });
    const instances = Array.from({ length: 2 }, () => {
      const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }, { schema }), log: [] });
      clients.push(client);
      return betterAuth({ ...policy, database: prismaAdapter(client, { provider: "postgresql", transaction: true }), emailAndPassword: { enabled: true } });
    });
    const send = (index, ip = "192.0.2.1") => instances[index % 2].handler(new Request("https://app.example.test/api/auth/sign-up/email", {
      method: "POST",
      headers: { origin: "https://app.example.test", "content-type": "application/json", "x-synthetic-client-ip": ip },
      body: "{}", // Invalid synthetic input: no user, session or email can be created.
    }));
    const responses = await Promise.all(Array.from({ length: 12 }, (_, index) => send(index)));
    assert.equal(responses.filter((response) => response.status !== 429).length, 3);
    assert.equal(responses.filter((response) => response.status === 429).length, 9);
    assert.ok(responses.every((response) => response.status === 400 || response.status === 429));
    const { rows } = await connection.query('SELECT "count" FROM "RateLimit"');
    assert.deepEqual(rows.map((row) => row.count), [3]);
    assert.equal((await send(1)).status, 429);
    assert.equal((await send(0, "192.0.2.2")).status, 400, "A different reviewed client IP gets its own bucket");
    await connection.query('UPDATE "RateLimit" SET "lastRequest" = $1', [Date.now() - 901000]);
    assert.equal((await send(1)).status, 400, "Expired counters reset across instances");
  } finally {
    await Promise.all(clients.map((client) => client.$disconnect()));
    await connection.query("SET search_path TO public");
    await connection.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await connection.end();
  }
});
