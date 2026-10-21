import { handleLaptopDraftRequest } from "../../../../../server/repositories/laptop-drafts-http";

export async function GET(request: Request, context: { params: Promise<{ listingId: string }> }) {
  return handleLaptopDraftRequest(request, (await context.params).listingId, true);
}
