import "server-only";
import { createHeldLaptopReviewOperations, HeldReviewRejected } from "./held-laptop-review.ts";

const privateHeaders = { "cache-control":"no-store", "referrer-policy":"no-referrer",
  "x-content-type-options":"nosniff", "x-robots-tag":"noindex, nofollow", vary:"Cookie" };
const statuses = { INVALID_INPUT:400, UNAUTHORIZED:403, NOT_FOUND:404, INVALID_STATE:409, ELIGIBILITY_UNAVAILABLE:409, INTERNAL_ERROR:500 } as const;

/** Protected adapter for synthetic integration; deliberately NOT mounted. Admin
 * grants/coverage/bootstrap are not dispatchable here. Mounting requires verified
 * installation evidence and the independent held-submission prerequisites. */
export function createHeldReviewHandler(operations:ReturnType<typeof createHeldLaptopReviewOperations>,origin:string) {
  return async(request:Request) => {
    const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:privateHeaders});
    try {
      const path=new URL(request.url).pathname;
      if(request.headers.get("sec-fetch-site")==="cross-site" ||
        (request.method!=="GET" ? request.headers.get("origin")!==origin : request.headers.has("origin") && request.headers.get("origin")!==origin))
        return reply({code:"UNAUTHORIZED"},403);
      if(path==="/api/operator/held-laptops" && request.method==="GET") return reply(await operations.queue(request.headers));
      const match=path.match(/^\/api\/(operator|account)\/held-laptops\/([0-9a-f-]+)(?:\/([a-z-]+))?$/i);
      if(!match) return reply({code:"NOT_FOUND"},404);
      const [,scope,reviewId,action]=match;
      if(scope==="account" && !action && request.method==="GET") return reply(await operations.sellerDetail(request.headers,{reviewId}));
      const allowed=scope==="operator" ? ["claim","detail","decide","handoff","conflict","acknowledge-appeal","resolve-appeal"] : ["appeal","read-notice"];
      if(request.method!=="POST" || !allowed.includes(action)) return reply({code:"NOT_FOUND"},404);
      if(request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json") return reply({code:"INVALID_INPUT"},400);
      const body:unknown=await request.json().catch(()=>null);
      if(!body || typeof body!=="object" || Array.isArray(body) || Object.hasOwn(body,"reviewId")) return reply({code:"INVALID_INPUT"},400);
      const input={...body,reviewId};
      const method=action==="acknowledge-appeal" ? "acknowledgeAppeal" : action==="resolve-appeal" ? "resolveAppeal" : action==="read-notice" ? "readNotice" : action as "claim"|"detail"|"decide"|"handoff"|"conflict"|"appeal";
      return reply(await operations[method](request.headers,input));
    } catch(error) {
      const code=error instanceof HeldReviewRejected ? error.code : "INTERNAL_ERROR";
      return reply({code},statuses[code]);
    }
  };
}
