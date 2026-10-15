import { notFound } from "next/navigation";
import { AccountScreen, screens, type AccountScreenName } from "../screens";

export function generateStaticParams() {
  return Object.keys(screens).map((flow) => ({ flow }));
}

export default async function AccountFlowPage({ params }: { params: Promise<{ flow: string }> }) {
  const { flow } = await params;
  if (!Object.hasOwn(screens, flow)) notFound();
  return <AccountScreen name={flow as AccountScreenName} />;
}
