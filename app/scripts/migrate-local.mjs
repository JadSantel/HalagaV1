import { spawnSync } from "node:child_process";
import { openLocalDatabase } from "./local-database.mjs";

let client;
try {
  client = await openLocalDatabase();
  const { rows } = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  );
  if (rows.length && !rows.some(({ tablename }) => tablename === "_prisma_migrations")) {
    throw new Error("Refusing to baseline a populated, untracked public schema.");
  }
  await client.end();
  client = undefined;
  const result = spawnSync(process.execPath, [
    "node_modules/prisma/build/index.js", "migrate", "deploy", "--config", "prisma7.config.ts",
  ], { stdio: "inherit", env: process.env });
  if (result.error) throw new Error("Could not start the installed Prisma CLI.");
  process.exitCode = result.status ?? 1;
} catch {
  console.error("Local migration stopped. Check the local connection and whether public tables already have migration history.");
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
}
