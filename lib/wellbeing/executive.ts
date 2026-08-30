import {
  INSTRUMENTS,
  type InstrumentKey,
} from "../../data/wellbeing-instruments.ts";
import {
  movementReading,
  readingState,
  type MovementReading,
  type ReadingState,
} from "./semantics.ts";

/**
 * The executive reading — what an Occupational Health lead needs in the first
 * ten seconds, and the sentences that follow it.
 *
 * ─────────────────────────────────────────────────────────────────────
 * EVERY SENTENCE HERE IS DERIVED, NOT WRITTEN BY A MODEL.
 *
 * The statements this module produces read like conclusions, which is exactly
 * why none of them may be generated. Each is a template filled from figures
 * that have already passed suppression, and each names the figures it stands
 * on. A model rewrites prose elsewhere in this platform (`lib/ai/`); it does
 * not come near this file, and the evidence layer's rule — the numbers and the
 * categories belong to the code — is what that rule is protecting.
 *
 * WHAT THE WORDING MAY AND MAY NOT CLAIM.
 *
 * May: "reported", "responses", "movement", "suggests", "worth looking at".
 * May NOT: any cause, any diagnosis, any statement about employees rather than
 * about responses, and any ranking of groups as better or worse. Screening
 * data is observational: a department whose median moved is a department whose
 * RESPONSES moved, answered by a partly different set of people from last
 * time. `executive.test.ts` screens every produced string.
 *
 * NOR MAY IT CLAIM SIGNIFICANCE.
 *
 * There is no validated minimum important difference for these instruments at
 * group level, so nothing here says a change is meaningful, clinically
 * relevant or beyond chance. It reports the arithmetic and says which
 * direction it points on THIS questionnaire — see `semantics.ts`.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface CoverageInput {
  key: string;
  label: string;
  published: number;
  withheld: number;
  covered: number;
}

export interface CohortMovementInput {
  dimensionLabel: string;
  cohorts: { label: string; delta: number | null }[];
}

/**
 * The dimension profile's extremes, where the questionnaire supports naming
 * them at all.
 *
 * Supplied as null for GHQ-28: its four sections are profile dimensions that
 * carry no threshold and name no condition, so "Severe depression is this
 * workforce's highest section" is a sentence the instrument does not support.
 * `getWellbeingDimensionProfile` decides that and returns nulls; this module
 * only renders the decision.
 */
export interface DimensionExtremesInput {
  highest: { label: string; median: number } | null;
  lowest: { label: string; median: number } | null;
  max: number;
}

export interface ExecutiveInput {
  instrumentKey: InstrumentKey;
  /** People on the roster. */
  invited: number;
  /** Distinct people who completed at least one check-in. */
  participants: number;
  /** Completed over invited, already computed. Null when unsound. */
  participation: number | null;
  /** The organisation-wide median, or null when it is suppressed. */
  median: number | null;
  /** The same figure for the previous comparable wave, where one exists. */
  previousMedian: number | null;
  threshold: number | null;
  coverage: CoverageInput[];
  cohortMovements: CohortMovementInput[];
  /** Null where the questionnaire's dimensions are not a ranking. */
  dimensionExtremes?: DimensionExtremesInput | null;
  /** How the previous point should be named, e.g. "Wave 2". */
  previousPeriodLabel: string;
}

export interface ExecutiveTile {
  key: string;
  label: string;
  value: string;
  note: string | null;
  /** Only where a questionnaire's own documented threshold justifies one. */
  state: ReadingState | null;
  /** For the movement tile: the arrow's direction. */
  movement: MovementReading | null;
}

/**
 * A secondary fact, shown beneath the headline tiles.
 *
 * Separate from `ExecutiveTile` because these are conditional: a campaign with
 * one wave has no largest movement, and a questionnaire without rankable
 * dimensions has no highest or lowest. A tile that reads "—" for structural
 * reasons is worse than no tile, because a reader cannot tell the difference
 * between "not applicable here" and "suppressed".
 */
export interface ExecutiveHighlight {
  key: string;
  label: string;
  value: string;
  detail: string;
  movement: MovementReading | null;
}

export type InsightKind = "movement" | "cohort" | "participation" | "privacy" | "coverage";

export interface Insight {
  kind: InsightKind;
  text: string;
  /** The figures this sentence stands on, for the reader who asks. */
  basis: string;
}

/* ── the headline ───────────────────────────────────────────────────── */

/**
 * Five tiles, in the order the questions get asked.
 *
 * Participation comes FIRST, before any figure it qualifies. A median drawn
 * from a fifth of a workforce describes that fifth, and a reader who meets the
 * median first has already formed an impression by the time they reach the
 * denominator.
 */
export function buildExecutiveTiles(input: ExecutiveInput): ExecutiveTile[] {
  const instrument = INSTRUMENTS[input.instrumentKey];

  const published = input.coverage.reduce((total, entry) => total + entry.published, 0);
  const withheld = input.coverage.reduce((total, entry) => total + entry.withheld, 0);

  const movement =
    input.median !== null && input.previousMedian !== null
      ? movementReading(
          input.instrumentKey,
          input.median,
          input.previousMedian,
          input.previousPeriodLabel,
        )
      : null;

  return [
    {
      key: "participation",
      label: "Participation",
      value:
        input.participation === null ? "—" : `${Math.round(input.participation)}%`,
      note:
        input.invited > 0
          ? `${input.participants} of ${input.invited} people`
          : `${input.participants} ${input.participants === 1 ? "person" : "people"}`,
      state: null,
      movement: null,
    },
    {
      key: "median",
      label: `Median ${instrument.primaryScoreLabel.toLowerCase()}`,
      value: input.median === null ? "—" : String(input.median),
      note:
        input.median === null
          ? "Too few responses to publish"
          // The label already names the metric; the note carries the scale,
          // which is the fact a reader actually needs beside the figure.
          : `Scale ${instrument.primaryScoreMin}–${instrument.primaryScoreMax}`,
      state: readingState(input.instrumentKey, input.median, input.threshold),
      movement: null,
    },
    {
      key: "movement",
      label: "Change",
      // The arrow carries the direction and the figure carries the size, so
      // the sign is not printed twice. "↓ -3.5" reads as a double negative.
      value: movement === null ? "—" : String(Math.abs(movement.delta)),
      note: movement === null ? "No comparable earlier wave" : `since ${input.previousPeriodLabel}`,
      state: null,
      movement,
    },
    {
      key: "reportable",
      label: "Reportable groups",
      value: String(published),
      note: published === 0 ? "No group is large enough to publish" : "Large enough to publish",
      state: null,
      movement: null,
    },
    {
      key: "withheld",
      label: "Privacy protected",
      value: String(withheld),
      note:
        withheld === 0
          ? "No group withheld"
          : `${withheld === 1 ? "group" : "groups"} too small to report without risking somebody being identified`,
      // The tile's note already says what "withheld" means, so the state's
      // own label would print the same sentence twice.
      state: null,
      movement: null,
    },
  ];
}

/**
 * The two facts that do not fit the headline row, when they exist.
 *
 * "Largest movement" names WHERE the biggest change is, never who is highest
 * or lowest — a wellbeing comparison ordered by score is a performance table,
 * and a department reads its position as a verdict on its manager. Movement is
 * a different question: it says where to look next, and it is the question an
 * Occupational Health lead actually opens the page with.
 */
export function buildExecutiveHighlights(input: ExecutiveInput): ExecutiveHighlight[] {
  const instrument = INSTRUMENTS[input.instrumentKey];
  const highlights: ExecutiveHighlight[] = [];

  for (const dimension of input.cohortMovements) {
    const moved = dimension.cohorts.filter(
      (cohort): cohort is { label: string; delta: number } => cohort.delta !== null,
    );
    if (moved.length < 2) continue;

    const largest = moved.reduce((furthest, cohort) =>
      Math.abs(cohort.delta) > Math.abs(furthest.delta) ? cohort : furthest,
    );
    const reading = movementReading(
      input.instrumentKey,
      largest.delta,
      0,
      input.previousPeriodLabel,
    );
    highlights.push({
      key: `movement:${dimension.dimensionLabel}`,
      label: `Largest movement · ${dimension.dimensionLabel}`,
      value: largest.label,
      detail:
        largest.delta === 0
          ? `No group's median moved from ${input.previousPeriodLabel}`
          : `${largest.delta > 0 ? "+" : ""}${largest.delta} points from ${input.previousPeriodLabel}`,
      movement: largest.delta === 0 ? null : reading,
    });
    break;
  }

  const extremes = input.dimensionExtremes;
  if (extremes?.highest && extremes.lowest) {
    // Only reached for a questionnaire whose dimensions share one scale and
    // are designed to be read as a shape — Wellbeing Pulse V1 today.
    highlights.push({
      key: "dimension:highest",
      label: "Highest dimension",
      value: extremes.highest.label,
      detail: `Median ${extremes.highest.median} of ${extremes.max}`,
      movement: null,
    });
    highlights.push({
      key: "dimension:lowest",
      label: "Lowest dimension",
      value: extremes.lowest.label,
      detail: `Median ${extremes.lowest.median} of ${extremes.max} — where this questionnaire suggests looking first`,
      movement: null,
    });
  }

  // A questionnaire with no threshold has no "share on the flagged side" to
  // report, and inventing one would be the band it deliberately does not have.
  if (instrument.hasThreshold && input.threshold !== null && input.median !== null) {
    highlights.push({
      key: "threshold",
      label: "Configured level",
      value: String(input.threshold),
      detail:
        instrument.scoreDirection === "higher_is_more_distress"
          ? "Responses at or above this are counted as the noteworthy side"
          : "Responses below this are counted as the noteworthy side",
      movement: null,
    });
  }

  return highlights;
}

/* ── the sentences ──────────────────────────────────────────────────── */

/**
 * What can safely be said, in the order it is worth saying.
 *
 * Each returns only when its own precondition holds. A dashboard that always
 * produces four bullet points will produce four bullet points about nothing,
 * and a reader learns to skip them.
 */
export function buildInsights(input: ExecutiveInput): Insight[] {
  const instrument = INSTRUMENTS[input.instrumentKey];
  const insights: Insight[] = [];

  /* 1 · is the picture trustworthy at all? */
  if (input.participation !== null && input.invited > 0) {
    const rounded = Math.round(input.participation);
    if (rounded < 50) {
      insights.push({
        kind: "participation",
        text:
          `Fewer than half the people invited have responded, so everything below describes ` +
          `those ${input.participants} responses rather than the whole group.`,
        basis: `${input.participants} of ${input.invited} invited`,
      });
    } else if (rounded >= 80) {
      insights.push({
        kind: "participation",
        text: `${rounded}% of those invited have responded, so the figures below cover most of this group.`,
        basis: `${input.participants} of ${input.invited} invited`,
      });
    }
  }

  /* 2 · what moved overall? */
  if (input.median !== null && input.previousMedian !== null) {
    const movement = movementReading(
      input.instrumentKey,
      input.median,
      input.previousMedian,
      input.previousPeriodLabel,
    );
    const metric = instrument.primaryScoreLabel.toLowerCase();
    if (movement.direction === "level") {
      insights.push({
        kind: "movement",
        text: `The overall median ${metric} is unchanged from ${input.previousPeriodLabel}.`,
        basis: `median ${input.median} in both periods`,
      });
    } else {
      const points = Math.abs(movement.delta) === 1 ? "1 point" : `${Math.abs(movement.delta)} points`;
      const side = instrument.hasThreshold
        ? movement.toward === "watch"
          ? ", toward the side this questionnaire flags"
          : ", away from the side this questionnaire flags"
        : "";
      insights.push({
        kind: "movement",
        text:
          `The overall median ${metric} moved ${points} ${movement.direction === "up" ? "higher" : "lower"} ` +
          `than ${input.previousPeriodLabel}${side}. Each wave is answered by a partly different ` +
          `set of people, so this describes the responses received rather than the same ` +
          `individuals moving.`,
        basis: `median ${input.previousMedian} → ${input.median}`,
      });
    }
  }

  /* 3 · where is the largest movement? */
  for (const dimension of input.cohortMovements) {
    const moved = dimension.cohorts.filter(
      (cohort): cohort is { label: string; delta: number } => cohort.delta !== null,
    );
    if (moved.length < 2) continue;

    const largest = moved.reduce((furthest, cohort) =>
      Math.abs(cohort.delta) > Math.abs(furthest.delta) ? cohort : furthest,
    );
    if (largest.delta === 0) {
      insights.push({
        kind: "cohort",
        text: `No ${dimension.dimensionLabel.toLowerCase()} group's median moved between these periods.`,
        basis: `${moved.length} reportable groups`,
      });
      continue;
    }

    // Movement, not a league table: this names where the biggest CHANGE is, and
    // deliberately never names the highest or lowest group. See the note in
    // this module's header, and §18 of the review this was written for.
    const toward = movementReading(input.instrumentKey, largest.delta, 0).toward;
    insights.push({
      kind: "cohort",
      text:
        `Among reportable ${dimension.dimensionLabel.toLowerCase()} groups, ${largest.label} shows ` +
        `the largest movement — ${largest.delta > 0 ? "+" : ""}${largest.delta} points` +
        `${instrument.hasThreshold ? `, ${toward === "watch" ? "toward" : "away from"} the side this questionnaire flags` : ""}. ` +
        `That is a difference worth looking at, not an explanation of one.`,
      basis: `${moved.length} reportable groups compared`,
    });
  }

  /* 3b · what did NOT move? */
  for (const dimension of input.cohortMovements) {
    const steady = dimension.cohorts
      .filter((cohort): cohort is { label: string; delta: number } => cohort.delta === 0)
      .map((cohort) => cohort.label);
    if (steady.length === 0) continue;

    // Named, and counted, and nothing more. "Broadly stable" is a judgement
    // about magnitude; "unchanged" is arithmetic.
    const named = steady.slice(0, 2).join(" and ");
    const rest = steady.length - Math.min(2, steady.length);
    insights.push({
      kind: "cohort",
      text:
        `${named}${rest > 0 ? ` and ${rest} other ${rest === 1 ? "group" : "groups"}` : ""} ` +
        `recorded the same median as ${input.previousPeriodLabel}.`,
      basis: `${steady.length} of ${dimension.cohorts.length} groups unchanged`,
    });
    break;
  }

  /* 4 · what is not on screen, and why? */
  const withheld = input.coverage.filter((entry) => entry.withheld > 0);
  if (withheld.length > 0) {
    const total = withheld.reduce((sum, entry) => sum + entry.withheld, 0);
    insights.push({
      kind: "privacy",
      text:
        `${total} ${total === 1 ? "group is" : "groups are"} not shown because ${total === 1 ? "it is" : "they are"} ` +
        `too small to report without risking somebody being identified. ${total === 1 ? "It is" : "They are"} ` +
        `not named, sized or counted anywhere on this page.`,
      basis: withheld
        .map((entry) => `${entry.label}: ${entry.withheld} withheld`)
        .join("; "),
    });
  }

  /* 5 · how much of the workforce do the published groups actually cover? */
  const best = input.coverage.reduce<CoverageInput | null>(
    (widest, entry) => (widest === null || entry.covered > widest.covered ? entry : widest),
    null,
  );
  if (best && input.participants > 0 && best.published > 0) {
    const share = Math.round((best.covered / input.participants) * 100);
    if (share < 70) {
      insights.push({
        kind: "coverage",
        text:
          `The ${best.label.toLowerCase()} comparison covers ${best.covered} of the ` +
          `${input.participants} people who responded. The rest are in groups too small to ` +
          `publish, so that comparison describes part of this workforce rather than all of it.`,
        basis: `${best.covered} of ${input.participants} responded`,
      });
    }
  }

  return insights;
}

/* ── explaining a statistic in words ────────────────────────────────── */

/**
 * "middle 58–70" was the label. It is a correct description of an
 * interquartile range and it is not something a facilitator can act on.
 *
 * The replacement is three labelled facts and an optional explanation, which
 * is what "How to read this" is for — the statistical detail stays available
 * and stops being the default.
 */
export function describeSpread(
  median: number,
  p25: number,
  p75: number,
  responses: number,
): { median: string; range: string; responses: string; explanation: string } {
  return {
    median: `Median: ${median}`,
    range: `Typical middle range: ${p25}–${p75}`,
    responses: `Responses: ${responses}`,
    explanation:
      `Half of the responses in this group were at or below ${median}. The middle half sat ` +
      `between ${p25} and ${p75} — a wider band means answers were more spread out, a narrower ` +
      `one that they were more alike. Individual answers are never shown.`,
  };
}
