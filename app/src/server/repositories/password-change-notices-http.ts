import "server-only";
import { createAuthPolicy } from "../auth-policy.ts";
import { getPrisma } from "../prisma.ts";
import { createAccountAuth } from "./auth.ts";
import {
  createPasswordChangeNoticeListReader,
  createPasswordChangeNoticeReadMarker,
  PasswordChangeRejected,
} from "./password-change.ts";

const privateHeaders = {
  "cache-control": "no-store", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow", vary: "Cookie",
};
const statuses = { INVALID_INPUT: 400, UNAUTHORIZED: 401, INVALID_STATE: 409, INVALID_PASSWORD: 400, INTERNAL_ERROR: 500 } as const;

export function createPasswordChangeNoticeHandler(
  database: ReturnType<typeof getPrisma>, auth: ReturnType<typeof createAccountAuth>, origin: string,
) {
  const list = createPasswordChangeNoticeListReader(database, auth);
  const markRead = createPasswordChangeNoticeReadMarker(database, auth);
  return async (request: Request, noticeId?: string): Promise<Response> => {
    const reply = (body: unknown, status: number) => Response.json(body, { status, headers: privateHeaders });
    const isList = noticeId === undefined && request.method === "GET";
    const isRead = noticeId !== undefined && request.method === "POST";
    if (!isList && !isRead) return reply({ code: "NOT_FOUND" }, 404);
    const write = isRead;
    if (request.headers.get("sec-fetch-site") === "cross-site" ||
        (write ? request.headers.get("origin") !== origin :
          request.headers.has("origin") && request.headers.get("origin") !== origin)) {
      return reply({ code: "UNAUTHORIZED" }, 401);
    }
    const sessionHeaders = new Headers();
    const apply = (headers: Headers) => {
      for (const cookie of headers.getSetCookie()) sessionHeaders.append("set-cookie", cookie);
    };
    try {
      if (isList) {
        const notices = await list(request.headers, apply);
        if (notices === null) return reply({ code: "UNAUTHORIZED" }, 401);
        const response = reply({ notices }, 200);
        for (const cookie of sessionHeaders.getSetCookie()) response.headers.append("set-cookie", cookie);
        return response;
      }
      const result = await markRead(request.headers, noticeId, apply);
      if (!result) return reply({ code: "NOT_FOUND" }, 404);
      const response = reply({ status: "NOTICE_READ", readAt: result.readAt.toISOString() }, 200);
      for (const cookie of sessionHeaders.getSetCookie()) response.headers.append("set-cookie", cookie);
      return response;
    } catch (error) {
      const code = error instanceof PasswordChangeRejected ? error.code : "INTERNAL_ERROR";
      return reply({ code }, statuses[code]);
    }
  };
}

let handler: ReturnType<typeof createPasswordChangeNoticeHandler> | undefined;

export async function handlePasswordChangeNoticeRequest(request: Request, noticeId?: string) {
  try {
    handler ??= createPasswordChangeNoticeHandler(getPrisma(), createAccountAuth(),
      new URL(createAuthPolicy(process.env).baseURL).origin);
    return await handler(request, noticeId);
  } catch {
    return Response.json({ code: "INTERNAL_ERROR" }, { status: 500, headers: privateHeaders });
  }
}
