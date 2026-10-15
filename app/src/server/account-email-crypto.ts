import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EmailTokenContext = Readonly<{
  outboxEventId: string;
  accountId: string;
  eventType: string;
  eventVersion: number;
  deduplicationKey: string;
}>;

type Keyring = Readonly<{ active: string; keys: Readonly<Record<string, Buffer>> }>;
const localKey = Buffer.from("halaga-local-email-delivery-key-never-deploy", "utf8").subarray(0, 32);

function readKeyring(): Keyring {
  const raw = process.env.ACCOUNT_EMAIL_KEYRING;
  if (!raw && process.env.NODE_ENV !== "production") return { active: "local-only", keys: { "local-only": localKey } };
  if (!raw) throw new Error("ACCOUNT_EMAIL_KEYRING is required");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("ACCOUNT_EMAIL_KEYRING is invalid"); }
  if (!parsed || typeof parsed !== "object" || !("active" in parsed) || !("keys" in parsed) ||
      typeof parsed.active !== "string" || !parsed.keys || typeof parsed.keys !== "object") {
    throw new Error("ACCOUNT_EMAIL_KEYRING is invalid");
  }
  const keys = Object.create(null) as Record<string, Buffer>;
  for (const [id, encoded] of Object.entries(parsed.keys)) {
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(id) || typeof encoded !== "string" ||
        !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw new Error("ACCOUNT_EMAIL_KEYRING is invalid");
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32 || key.toString("base64") !== encoded) throw new Error("ACCOUNT_EMAIL_KEYRING is invalid");
    keys[id] = key;
  }
  if (!Object.hasOwn(keys, parsed.active)) throw new Error("ACCOUNT_EMAIL_KEYRING is invalid");
  return { active: parsed.active, keys };
}

function aad(context: EmailTokenContext) {
  return Buffer.from(JSON.stringify([
    context.outboxEventId, context.accountId, context.eventType,
    context.eventVersion, context.deduplicationKey,
  ]));
}

export function encryptAccountEmailToken(token: string, context: EmailTokenContext) {
  const keyring = readKeyring();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyring.keys[keyring.active], iv);
  cipher.setAAD(aad(context));
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return { keyId: keyring.active, ciphertext: Buffer.concat([iv, cipher.getAuthTag(), body]) };
}

export function accountEmailTokenRecord(token: string, context: EmailTokenContext, expiresAt: Date) {
  const encrypted = encryptAccountEmailToken(token, context);
  return { outboxEventId: context.outboxEventId, keyId: encrypted.keyId,
    ciphertext: encrypted.ciphertext, expiresAt };
}

export function decryptAccountEmailToken(
  keyId: string, ciphertext: Uint8Array, context: EmailTokenContext,
) {
  const keyring = readKeyring();
  const key = keyring.keys[keyId];
  const input = Buffer.from(ciphertext);
  if (!key || input.length < 29) throw new Error("EMAIL_PAYLOAD_UNAVAILABLE");
  const decipher = createDecipheriv("aes-256-gcm", key, input.subarray(0, 12));
  decipher.setAAD(aad(context));
  decipher.setAuthTag(input.subarray(12, 28));
  return Buffer.concat([decipher.update(input.subarray(28)), decipher.final()]).toString("utf8");
}
