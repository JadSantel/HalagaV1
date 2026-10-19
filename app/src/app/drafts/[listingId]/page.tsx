import type { Metadata } from "next";
import DraftWorkspace from "../workspace";

// Static metadata only: never read a private draft to construct a preview.
export const metadata: Metadata = {
  title: "Edit private laptop draft · Halaga",
  description: "Owner-private workspace for local synthetic validation.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function DraftPage({ params }: { params: Promise<{ listingId: string }> }) {
  return <DraftWorkspace listingId={(await params).listingId} />;
}
