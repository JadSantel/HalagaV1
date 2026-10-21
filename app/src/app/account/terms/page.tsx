import type { Metadata } from "next";
import { AccountPolicyDocument } from "../policy-document";

export const metadata: Metadata = { title: "Terms of Use review draft · Halaga", robots: { index: false, follow: false } };

export default function TermsDraftPage() {
  return <AccountPolicyDocument name="terms" />;
}
