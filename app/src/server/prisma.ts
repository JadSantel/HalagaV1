import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { readRuntimeConfig } from "./runtime-config";

const developmentGlobal = globalThis as typeof globalThis & {
  halagaPrisma?: PrismaClient;
};

let client: PrismaClient | undefined;

/** Repository infrastructure only. Importing this module does not open a connection. */
export function getPrisma(): PrismaClient {
  if (client) return client;
  if (process.env.NODE_ENV !== "production" && developmentGlobal.halagaPrisma) {
    client = developmentGlobal.halagaPrisma;
    return client;
  }

  const { DATABASE_URL } = readRuntimeConfig(process.env);
  client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: DATABASE_URL }),
    log: [],
  });

  // Reuse the client when Next.js reloads server modules during development.
  if (process.env.NODE_ENV !== "production") developmentGlobal.halagaPrisma = client;
  return client;
}
