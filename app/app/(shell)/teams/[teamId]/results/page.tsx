import type { Metadata } from "next";
import { getTeamIntelligence } from "@/lib/insights/team";
import { TeamIntelligenceView } from "@/components/teams/TeamIntelligenceView";

export const metadata: Metadata = { title: "Team intelligence" };

export default async function TeamResultsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const data = await getTeamIntelligence(teamId);

  if ("error" in data) {
    return (
      <div className="paper-card p-8 text-sm leading-relaxed text-slate">
        {data.error}
      </div>
    );
  }

  return <TeamIntelligenceView data={data} />;
}
