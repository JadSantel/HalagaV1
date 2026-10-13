import { betterAuth } from "better-auth";

// Schema tooling only. Never import this fixture into application routes.
// Core identity schema only; runtime policy and the additional counter table follow ADR-086.
export const auth = betterAuth({
  secret: "synthetic-schema-generation-secret-never-use-at-runtime",
  baseURL: "http://127.0.0.1:3000",
  emailAndPassword: { enabled: true },
});
