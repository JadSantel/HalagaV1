import { handleLaptopDraftRequest } from "../../../server/repositories/laptop-drafts-http";

export async function POST(request: Request) {
  return handleLaptopDraftRequest(request);
}
