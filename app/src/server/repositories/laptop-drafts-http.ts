import "server-only";
import { createAuthPolicy } from "../auth-policy.ts";
import { getPrisma } from "../prisma.ts";
import { createAccountAuth } from "./auth.ts";
import { createLaptopDraftOperations, LaptopDraftRejected } from "./laptop-drafts.ts";

const privateHeaders = {
  "cache-control": "no-store", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow", vary: "Cookie",
};
const statuses = { INVALID_INPUT: 400, UNAUTHORIZED: 401, ACTION_RESTRICTED: 403, NOT_FOUND: 404, INVALID_STATE: 409, INTERNAL_ERROR: 500 } as const;

/** Private draft endpoints only. JSON writes require the configured exact origin.
 * No CORS, public reader, discovery projection, upload or lifecycle transition.
 */
export function createLaptopDraftHandler(operations: ReturnType<typeof createLaptopDraftOperations>, origin: string) {
  return async (request: Request, listingId?: string, review = false): Promise<Response> => {
    const reply = (body: unknown, status: number) => Response.json(body, { status, headers: privateHeaders });
    try {
      if (review && (!listingId || request.method !== "GET")) return reply({ code: "NOT_FOUND" }, 404);
      if (!(listingId ? ["GET", "PUT"] : ["GET", "POST"]).includes(request.method)) return reply({ code: "NOT_FOUND" }, 404);
      const write = request.method !== "GET";
      // Next may reconstruct request.url with its internal listener hostname.
      // Admission uses configured Origin, never a Host/proxy-derived trust list.
      if (request.headers.get("sec-fetch-site") === "cross-site" ||
          (write ? request.headers.get("origin") !== origin :
            request.headers.has("origin") && request.headers.get("origin") !== origin)) {
        return reply({ code: "UNAUTHORIZED" }, 401);
      }
      let input: unknown;
      if (write) {
        if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
          return reply({ code: "INVALID_INPUT" }, 400);
        }
        try { input = await request.json(); } catch { return reply({ code: "INVALID_INPUT" }, 400); }
      }
      const sessionHeaders = new Headers();
      const apply = (headers: Headers) => {
        for (const cookie of headers.getSetCookie()) sessionHeaders.append("set-cookie", cookie);
      };
      const result = review ? await operations.review(request.headers, listingId, new URL(request.url).searchParams.get("revision"), apply) : listingId
        ? request.method === "GET" ? await operations.read(request.headers, listingId, apply)
          : await operations.save(request.headers, listingId, input, apply)
        : request.method === "GET" ? await operations.list(request.headers, apply)
          : await operations.create(request.headers, input, apply);
      const response = reply(result, 200);
      for (const cookie of sessionHeaders.getSetCookie()) response.headers.append("set-cookie", cookie);
      return response;
    } catch (error) {
      const code = error instanceof LaptopDraftRejected ? error.code : "INTERNAL_ERROR";
      return reply({ code }, statuses[code]);
    }
  };
}

let handler: ReturnType<typeof createLaptopDraftHandler> | undefined;

export async function handleLaptopDraftRequest(request: Request, listingId?: string, review = false) {
  try {
    handler ??= createLaptopDraftHandler(createLaptopDraftOperations(getPrisma(), createAccountAuth()),
      new URL(createAuthPolicy(process.env).baseURL).origin);
    return await handler(request, listingId, review);
  } catch {
    return Response.json({ code: "INTERNAL_ERROR" }, { status: 500, headers: privateHeaders });
  }
}
