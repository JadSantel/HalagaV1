import { handleLaptopDraftRequest } from "../../../../../server/repositories/laptop-drafts-http";

export async function POST(request: Request, context: { params: Promise<{ listingId: string }> }) {
  return handleLaptopDraftRequest(request, (await context.params).listingId, "submission-check");
}
