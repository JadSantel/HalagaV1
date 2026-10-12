import "dotenv/config";
import pg from "pg";
import { readRuntimeConfig } from "../src/server/runtime-config.ts";

let client;
try {
  const { DATABASE_URL } = readRuntimeConfig(process.env);
  const hostname = new URL(DATABASE_URL).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    throw new Error("The local connection check only accepts a loopback database.");
  }

  client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query("SELECT 1");
  console.log("Local PostgreSQL connection succeeded. No data was read or changed.");
} catch {
  console.error("Local PostgreSQL connection failed. Check app/.env, the DATABASE_URL format, and the PostgreSQL service.");
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
}
