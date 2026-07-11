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
  /** Unique departments represented on the roster. */
  departments: string[];
  /** Members whose primary dimension is D / I / S / C. */
  composition: Record<Dimension, number>;
  /** Mean normalized score per dimension across the roster. */
  averages: DiscScores;
  cultureSummary: string;
  insights: TeamInsight[];
  communicationGaps: CommunicationGap[];
  riskZones: RiskZone[];
  actions: TeamAction[];
}

export interface TeamInsight {
  kind: "strength" | "gap" | "balance";
  title: string;
  detail: string;
}

export interface CommunicationGap {
  /** Labels of the two styles that talk past each other. */
  between: [string, string];
  friction: string;
  bridge: string;
}

export interface RiskZone {
  severity: "high" | "watch";
  title: string;
  detail: string;
}

export interface TeamAction {
  audience: "team" | "coach";
  action: string;
}

const HIGH_SCORE = 60;

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

function countHigh(members: TeamMember[], dim: Dimension): number {
  return members.filter(
    (member) => member.normalized[DIMENSION_KEY[dim]] >= HIGH_SCORE,
  ).length;
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

const cultureTone: Record<Dimension, string> = {
  D: "a direct, outcome-first culture where pace is a value and hesitation is expensive",
  I: "an expressive, relationship-rich culture where ideas travel on enthusiasm",
  S: "a steady, loyal culture that finishes what it starts and protects its people",
  C: "a rigorous, evidence-first culture where quality is identity",
};

function buildCultureSummary(
  averages: DiscScores,
  composition: Record<Dimension, number>,
  memberCount: number,
): string {
  const ranked = rankByScore(averages);
  const lead = ranked[0] as Dimension;
  const second = ranked[1] as Dimension;
  const trailing = ranked[3] as Dimension;
  const spread =
    averages[DIMENSION_KEY[lead]] - averages[DIMENSION_KEY[trailing]];

  const texture =
    spread <= 15
      ? "Styles are evenly distributed, so most situations find a native speaker — the culture flexes rather than dominates."
      : `${dimensionMeta[lead].label} energy sets the tone, and the ${dimensionMeta[trailing].label} perspective has to fight for airtime.`;

  return `Across ${memberCount} members, this reads as ${cultureTone[lead]}, seasoned with ${dimensionMeta[second].label.toLowerCase()} energy. ${texture} ${composition[trailing] === 0 ? `No one carries ${dimensionMeta[trailing].label} as a primary style — treat that voice as an explicit agenda item, not an assumption.` : ""}`.trim();
}

function buildCommunicationGaps(members: TeamMember[]): CommunicationGap[] {
  const gaps: CommunicationGap[] = [];
  const highD = countHigh(members, "D");
  const highS = countHigh(members, "S");
  const highI = countHigh(members, "I");
  const highC = countHigh(members, "C");

  if (highD > 0 && highS > 0) {
    gaps.push({
      between: ["Dominant", "Stable"],
      friction: `${highD} member${highD === 1 ? "" : "s"} run high Dominant and ${highS} run high Stable. Directness lands as aggression in one direction; deliberateness lands as resistance in the other. Watch for Stable members going quiet in rooms the Dominant members think went well.`,
      bridge:
        "Agree on decision runway: Dominant voices give advance notice of big calls; Stable voices commit to voicing objections within 48 hours instead of absorbing them.",
    });
  }
  if (highI > 0 && highC > 0) {
    gaps.push({
      between: ["Influence", "Analytical"],
      friction: `${highI} member${highI === 1 ? "" : "s"} run high Influence and ${highC} run high Analytical. Enthusiasm reads as hand-waving to the Analytical side; scrutiny reads as negativity to the Influence side. Ideas die in the gap between the pitch and the proof.`,
      bridge:
        "Split the pipeline: Influence members open doors and frame the story; Analytical members get the numbers before the meeting, not during it — and their sign-off is announced as part of the win.",
    });
  }
  if (gaps.length === 0) {
    gaps.push({
      between: ["Aligned styles", "Missing counterweights"],
      friction:
        "No high-tension style pairs sit on this roster — communication friction will be low, but so is productive friction. Agreement may come too easily.",
      bridge:
        "Import the missing voice deliberately: rotate a devil's-advocate role, or borrow a reviewer from another team for consequential decisions.",
    });
  }
  return gaps;
}

function buildRiskZones(
  members: TeamMember[],
  composition: Record<Dimension, number>,
  averages: DiscScores,
): RiskZone[] {
  const zones: RiskZone[] = [];
  const ranked = rankByScore(averages);
  const weakest = ranked[3] as Dimension;

  const highD = countHigh(members, "D");
  const highS = countHigh(members, "S");
  if (highD >= 2 && highS >= 2) {
    zones.push({
      severity: "high",
      title: "Conflict-style mismatch",
      detail: `A block of high-Dominant members (${highD}) shares this team with a block of high-Stable members (${highS}). Conflict will be loud on one side and silent on the other — the silent side is where resentment compounds. Make space for asynchronous, written dissent.`,
    });
  }

  const weakestAvg = averages[DIMENSION_KEY[weakest]];
  if (composition[weakest] === 0 || weakestAvg <= 40) {
    zones.push({
      severity: composition[weakest] === 0 ? "high" : "watch",
      title: `Low ${dimensionMeta[weakest].label} coverage`,
      detail: gapCopy[weakest],
    });
  }

  const maxPrimaries = Math.max(...DIMENSIONS.map((dim) => composition[dim]));
  const dominantStyle = DIMENSIONS.find(
    (dim) => composition[dim] === maxPrimaries,
  ) as Dimension;
  if (maxPrimaries >= Math.ceil(members.length / 2) && members.length >= 4) {
    zones.push({
      severity: "watch",
      title: `${dimensionMeta[dominantStyle].label} homogeneity`,
      detail: `${maxPrimaries} of ${members.length} members share ${dimensionMeta[dominantStyle].label} as their primary style. Expect fast internal agreement — and shared blind spots. Decisions that survived this room may not survive contact with people wired differently.`,
    });
  }

  if (zones.length === 0) {
    zones.push({
      severity: "watch",
      title: `Thinnest coverage: ${dimensionMeta[weakest].label}`,
      detail: `No acute risks detected — the nearest watch item is ${dimensionMeta[weakest].label} (team average ${weakestAvg}). Assign that perspective an explicit owner on major decisions.`,
    });
  }
  return zones;
}

function buildActions(
  composition: Record<Dimension, number>,
  averages: DiscScores,
  members: TeamMember[],
): TeamAction[] {
  const actions: TeamAction[] = [];
  const ranked = rankByScore(averages);
  const lead = ranked[0] as Dimension;
  const weakest = ranked[3] as Dimension;

  const weakestChampion = [...members].sort(
    (a, b) =>
      b.normalized[DIMENSION_KEY[weakest]] - a.normalized[DIMENSION_KEY[weakest]],
  )[0];

  actions.push({
    audience: "team",
    action: `Give the ${dimensionMeta[weakest].label} perspective a named owner in every consequential decision${weakestChampion ? ` — ${weakestChampion.displayName} scores highest (${weakestChampion.normalized[DIMENSION_KEY[weakest]]}) and is the natural champion` : ""}.`,
  });

  const leadActions: Record<Dimension, string> = {
    D: "Adopt a decision protocol: every major call records who was consulted and what dissent said — speed stays, silent casualties don't.",
    I: "Convert enthusiasm to commitments: every energized meeting ends with written owners, dates, and a definition of done.",
    S: "Schedule deliberate change reps: one process or tool gets consciously revisited each quarter so stability doesn't harden into stagnation.",
    C: "Time-box analysis: consequential decisions get an explicit deadline and ship at 80% certainty with confidence levels attached.",
  };
  actions.push({ audience: "team", action: leadActions[lead] });

  actions.push({
    audience: "team",
    action:
      "Share profiles internally: each member presents their communication do's and don'ts in one team session — style becomes vocabulary instead of friction.",
  });

  actions.push({
    audience: "coach",
    action: `Coach the ${dimensionMeta[lead].label}-leaning majority on the cost of their default: run one retrospective focused on decisions where the minority style would have changed the outcome.`,
  });
  actions.push({
    audience: "coach",
    action:
      "Pair complementary opposites on one real deliverable per quarter — pace-setters with finishers, evangelists with verifiers — and debrief what each surprised the other with.",
  });

  return actions;
}

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

  const departments = [...new Set(members.map((m) => m.department))].sort();

  return {
    team,
    members,
    departments,
    composition,
    averages,
    cultureSummary: buildCultureSummary(averages, composition, members.length),
    insights: buildInsights(composition, averages, members.length),
    communicationGaps: buildCommunicationGaps(members),
    riskZones: buildRiskZones(members, composition, averages),
    actions: buildActions(composition, averages, members),
  };
}
