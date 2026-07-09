import { dimensionMeta } from "@/data/dimension-meta";
import { DEMO_TEAM_ID } from "@/data/team-demo-data";
import { db } from "@/lib/mock-db/client";
import {
  DIMENSION_KEY,
  DIMENSIONS,
  type Dimension,
  type DiscScores,
  type Team,
  type TeamMember,
} from "@/lib/types";

export interface TeamOverview {
  team: Team;
  members: TeamMember[];
  /** Members whose primary dimension is D / I / S / C. */
  composition: Record<Dimension, number>;
  /** Mean normalized score per dimension across the roster. */
  averages: DiscScores;
  insights: TeamInsight[];
}

export interface TeamInsight {
  kind: "strength" | "gap" | "balance";
  title: string;
  detail: string;
}

function primaryOf(member: TeamMember): Dimension {
  const first = member.archetypeCode === "BAL"
    ? rankByScore(member.normalized)[0]
    : (member.archetypeCode[0] as Dimension);
  return first ?? "D";
}

function rankByScore(scores: DiscScores): Dimension[] {
  return [...DIMENSIONS].sort(
    (a, b) => scores[DIMENSION_KEY[b]] - scores[DIMENSION_KEY[a]],
  );
}

const strengthCopy: Record<Dimension, string> = {
  D: "This team pushes. Decisions get made, stalls get broken, and ambitious targets feel normal. Guard against speed outrunning verification.",
  I: "This team sells. Energy, persuasion, and morale are abundant — ideas get momentum fast. Guard against enthusiasm being mistaken for commitment.",
  S: "This team holds. Follow-through, loyalty, and calm are its baseline — long projects land. Guard against comfort delaying necessary change.",
  C: "This team verifies. Standards are high and errors die young. Guard against analysis stretching past the moment a decision was needed.",
};

const gapCopy: Record<Dimension, string> = {
  D: "Low Dominant coverage: confrontation and fast unilateral calls will be under-supplied. Decisions may drift toward consensus by exhaustion. Lean on your highest-Dominant members for deadlock-breaking, or hire for it.",
  I: "Low Influence coverage: the team's work may be better than its story. Evangelism, morale, and stakeholder warmth need deliberate owners rather than assumed ones.",
  S: "Low Stable coverage: plenty of spark, less ballast. Long projects risk mid-flight abandonment and quiet burnout. Protect rhythms and finishing energy deliberately.",
  C: "Low Analytical coverage: speed and warmth without enough scrutiny. Fine print, edge cases, and inconvenient data need an explicit champion before they find you in production.",
};

function buildInsights(
  composition: Record<Dimension, number>,
  averages: DiscScores,
  memberCount: number,
): TeamInsight[] {
  const insights: TeamInsight[] = [];

  const byAvg = rankByScore(averages);
  const strongest = byAvg[0] as Dimension;
  const weakest = byAvg[3] as Dimension;

  insights.push({
    kind: "strength",
    title: `Center of gravity: ${dimensionMeta[strongest].label}`,
    detail: strengthCopy[strongest],
  });

  insights.push({
    kind: "gap",
    title: `Coverage gap: ${dimensionMeta[weakest].label}`,
    detail: gapCopy[weakest],
  });

  const spread =
    averages[DIMENSION_KEY[strongest]] - averages[DIMENSION_KEY[weakest]];
  insights.push({
    kind: "balance",
    title: spread <= 15 ? "Well-distributed styles" : "Concentrated style mix",
    detail:
      spread <= 15
        ? `Across ${memberCount} members, all four dimensions are within ${spread} points — this team can meet most situations with a native speaker. The risk is dilution: make sure ownership of each mode is explicit, not assumed.`
        : `Team averages span ${spread} points between ${dimensionMeta[strongest].label} and ${dimensionMeta[weakest].label}. Expect fast agreement inside the majority style — and blind spots where the minority styles would have objected.`,
  });

  return insights;
}

/** Full overview for the demo team. */
export async function getTeamOverview(): Promise<TeamOverview | null> {
  const team = (await db.team.findUnique({
    where: { id: DEMO_TEAM_ID },
  })) as Team | null;
  if (!team) return null;

  const members = (await db.teamMember.findMany({
    where: { teamId: team.id },
    orderBy: { field: "displayName", direction: "asc" },
  })) as TeamMember[];

  const composition: Record<Dimension, number> = { D: 0, I: 0, S: 0, C: 0 };
  const totals: DiscScores = { d: 0, i: 0, s: 0, c: 0 };
  for (const member of members) {
    composition[primaryOf(member)] += 1;
    for (const dim of DIMENSIONS) {
      totals[DIMENSION_KEY[dim]] += member.normalized[DIMENSION_KEY[dim]];
    }
  }

  const count = Math.max(1, members.length);
  const averages: DiscScores = {
    d: Math.round(totals.d / count),
    i: Math.round(totals.i / count),
    s: Math.round(totals.s / count),
    c: Math.round(totals.c / count),
  };

  return {
    team,
    members,
    composition,
    averages,
    insights: buildInsights(composition, averages, members.length),
  };
}
