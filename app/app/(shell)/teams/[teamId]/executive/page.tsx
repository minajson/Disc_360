import type { Metadata } from "next";
import { getTeamIntelligence } from "@/lib/insights/team";
import {
  balanceVerdict,
  behaviourDistribution,
  collaborationSummary,
  communicationTendencies,
  decisionStyle,
  facilitatorInsights,
  riskRegister,
  strengthDistribution,
  type BoardProfile,
} from "@/lib/insights/board";
import { ExecutiveBrief } from "@/components/teams/ExecutiveBrief";

export const metadata: Metadata = { title: "Executive brief" };

/**
 * Presentation-grade team results. The page composes; every number comes from
 * the pure, tested board metrics so the projected slide and the exported PDF
 * can never disagree with the report.
 */
export default async function TeamExecutivePage({
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

  const boardProfiles: BoardProfile[] = data.profiles.map((profile) => ({
    scores: profile.scores,
    primary: profile.primary,
    archetypeCode: profile.archetypeCode,
    department: profile.department,
  }));

  const input = {
    profiles: boardProfiles,
    averages: data.averages,
    memberCount: data.memberCount,
    completedCount: data.completedCount,
  };

  return (
    <ExecutiveBrief
      data={{
        teamId: data.teamId,
        teamName: data.teamName,
        named: data.named,
        memberCount: data.memberCount,
        completedCount: data.completedCount,
        averages: data.averages,
        profiles: data.profiles,
        cultureSummary: data.cultureSummary,
        collaboration: collaborationSummary(boardProfiles, data.averages),
        balance: balanceVerdict(data.averages),
        distribution: behaviourDistribution(boardProfiles),
        strengths: strengthDistribution(boardProfiles),
        communication: communicationTendencies(boardProfiles),
        decision: decisionStyle(data.averages),
        insights: facilitatorInsights(input),
        risks: riskRegister(input),
      }}
    />
  );
}
