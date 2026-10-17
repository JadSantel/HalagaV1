import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { PrismaClient } from "../generated/prisma/client.ts";
import { readRuntimeConfig } from "./runtime-config.ts";

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
    // The installed adapter normalizes timestamptz offsets to UTC without conversion.
    // Pin every connection so verification/deadline instants are read correctly.
    adapter: new PrismaPg({ connectionString: DATABASE_URL, options: "-c timezone=UTC" }),
    log: [],
  });

  // Reuse the client when Next.js reloads server modules during development.
  if (process.env.NODE_ENV !== "production") developmentGlobal.halagaPrisma = client;
  return client;
}

/** Better Auth owns its private tables; expose its adapter only to the account repository. */
export function getAuthDatabase() {
  return prismaAdapter(getPrisma(), { provider: "postgresql", transaction: true });
}
