import { handleLaptopDraftRequest } from "../../../../server/repositories/laptop-drafts-http";

type Context = { params: Promise<{ listingId: string }> };

export async function GET(request: Request, context: Context) {
  return handleLaptopDraftRequest(request, (await context.params).listingId);
}

export async function PUT(request: Request, context: Context) {
  return handleLaptopDraftRequest(request, (await context.params).listingId);
}
