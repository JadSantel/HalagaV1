import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { createAuthPolicy } from "../../src/server/auth-policy.ts";
import { openLocalDatabase } from "../../scripts/local-database.mjs";
import { readRuntimeConfig } from "../../src/server/runtime-config.ts";

/** Explicit dedicated local database; no fallback to the application DATABASE_URL. */
export async function openSignupSandbox() {
  const { DATABASE_URL } = readRuntimeConfig({ DATABASE_URL: process.env.SIGNUP_TEST_DATABASE_URL });
  if (new URL(DATABASE_URL).pathname !== "/halaga_signup_test") {
    throw new Error("SIGNUP_TEST_DATABASE_URL must name the dedicated halaga_signup_test database.");
  }
  const connection = await openLocalDatabase({ DATABASE_URL });
  const schema = `signup_test_${randomUUID().replaceAll("-", "")}`;
  let database;
  const close = async () => {
    try {
      await database?.$disconnect();
    } finally {
      try {
        await connection.query("SET search_path TO public");
        await connection.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        await connection.end();
      }
    }
  };
  try {
    await connection.query(`CREATE SCHEMA "${schema}"`);
    await connection.query(`SET search_path TO "${schema}", public`);
    const migrations = new URL("../../prisma/migrations/", import.meta.url);
    for (const entry of (await readdir(migrations, { withFileTypes: true })).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      await connection.query(await readFile(new URL(`${entry.name}/migration.sql`, migrations), "utf8"));
    }
    // Prisma qualifies model queries, but raw locking queries use PostgreSQL's search_path.
    // Apply the random synthetic schema to every pooled connection, including transactions.
    database = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL,
      options: `-c search_path=${schema},public` }, { schema }), log: [] });
    const auth = betterAuth({
      ...createAuthPolicy({ NODE_ENV: "development", BETTER_AUTH_URL: "http://127.0.0.1:3000",
        BETTER_AUTH_SECRET: "synthetic-signup-secret-for-local-tests-only" }),
      database: prismaAdapter(database, { provider: "postgresql", transaction: true }),
      emailAndPassword: { enabled: true, requireEmailVerification: false },
      // No email callbacks, route mount or external handler wrapper.
    });
    return { database, auth, connection, close };
  } catch {
    await connection.query("ROLLBACK").catch(() => {});
    await close();
    throw new Error("Signup sandbox setup failed. Check the dedicated local database and migration prerequisites.");
  }
}
