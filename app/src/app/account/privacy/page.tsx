import type { Metadata } from "next";
import { AccountPolicyDocument } from "../policy-document";

export const metadata: Metadata = { title: "Privacy Notice review draft · Halaga", robots: { index: false, follow: false } };

export default function PrivacyDraftPage() {
  return <AccountPolicyDocument name="privacy" />;
}
