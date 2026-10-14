import "dotenv/config";
import pg from "pg";
import { readRuntimeConfig } from "../src/server/runtime-config.ts";

export async function openLocalDatabase(environment = process.env) {
  const { DATABASE_URL } = readRuntimeConfig(environment);
  const url = new URL(DATABASE_URL);
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname) ||
      (url.searchParams.get("schema") ?? "public") !== "public") {
    throw new Error("Foundation commands require a loopback PostgreSQL database and public schema.");
  }
  const client = new pg.Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 5000 });
  await client.connect();
  return client;
}
