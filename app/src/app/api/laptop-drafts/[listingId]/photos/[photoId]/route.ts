import { handleDraftPhotoRequest } from "../../../../../../server/repositories/draft-photos-http";

type Context = { params: Promise<{ listingId: string; photoId: string }> };
async function handle(request: Request, context: Context) {
  const { listingId, photoId } = await context.params;
  return handleDraftPhotoRequest(request, listingId, photoId);
}
export const GET = handle;
export const PUT = handle;
export const DELETE = handle;
