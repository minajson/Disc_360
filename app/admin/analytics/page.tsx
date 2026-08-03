import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { getExecutiveAnalytics } from "@/lib/insights/executive";
import { ExecutiveAnalyticsView } from "@/components/analytics/ExecutiveAnalyticsView";

export const metadata: Metadata = { title: "Analytics · Admin" };

/**
 * Platform-wide executive analytics. The guard here is belt-and-braces:
 * getExecutiveAnalytics resolves platform scope from is_super_admin on the
 * profile itself, so a non-admin reaching this route would see only their own
 * teams — but the admin shell should still refuse to render for them.
 */
export default async function AdminAnalyticsPage() {
  await requireSuperAdmin();
  const data = await getExecutiveAnalytics();

  return <ExecutiveAnalyticsView data={data} />;
}
