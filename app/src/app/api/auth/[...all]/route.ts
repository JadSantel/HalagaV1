import { handleAccountEmailRequest } from "../../../../server/repositories/account-email-http";
import { handleAccountSignInRequest } from "../../../../server/repositories/sign-in-http";

export async function POST(request: Request) {
  return new URL(request.url).pathname === "/api/auth/sign-in/email"
    ? handleAccountSignInRequest(request)
    : handleAccountEmailRequest(request);
}
