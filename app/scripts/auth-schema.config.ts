import { betterAuth } from "better-auth";

// Schema tooling only. Never import this fixture into application routes.
// Runtime session/security/email settings remain implementation decisions.
export const auth = betterAuth({
  secret: "synthetic-schema-generation-secret-never-use-at-runtime",
  baseURL: "http://127.0.0.1:3000",
  emailAndPassword: { enabled: true },
});
