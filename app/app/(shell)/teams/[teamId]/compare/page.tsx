import type { Metadata } from "next";
import { getTeamIntelligence } from "@/lib/insights/team";
import { ComparisonWorkspace } from "@/components/teams/comparison/ComparisonWorkspace";
import type { ComparisonMember } from "@/lib/insights/comparison";

export const metadata: Metadata = { title: "Compare members" };

/**
 * Facilitator scope. getTeamIntelligence has already resolved membership,
 * applied the team's anonymization setting and dropped anyone without a
 * completed profile, so the labels handed to the client are the only labels
 * that team is allowed to show.
 */
export default async function TeamComparePage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const data = await getTeamIntelligence(teamId, { requireAdmin: true });

  if ("error" in data) {
    return (
      <div className="paper-card p-8 text-sm leading-relaxed text-slate">
        {data.error}
      </div>
    );
  }

  // Index-based ids: stable for one render, and never a database identifier
  // leaving the server.
  const members: ComparisonMember[] = data.profiles.map((profile, index) => ({
    id: `member-${index}`,
    label: profile.label,
    department: profile.department,
    roleTitle: profile.roleTitle,
    scores: profile.scores,
    archetypeName: profile.archetypeName,
    primary: profile.primary,
  }));

  return (
    <ComparisonWorkspace
      members={members}
      teamName={data.teamName}
      named={data.named}
      teamId={teamId}
    />
  );
}
