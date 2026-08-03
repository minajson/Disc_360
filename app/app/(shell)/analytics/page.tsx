import type { Metadata } from "next";
import { getExecutiveAnalytics } from "@/lib/insights/executive";
import { ExecutiveAnalyticsView } from "@/components/analytics/ExecutiveAnalyticsView";

export const metadata: Metadata = { title: "Executive analytics" };

/**
 * Organisation-wide analytics for whoever administers the teams. Scope is
 * resolved server-side from real memberships (or platform scope for a super
 * admin) — no team id is ever accepted from the client.
 */
export default async function AnalyticsPage() {
  const data = await getExecutiveAnalytics();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-12 sm:px-8">
      <ExecutiveAnalyticsView data={data} />
    </div>
  );
}
