import { handlePasswordChangeNoticeRequest } from "../../../../server/repositories/password-change-notices-http.ts";

export async function GET(request: Request) {
  return handlePasswordChangeNoticeRequest(request);
}
