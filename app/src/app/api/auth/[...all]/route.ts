import { handleAccountEmailRequest } from "../../../../server/repositories/account-email-http";
import { handleAccountSignInRequest } from "../../../../server/repositories/sign-in-http";
import { handleAccountSignupRequest } from "../../../../server/repositories/signup-http";

export async function POST(request: Request) {
  if (new URL(request.url).pathname === "/api/auth/sign-up/email") return handleAccountSignupRequest(request);
  return new URL(request.url).pathname === "/api/auth/sign-in/email"
    ? handleAccountSignInRequest(request)
    : handleAccountEmailRequest(request);
}
