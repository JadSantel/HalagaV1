import type { Metadata } from "next";
import DraftWorkspace from "./workspace";

export const metadata: Metadata = {
  title: "Your laptop drafts · Halaga",
  description: "Owner-private workspace for local synthetic validation.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function DraftsPage() {
  return <DraftWorkspace />;
}
