import { handlePasswordChangeNoticeRequest } from "../../../../../../server/repositories/password-change-notices-http.ts";

export async function POST(request: Request, context: { params: Promise<{ noticeId: string }> }) {
  const { noticeId } = await context.params;
  return handlePasswordChangeNoticeRequest(request, noticeId);
}
