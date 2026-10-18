import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccountScreen, screens, type AccountScreenName } from "../screens";

export function generateStaticParams() {
  return Object.keys(screens).map((flow) => ({ flow }));
}

export default function AccountFlowPage({ params }: { params: Promise<{ flow: string }> }) {
  return <Suspense fallback={<p role="status">Opening account screen…</p>}>
    <AccountFlowContent params={params} />
  </Suspense>;
}

async function AccountFlowContent({ params }: { params: Promise<{ flow: string }> }) {
  const { flow } = await params;
  if (!Object.hasOwn(screens, flow)) notFound();
  return <AccountScreen name={flow as AccountScreenName} />;
}
