import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";

const eslint = new ESLint();

async function boundaryErrors(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  assert.equal(result.fatalErrorCount, 0, "The synthetic module must parse before checking the boundary.");
  return result.messages.filter(({ ruleId }) =>
    ruleId === "no-restricted-imports" || ruleId === "no-restricted-syntax");
}

test("pages, components, domain and non-repository server modules cannot bypass repositories", async () => {
  const forbidden = [
    'import { PrismaClient } from "@prisma/client";',
    'import { PrismaPg } from "@prisma/adapter-pg";',
    'import pg from "pg";',
    'import { PrismaClient } from "@/generated/prisma/client";',
    'import { PrismaClient } from "../generated/prisma/client";',
    'import { getPrisma } from "@/server/prisma";',
    'import { getPrisma } from "../server/prisma.ts";',
    'export { getPrisma } from "@/server/prisma";',
    'export * from "@/generated/prisma/client";',
    'const client = await import("@/server/prisma");',
    'const client = await import("@/generated/prisma/client");',
    'const driver = require("pg");',
    'const client = require("@/server/prisma");',
  ];
  for (const filePath of ["src/app/page.tsx", "src/app/synthetic-client.tsx", "src/domain/synthetic.ts", "src/server/synthetic.ts", "src/server/guarded-command.ts", "src/server/atomic-publication-decision.ts"]) {
    for (const code of forbidden) {
      assert.ok((await boundaryErrors(`import "server-only"; ${code}`, filePath)).length > 0, `${filePath}: ${code}`);
    }
  }
  assert.deepEqual(await boundaryErrors(
    'import { getAuthorizedProjection } from "@/server/repositories/synthetic";', "src/app/page.tsx",
  ), []);
});

test("only marked server infrastructure and repositories receive their allowed imports", async () => {
  const repository = "src/server/repositories/synthetic.ts";
  assert.deepEqual(await boundaryErrors(
    'import "server-only"; import { getPrisma } from "../prisma";', repository,
  ), []);
  assert.ok((await boundaryErrors('import { getPrisma } from "../prisma";', repository)).length > 0);
  for (const code of [
    'import { PrismaClient } from "../../generated/prisma/client";',
    'import pg from "pg";',
    'const driver = await import("@prisma/adapter-pg");',
  ]) {
    assert.ok((await boundaryErrors(`import "server-only"; ${code}`, repository)).length > 0, code);
  }
  assert.deepEqual(await boundaryErrors(
    'import "server-only"; import { PrismaClient } from "../generated/prisma/client"; import { PrismaPg } from "@prisma/adapter-pg";',
    "src/server/prisma.ts",
  ), []);
  assert.ok((await boundaryErrors(
    'import { PrismaClient } from "../generated/prisma/client";', "src/server/prisma.ts",
  )).length > 0);
  assert.deepEqual(await boundaryErrors('import "server-only";', "src/server/guarded-command.ts"), []);
  assert.ok((await boundaryErrors('export const synthetic = true;', "src/server/guarded-command.ts")).length > 0);
  assert.deepEqual(await boundaryErrors('import "server-only";', "src/server/atomic-publication-decision.ts"), []);
  assert.ok((await boundaryErrors('export const synthetic = true;', "src/server/atomic-publication-decision.ts")).length > 0);
});
