import type { Metadata } from "next";
import { getTeamInsights } from "@/lib/insights/team-insights";
import { FacilitatorInsightsView } from "@/components/teams/insights/FacilitatorInsightsView";

export const metadata: Metadata = { title: "Facilitator insights" };

/**
 * Facilitator scope, single team. getTeamInsights authorizes the viewer and
 * resolves every profile from this teamId alone.
 */
export default async function TeamInsightsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const payload = await getTeamInsights(teamId);

  if ("error" in payload) {
    return (
      <div className="paper-card p-8 text-sm leading-relaxed text-slate">
        {payload.error}
      </div>
    );
  }

  return (
    <FacilitatorInsightsView
      set={payload.set}
      departments={payload.departments}
      teamName={payload.teamName}
      memberCount={payload.memberCount}
      completedCount={payload.completedCount}
    />
  );
}
