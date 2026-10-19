import { handleLaptopDraftRequest } from "../../../server/repositories/laptop-drafts-http";

export async function GET(request: Request) {
  return handleLaptopDraftRequest(request);
}

export async function POST(request: Request) {
  return handleLaptopDraftRequest(request);
}
