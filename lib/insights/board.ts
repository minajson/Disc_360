import {
  DIMENSION_KEY,
  DIMENSIONS,
  type ArchetypeCode,
  type Dimension,
  type DiscScores,
} from "../types/index.ts";
import { dimensionMeta } from "../../data/dimension-meta.ts";

/**
 * Board-room metrics — the derived numbers behind the presentation-grade team
 * results page. Pure, deterministic and unit-tested, so a slide projected in
 * an executive review can never disagree with the report it came from.
 *
 * Scale discipline (CLAUDE.md): every score arriving here is `normalized`
 * intensity, 0–100 per dimension, midpoint 50, NOT summing to 100. The only
 * place a share-of-100 appears is `behaviourDistribution`, which converts
 * head-counts (not scores) into a displayed split using largest remainder.
 */

/** Score at or above which a dimension reads as a pronounced strength. */
export const HIGH_BAND = 60;

/** Average spread at or below which a team reads as evenly balanced. */
export const BALANCED_SPREAD = 12;

export interface BoardProfile {
  scores: DiscScores;
  primary: Dimension;
  archetypeCode: ArchetypeCode;
  department: string | null;
}

/* ── text ───────────────────────────────────────────────────────────── */

/**
 * The first `count` sentences of a paragraph, with exactly one terminating
 * period. Splitting on ". " and re-joining leaves the final sentence's own
 * period in place, so appending another produced headlines ending "..".
 */
export function leadSentences(text: string, count = 2): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const sentences = trimmed.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!sentences || sentences.length === 0) {
    return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
  }
  return sentences
    .slice(0, count)
    .join("")
    .trim();
}

/* ── shares ─────────────────────────────────────────────────────────── */

/**
 * Largest-remainder split of counts into percentages that total exactly 100.
 * Same method the individual report's distribution uses, so a team page and a
 * personal page never round differently.
 */
export function sharesOf100(counts: readonly number[]): number[] {
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return counts.map(() => 0);

  const exact = counts.map((value) => (value / total) * 100);
  const floors = exact.map((value) => Math.floor(value));
  let remainder = 100 - floors.reduce((sum, value) => sum + value, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  const out = [...floors];
  for (const entry of order) {
    if (remainder <= 0) break;
    out[entry.index] = out[entry.index]! + 1;
    remainder -= 1;
  }
  return out;
}

/* ── balance ────────────────────────────────────────────────────────── */

/**
 * 0–100 index of how evenly the four energies are represented in the team
 * averages. 100 means the four averages are identical; every point of spread
 * costs one point of balance.
 */
export function balanceIndex(averages: DiscScores): number {
  const values = DIMENSIONS.map((dim) => averages[DIMENSION_KEY[dim]]);
  const spread = Math.max(...values) - Math.min(...values);
  return Math.max(0, Math.min(100, 100 - spread));
}

export function balanceVerdict(averages: DiscScores): {
  index: number;
  label: string;
  detail: string;
} {
  const index = balanceIndex(averages);
  const spread = 100 - index;
  if (spread <= BALANCED_SPREAD) {
    return {
      index,
      label: "Evenly balanced",
      detail: `All four energies sit within ${spread} points of each other. This team can meet most situations with a native speaker — the risk is dilution, so make ownership of each mode explicit.`,
    };
  }
  const ranked = rankDimensions(averages);
  const lead = ranked[0]!;
  const weakest = ranked[3]!;
  if (spread <= 25) {
    return {
      index,
      label: "Leaning",
      detail: `${dimensionMeta[lead].label} leads by ${spread} points over ${dimensionMeta[weakest].label}. The tilt is real but recoverable — the minority voice still exists and needs airtime, not recruitment.`,
    };
  }
  return {
    index,
    label: "Concentrated",
    detail: `${spread} points separate ${dimensionMeta[lead].label} from ${dimensionMeta[weakest].label}. Expect fast agreement inside the majority style and structural blind spots where the minority would have objected.`,
  };
}

export function rankDimensions(scores: DiscScores): Dimension[] {
  return [...DIMENSIONS].sort(
    (a, b) => scores[DIMENSION_KEY[b]] - scores[DIMENSION_KEY[a]],
  );
}

/* ── distributions ──────────────────────────────────────────────────── */

export interface DistributionSlice {
  dimension: Dimension;
  count: number;
  /** Share of 100 — the four slices always total exactly 100. */
  share: number;
}

/** Head-count of primary styles, expressed as a displayed share of 100. */
export function behaviourDistribution(
  profiles: readonly BoardProfile[],
): DistributionSlice[] {
  const counts = DIMENSIONS.map(
    (dim) => profiles.filter((profile) => profile.primary === dim).length,
  );
  const shares = sharesOf100(counts);
  return DIMENSIONS.map((dimension, index) => ({
    dimension,
    count: counts[index]!,
    share: shares[index]!,
  }));
}

export interface StrengthBand {
  dimension: Dimension;
  /** Members scoring at or above the high band on this dimension. */
  count: number;
  /** Percentage of the completed cohort, rounded. */
  percentage: number;
}

/**
 * Strength distribution — how many people can actually operate in each mode,
 * regardless of which one leads them. A team can have one Analytical primary
 * and still hold six people who run Analytical high.
 */
export function strengthDistribution(
  profiles: readonly BoardProfile[],
): StrengthBand[] {
  const total = profiles.length;
  return DIMENSIONS.map((dimension) => {
    const count = profiles.filter(
      (profile) => profile.scores[DIMENSION_KEY[dimension]] >= HIGH_BAND,
    ).length;
    return {
      dimension,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });
}

/* ── communication ──────────────────────────────────────────────────── */

const COMMUNICATION_STYLE: Record<Dimension, string> = {
  D: "Direct and brief — headline first, detail on request",
  I: "Expressive and verbal — thinks out loud, persuades in the room",
  S: "Steady and considered — needs processing time before committing",
  C: "Precise and written — evidence before conclusions",
};

const COMMUNICATION_RISK: Record<Dimension, string> = {
  D: "Brevity reads as dismissal to everyone who needed the context",
  I: "Enthusiasm gets mistaken for commitment, and detail goes missing",
  S: "Agreement in the room is not agreement — objections arrive late or never",
  C: "Scrutiny lands as negativity, and speed suffers waiting for certainty",
};

export interface CommunicationTendency {
  dimension: Dimension;
  style: string;
  risk: string;
  count: number;
  share: number;
}

export function communicationTendencies(
  profiles: readonly BoardProfile[],
): CommunicationTendency[] {
  return behaviourDistribution(profiles)
    .map((slice) => ({
      dimension: slice.dimension,
      style: COMMUNICATION_STYLE[slice.dimension],
      risk: COMMUNICATION_RISK[slice.dimension],
      count: slice.count,
      share: slice.share,
    }))
    .sort((a, b) => b.count - a.count || DIMENSIONS.indexOf(a.dimension) - DIMENSIONS.indexOf(b.dimension));
}

/* ── decision style ─────────────────────────────────────────────────── */

export interface DecisionStyle {
  /** Mean of Dominant and Influence — the appetite to move. */
  actionBias: number;
  /** Mean of Stable and Analytical — the appetite to verify. */
  deliberation: number;
  /** Positive means action-led, negative means deliberation-led. */
  tilt: number;
  label: string;
  detail: string;
}

export function decisionStyle(averages: DiscScores): DecisionStyle {
  const actionBias = Math.round((averages.d + averages.i) / 2);
  const deliberation = Math.round((averages.s + averages.c) / 2);
  const tilt = actionBias - deliberation;

  if (tilt > 10) {
    return {
      actionBias,
      deliberation,
      tilt,
      label: "Action-led",
      detail:
        "Decisions move fast and stalls are rare. Verification needs a named owner and a standing slot, or speed will occasionally ship the wrong thing at full confidence.",
    };
  }
  if (tilt < -10) {
    return {
      actionBias,
      deliberation,
      tilt,
      label: "Deliberation-led",
      detail:
        "Decisions are careful and errors die young. Deadlock-breaking needs a named owner and a deadline, or the cost shows up as opportunities that closed while the analysis continued.",
    };
  }
  return {
    actionBias,
    deliberation,
    tilt,
    label: "In tension",
    detail:
      "Action and verification are close to matched. That is the productive setting — protect it by making sure neither side wins by volume.",
  };
}

/* ── collaboration ──────────────────────────────────────────────────── */

/**
 * One paragraph a chief executive can read without a DISC primer: what this
 * group is like to work inside, stated in behaviour rather than letters.
 */
export function collaborationSummary(
  profiles: readonly BoardProfile[],
  averages: DiscScores,
): string {
  if (profiles.length === 0) {
    return "The collaboration read appears once members complete their assessments.";
  }
  const ranked = rankDimensions(averages);
  const lead = ranked[0]!;
  const second = ranked[1]!;
  const weakest = ranked[3]!;
  const decision = decisionStyle(averages);
  const strengths = strengthDistribution(profiles);
  const deepest = [...strengths].sort((a, b) => b.count - a.count)[0]!;
  const balance = balanceVerdict(averages);

  return `This group runs on ${dimensionMeta[lead].label.toLowerCase()} energy with ${dimensionMeta[second].label.toLowerCase()} close behind, and ${decision.label.toLowerCase()} decision-making (${decision.actionBias} action to ${decision.deliberation} deliberation). ${deepest.percentage}% of completed profiles can operate in ${dimensionMeta[deepest.dimension].label.toLowerCase()} mode when it is called for, so the bench is deeper than the primary-style split suggests. ${balance.label === "Evenly balanced" ? "Style coverage is even" : `Coverage is ${balance.label.toLowerCase()}`}, and ${dimensionMeta[weakest].label.toLowerCase()} is the thinnest voice — the one that has to be invited rather than assumed.`;
}

/* ── generated facilitator insights ─────────────────────────────────── */

export interface BoardInsight {
  tone: "strength" | "risk" | "balance";
  title: string;
  detail: string;
}

export interface BoardInput {
  profiles: readonly BoardProfile[];
  averages: DiscScores;
  memberCount: number;
  completedCount: number;
}

/**
 * The facilitator's talking points, generated from the same numbers the
 * charts render. Ordered by what a room needs to hear first: what this team
 * is good at, what will bite it, and how complete the picture is.
 */
export function facilitatorInsights(input: BoardInput): BoardInsight[] {
  const { profiles, averages, memberCount, completedCount } = input;
  if (profiles.length === 0) return [];

  const ranked = rankDimensions(averages);
  const lead = ranked[0]!;
  const weakest = ranked[3]!;
  const balance = balanceVerdict(averages);
  const decision = decisionStyle(averages);
  const distribution = behaviourDistribution(profiles);
  const strengths = strengthDistribution(profiles);
  const insights: BoardInsight[] = [];

  insights.push({
    tone: "strength",
    title: `Center of gravity: ${dimensionMeta[lead].label}`,
    detail: `${dimensionMeta[lead].label} averages ${averages[DIMENSION_KEY[lead]]} across ${completedCount} completed profile${completedCount === 1 ? "" : "s"} — ${dimensionMeta[lead].essence.toLowerCase().replace(/\.$/, "")} is this team's default setting.`,
  });

  insights.push({
    tone: "balance",
    title: `Decision style: ${decision.label}`,
    detail: decision.detail,
  });

  const dominantSlice = [...distribution].sort((a, b) => b.count - a.count)[0]!;
  if (dominantSlice.share >= 50 && profiles.length >= 4) {
    insights.push({
      tone: "risk",
      title: `${dimensionMeta[dominantSlice.dimension].label} concentration`,
      detail: `${dominantSlice.share}% of completed profiles lead with ${dimensionMeta[dominantSlice.dimension].label}. Agreement will come fast — and the blind spots will be shared, which means nobody in the room is positioned to catch them.`,
    });
  }

  const thinnest = strengths.find((band) => band.dimension === weakest)!;
  insights.push({
    tone: "risk",
    title: `Thinnest coverage: ${dimensionMeta[weakest].label}`,
    detail:
      thinnest.count === 0
        ? `Nobody runs ${dimensionMeta[weakest].label} at strength. That perspective has to be imported deliberately — assign it, borrow it, or schedule it, because it will not arrive on its own.`
        : `Only ${thinnest.count} of ${profiles.length} completed profiles run ${dimensionMeta[weakest].label} at strength (${thinnest.percentage}%). Name who carries it before consequential decisions, or it gets outvoted by volume.`,
  });

  insights.push({
    tone: "balance",
    title: `${balance.label} style coverage`,
    detail: balance.detail,
  });

  const outstanding = memberCount - completedCount;
  if (outstanding > 0) {
    insights.push({
      tone: "risk",
      title: `${outstanding} profile${outstanding === 1 ? "" : "s"} outstanding`,
      detail: `This read covers ${completedCount} of ${memberCount} invited members (${Math.round((completedCount / Math.max(1, memberCount)) * 100)}%). Treat the conclusions as directional until the remaining profiles land — a single missing voice can move a thin dimension.`,
    });
  }

  return insights;
}

/* ── risk register ──────────────────────────────────────────────────── */

export interface BoardRisk {
  severity: "high" | "watch";
  title: string;
  detail: string;
}

/**
 * Structural risks a board should see, ordered high-attention first. This is
 * deliberately about team composition, never about individuals — no
 * diagnostic, medical or selection claim is made or implied.
 */
export function riskRegister(input: BoardInput): BoardRisk[] {
  const { profiles, averages, memberCount, completedCount } = input;
  if (profiles.length === 0) return [];

  const risks: BoardRisk[] = [];
  const strengths = strengthDistribution(profiles);
  const band = (dim: Dimension) =>
    strengths.find((entry) => entry.dimension === dim)!.count;

  if (band("D") >= 2 && band("S") >= 2) {
    risks.push({
      severity: "high",
      title: "Conflict-style mismatch",
      detail: `${band("D")} members run Dominant at strength alongside ${band("S")} running Stable. Conflict will be loud on one side and silent on the other, and the silent side is where resentment compounds. Create a written, asynchronous route for dissent.`,
    });
  }

  if (band("I") >= 2 && band("C") >= 2) {
    risks.push({
      severity: "watch",
      title: "Proof-standard mismatch",
      detail: `${band("I")} members run Influence at strength alongside ${band("C")} running Analytical. Enthusiasm reads as hand-waving in one direction and scrutiny reads as negativity in the other. Share evidence before the pitch, not during it.`,
    });
  }

  const ranked = rankDimensions(averages);
  const weakest = ranked[3]!;
  if (band(weakest) === 0) {
    risks.push({
      severity: "high",
      title: `No ${dimensionMeta[weakest].label} strength on the roster`,
      detail: `Not one completed profile runs ${dimensionMeta[weakest].label} at or above ${HIGH_BAND}. ${dimensionMeta[weakest].essence} That capability is absent, not quiet — plan around it rather than hoping for it.`,
    });
  }

  const completion = memberCount > 0 ? completedCount / memberCount : 0;
  if (completion < 0.7 && memberCount > 0) {
    risks.push({
      severity: "watch",
      title: "Incomplete coverage",
      detail: `Only ${Math.round(completion * 100)}% of invited members have completed. Composition conclusions drawn now can invert as the remaining profiles arrive.`,
    });
  }

  if (risks.length === 0) {
    risks.push({
      severity: "watch",
      title: `Thinnest coverage: ${dimensionMeta[weakest].label}`,
      detail: `No acute structural risks detected. The nearest watch item is ${dimensionMeta[weakest].label}, averaging ${averages[DIMENSION_KEY[weakest]]} — assign that perspective an explicit owner on major decisions.`,
    });
  }

  return risks.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1,
  );
}
