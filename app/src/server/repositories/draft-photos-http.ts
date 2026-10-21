import "server-only";
import { createAuthPolicy } from "../auth-policy.ts";
import { openPhotoStore } from "../draft-photo-processing.ts";
import { getPrisma } from "../prisma.ts";
import { createAccountAuth } from "./auth.ts";
import { createLaptopDraftOperations, LaptopDraftRejected } from "./laptop-drafts.ts";
import { createDraftPhotoOperations } from "./draft-photos.ts";

const privateHeaders = { "cache-control": "no-store", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow", vary: "Cookie" };
const codes = { INVALID_INPUT: 400, UNAUTHORIZED: 401, ACTION_RESTRICTED: 403, NOT_FOUND: 404, INVALID_STATE: 409, INTERNAL_ERROR: 500 } as const;

export function createDraftPhotoHandler(photos: ReturnType<typeof createDraftPhotoOperations>, origin: string) {
  return async (request: Request, listingId: string, photoId?: string) => {
    const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: privateHeaders });
    try {
      const write = request.method !== "GET";
      if (request.headers.get("sec-fetch-site") === "cross-site" || (write ? request.headers.get("origin") !== origin :
        request.headers.has("origin") && request.headers.get("origin") !== origin)) return reply({ code: "UNAUTHORIZED" }, 401);
      if (!(photoId ? ["GET", "PUT", "DELETE"] : ["GET", "POST", "PATCH"]).includes(request.method)) return reply({ code: "NOT_FOUND" }, 404);
      const cookies = new Headers();
      const apply = (headers: Headers) => { for (const cookie of headers.getSetCookie()) cookies.append("set-cookie", cookie); };
      let value: unknown;
      if (request.method === "GET") {
        const revision = new URL(request.url).searchParams.get("revision");
        if (photoId) {
          const bytes = await photos.image(request.headers, listingId, photoId, revision, apply);
          const response = new Response(new Uint8Array(bytes), { headers: { ...privateHeaders, "content-type": "image/jpeg", "content-disposition": "inline" } });
          for (const cookie of cookies.getSetCookie()) response.headers.append("set-cookie", cookie);
          return response;
        }
        value = await photos.list(request.headers, listingId, revision, apply);
      } else if (photoId) {
        value = request.method === "DELETE" ? await photos.cancel(request.headers, listingId, photoId, apply) :
          await photos.upload(request.headers, listingId, photoId, request.body, request.headers.get("content-type") ?? "", apply);
      } else {
        if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return reply({ code: "INVALID_INPUT" }, 400);
        // Admission/order bodies contain fixed schemas. Bounded streaming also rejects oversized JSON.
        const reader = request.body?.getReader();
        if (!reader) return reply({ code: "INVALID_INPUT" }, 400);
        let input: unknown;
        try {
          const chunks: Uint8Array[] = []; let length = 0;
          while (true) {
            const chunk = await reader.read(); if (chunk.done) break;
            length += chunk.value.length;
            if (length > 10 * 1024 * 1024) throw new Error();
            chunks.push(chunk.value);
          }
          input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch { return reply({ code: "INVALID_INPUT" }, 400); }
        finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
        value = request.method === "POST" ? await photos.admit(request.headers, listingId, input, apply) :
          await photos.change(request.headers, listingId, input, apply);
      }
      const response = reply(value);
      for (const cookie of cookies.getSetCookie()) response.headers.append("set-cookie", cookie);
      return response;
    } catch (error) {
      const code = error instanceof LaptopDraftRejected ? error.code : "INTERNAL_ERROR";
      return reply({ code }, codes[code]);
    }
  };
}

let handler: ReturnType<typeof createDraftPhotoHandler> | undefined;
export async function handleDraftPhotoRequest(request: Request, listingId: string, photoId?: string) {
  try {
    handler ??= createDraftPhotoHandler(createDraftPhotoOperations(createLaptopDraftOperations(getPrisma(), createAccountAuth()),
      await openPhotoStore(process.env.DRAFT_PHOTO_ROOT ?? "")), new URL(createAuthPolicy(process.env).baseURL).origin);
    return await handler(request, listingId, photoId);
  } catch { return Response.json({ code: "INTERNAL_ERROR" }, { status: 500, headers: privateHeaders }); }
}
