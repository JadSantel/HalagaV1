import type { Metadata } from "next";
import { Suspense } from "react";
import DraftReview from "../../review";

// The HTML shell and metadata never read saved draft content.
export const metadata: Metadata = {
  title: "Review saved laptop revision · Halaga",
  description: "Owner-private review for local synthetic validation.",
  robots: { index: false, follow: false }, referrer: "no-referrer",
};

type Props = {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{ revision?: string | string[] }>;
};

async function SavedReview({ params, searchParams }: Props) {
  const { revision } = await searchParams;
  return <DraftReview listingId={(await params).listingId} revision={typeof revision === "string" ? revision : ""} />;
}

export default function ReviewPage(props: Props) {
  return <Suspense fallback={<p role="status">Loading private revision review…</p>}><SavedReview {...props} /></Suspense>;
}
