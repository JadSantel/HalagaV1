import { handleDraftPhotoRequest } from "../../../../../server/repositories/draft-photos-http";

type Context = { params: Promise<{ listingId: string }> };
export async function GET(request: Request, context: Context) { return handleDraftPhotoRequest(request, (await context.params).listingId); }
export async function POST(request: Request, context: Context) { return handleDraftPhotoRequest(request, (await context.params).listingId); }
export async function PATCH(request: Request, context: Context) { return handleDraftPhotoRequest(request, (await context.params).listingId); }
