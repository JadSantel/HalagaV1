import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const databaseImports = {
  group: ["@prisma/**", "@better-auth/prisma-adapter", "pg", "pg/**", "**/generated/prisma/**"],
  message: "Only src/server/prisma.ts may import database clients and drivers. Use a scoped server repository.",
};
const sharedClientImports = {
  group: ["**/prisma", "**/prisma.*"],
  message: "Only src/server/repositories may import the shared Prisma client. Use a scoped repository method.",
};

// no-restricted-imports covers static imports and re-exports; these cover dynamic imports and require().
function runtimeImportRestrictions(pattern) {
  const source = pattern.replaceAll("/", "\\/");
  return [
    {
      selector: `ImportExpression[source.value=/${source}/]`,
      message: "Database access must go through the server repository boundary.",
    },
    {
      selector: `CallExpression[callee.name='require'][arguments.0.value=/${source}/]`,
      message: "Database access must go through the server repository boundary.",
    },
  ];
}

const databaseRuntimeImports = runtimeImportRestrictions(
  "^(@prisma/|@better-auth/prisma-adapter$|pg(/|$))|(^|/)generated/prisma(/|$)",
);
const sharedClientRuntimeImports = runtimeImportRestrictions("(^|/)prisma(\\.[^/]+)?$");
const serverMarkerRequired = {
  selector: "Program:not(:has(ImportDeclaration[source.value='server-only']))",
  message: "Prisma infrastructure and repository modules must import 'server-only'.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx,js,jsx,mjs}"],
    ignores: ["src/generated/**", "src/server/prisma.ts", "src/server/repositories/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [databaseImports, sharedClientImports] }],
      "no-restricted-syntax": ["error", ...databaseRuntimeImports, ...sharedClientRuntimeImports],
    },
  },
  {
    files: ["src/server/repositories/**/*.{ts,tsx,js,jsx,mjs}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [databaseImports] }],
      "no-restricted-syntax": ["error", ...databaseRuntimeImports, serverMarkerRequired],
    },
  },
  {
    files: ["src/server/prisma.ts"],
    rules: { "no-restricted-syntax": ["error", serverMarkerRequired] },
  },
  {
    files: ["src/server/guarded-command.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...databaseRuntimeImports, ...sharedClientRuntimeImports, serverMarkerRequired],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
]);

export default eslintConfig;
