import {
  DIMENSION_KEY,
  DIMENSIONS,
  type Dimension,
  type DiscScores,
} from "../types/index.ts";
import { dimensionMeta } from "../../data/dimension-meta.ts";
import { rankDimensions } from "./board.ts";

/**
 * Presentation derivations for the Team Intelligence report.
 *
 * Nothing here computes a psychometric measure. Every number is read from
 * values `lib/insights/team.ts` and `lib/insights/board.ts` already produced —
 * this module only decides how a management report should *say* them, which
 * keeps that decision testable and out of the components.
 *
 * The one thing it adds is naming: a two-word label for a behavioural tension
 * whose full description already exists, so a page can carry a heading as well
 * as a paragraph.
 */

/** `"Dominant"` → `"D"`. Null for the non-dimension gap labels team.ts emits. */
export function dimensionFromLabel(label: string): Dimension | null {
  const match = DIMENSIONS.find(
    (dim) => dimensionMeta[dim].label.toLowerCase() === label.trim().toLowerCase(),
  );
  return match ?? null;
}

export interface CoverageReading {
  /** Highest team average — where the team's weight sits. */
  centreOfGravity: Dimension;
  /** Second highest — the supporting energy. */
  secondaryEnergy: Dimension;
  /** Lowest team average — where the team is thinnest. */
  thinnestCoverage: Dimension;
  /** Points between the highest and lowest average. Mirrors balanceIndex. */
  spread: number;
}

/**
 * Where the team is concentrated and where it is thin.
 *
 * Ordered by the same `rankDimensions` the board metrics use, so the report
 * and the executive brief can never disagree about which energy leads.
 */
export function coverageReading(averages: DiscScores): CoverageReading {
  const ranked = rankDimensions(averages);
  const values = DIMENSIONS.map((dim) => averages[DIMENSION_KEY[dim]]);
  return {
    centreOfGravity: ranked[0]!,
    secondaryEnergy: ranked[1]!,
    thinnestCoverage: ranked[3]!,
    spread: Math.max(...values) - Math.min(...values),
  };
}

/** Whole-percent participation. 0 when nobody was invited, never NaN. */
export function participationRate(completed: number, invited: number): number {
  if (invited <= 0) return 0;
  return Math.round((completed / invited) * 100);
}

/**
 * A short name for the tension between two behavioural styles.
 *
 * The full description of each friction already comes from team.ts; this is
 * the heading that sits above it. Symmetric, so the pair order the data
 * happens to emit cannot change the label.
 */
// Keyed on the pair sorted alphabetically, which is how `tensionLabel` looks
// them up — so C·I is "CI", not "IC". Getting that backwards silently drops
// the label for half the pairs.
const TENSION_LABELS: Record<string, string> = {
  CD: "Pace vs proof",
  CI: "Enthusiasm vs evidence",
  CS: "Consensus vs standard",
  DI: "Outcome vs energy",
  DS: "Speed vs processing",
  IS: "Momentum vs rhythm",
};

export function tensionLabel(a: Dimension, b: Dimension): string | null {
  if (a === b) return null;
  const key = [a, b].sort().join("");
  return TENSION_LABELS[key] ?? null;
}

export interface TensionPair {
  a: Dimension;
  b: Dimension;
  label: string;
}

/**
 * The behavioural tensions this team actually has, taken from the friction
 * relationships team.ts generated for it.
 *
 * Deliberately derived rather than assumed: a team with no high-Dominant
 * members produces no Dominant tension, so the report shows the relationships
 * that exist instead of always drawing the same two.
 */
export function tensionPairs(
  gaps: readonly { between: [string, string] }[],
): TensionPair[] {
  const pairs: TensionPair[] = [];
  for (const gap of gaps) {
    const a = dimensionFromLabel(gap.between[0]);
    const b = dimensionFromLabel(gap.between[1]);
    if (!a || !b) continue;
    const label = tensionLabel(a, b);
    if (!label) continue;
    pairs.push({ a, b, label });
  }
  return pairs;
}

/**
 * The actions this report may carry.
 *
 * Team-facing only, and deliberately so: this report is written for the team,
 * not about them, so the coach-facing advice team.ts also generates is left
 * to the facilitator surfaces that are meant to carry it.
 */
export function teamFacingActions<T extends { audience: "team" | "coach" }>(
  actions: readonly T[],
): T[] {
  return actions.filter((entry) => entry.audience === "team");
}

/**
 * The findings a reader can trace the actions back to — the report's own
 * verified readings, not a restatement of the advice.
 *
 * Zipping actions to findings one-for-one would be an invention: team.ts emits
 * them as independent lists with no linkage between them. Listing the findings
 * beside the actions keeps the connection visible and honest.
 */
export function reportFindings(
  narrative: readonly { title: string; detail: string }[],
  risks: readonly { title: string; detail: string }[],
): { title: string; detail: string }[] {
  return [...narrative, ...risks];
}
