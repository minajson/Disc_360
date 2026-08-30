import type { DimensionKey } from "./disc360-wellbeing-items.ts";
import type { IndexMovement } from "../lib/scoring/disc360-wellbeing.ts";

/**
 * DISC360 Wellbeing Pulse V1 — every word the product says about a result.
 *
 * Screened by data/wellbeing-content.test.ts against lib/wellbeing/language.ts,
 * exactly like the GHQ copy, so diagnostic, alarming, selection-flavoured or
 * causal phrasing fails the build rather than reaching a participant.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE CONSTRAINT THAT SHAPES ALL OF THIS COPY.
 *
 * V1 has no threshold and no severity bands, because it has not been
 * psychometrically validated. So the copy may report a number, name which
 * dimensions are currently higher and lower FOR THIS PERSON, and describe
 * movement against their own previous pulse — and nothing else. It may not
 * grade, categorise, benchmark or interpret.
 * ─────────────────────────────────────────────────────────────────────
 */

export const DISC_WELLBEING_PRODUCT_NAME = "Wellbeing Pulse";
export const DISC_WELLBEING_DESCRIPTOR = "Workplace wellbeing reflection";

/** Shown wherever an index can be seen. */
export const DISC_WELLBEING_DISCLAIMER =
  "The Wellbeing Pulse is a reflection tool. It is not a medical or clinical measure, " +
  "it is not a diagnosis, and it does not assess anyone's fitness for their role.";

export const DISC_WELLBEING_DISCLAIMER_LONG =
  "The Wellbeing Pulse is a reflection tool that describes how your working life has felt " +
  "over the past two weeks. It is not a medical or clinical measure, it is not a diagnosis, " +
  "and it does not assess anyone's fitness for their role. It has not been psychometrically " +
  "validated, so there is no pass mark and no band to fall into — the number is a starting " +
  "point for your own reflection. Your individual answers and your index are private to you.";

/* ── consent and context ────────────────────────────────────────────── */

export const DISC_CONSENT_HEADING = "Taking part is your choice";
export const DISC_CONSENT_BODY: readonly string[] = [
  "The Wellbeing Pulse asks twelve short questions about how the past two weeks have been for you at work. It takes about three minutes.",
  "Your individual answers and your index are private to you. Your manager, your team facilitator and platform administrators cannot see them — not your index, and not any single answer.",
  "Results are only ever reported to your organisation as group figures, and only when a group is large enough that no one in it can be identified.",
  "You can stop at any point, and you do not have to take part at all.",
];

/* ── the result ─────────────────────────────────────────────────────── */

export const DISC_RESULT_HEADING = "Your Wellbeing Pulse";
export const DISC_INDEX_LABEL = "Wellbeing Index";

export const DISC_INDEX_MEANING =
  "Your Wellbeing Index summarises your twelve answers on a 0–100 scale. A higher number " +
  "means you reported more of these experiences more of the time over the past two weeks. " +
  "There is no target and no pass mark — the number is most useful compared with your own " +
  "previous pulses, not with anybody else's.";

export const DISC_NO_BANDS_NOTE =
  "This pulse does not place you in a category. It has not been psychometrically validated, " +
  "so any band would be a product design choice rather than a finding, and we would rather " +
  "show you the number and let you make sense of it.";

/* ── dimensions ─────────────────────────────────────────────────────── */

export const DISC_DIMENSION_HEADING = "Your six dimensions";
export const DISC_DIMENSION_LEAD =
  "Each dimension summarises two of your answers on the same 0–100 scale. They describe " +
  "where your experience has felt steadier and where it has felt harder over the past two weeks.";

/** Neutral framing for the currently higher and lower dimensions. */
export const DISC_STRONGEST_HEADING = "Currently higher for you";
export const DISC_LOWEST_HEADING = "Currently lower for you";

export const DISC_PATTERN_NOTE =
  "Higher and lower here are relative to your own other answers on this pulse, not to any " +
  "standard and not to other people. A lower dimension is a place to pay attention, not a problem to fix.";

export function strongestLine(labels: string[]): string {
  if (labels.length === 0) return "";
  const list = labels.join(" and ");
  return `Over the past two weeks, ${list} came through as your steadier ${
    labels.length === 1 ? "area" : "areas"
  }.`;
}

export function lowestLine(labels: string[]): string {
  if (labels.length === 0) return "";
  const list = labels.join(" and ");
  return `${list} scored lower than your other ${
    labels.length === 1 ? "dimension" : "dimensions"
  } this time — worth noticing, and worth watching across your next few pulses.`;
}

/* ── movement ───────────────────────────────────────────────────────── */

export const DISC_MOVEMENT_LABEL: Record<IndexMovement, string> = {
  higher: "Higher than your previous pulse",
  lower: "Lower than your previous pulse",
  similar: "Similar to your previous pulse",
};

export function indexMovementDetail(movement: IndexMovement, delta: number): string {
  const points = Math.abs(delta) === 1 ? "1 point" : `${Math.abs(delta)} points`;
  if (movement === "similar") return "Your index is the same as it was last time.";
  return movement === "higher"
    ? `Your index is ${points} higher than your previous pulse.`
    : `Your index is ${points} lower than your previous pulse.`;
}

export function sinceFirstDetail(delta: number): string {
  if (delta === 0) return "Your index is the same as your first recorded pulse.";
  const points = Math.abs(delta) === 1 ? "1 point" : `${Math.abs(delta)} points`;
  return delta > 0
    ? `Your index is ${points} higher than your first recorded pulse.`
    : `Your index is ${points} lower than your first recorded pulse.`;
}

export const DISC_MOVEMENT_CAVEAT =
  "Indexes move around for all sorts of everyday reasons — a busy fortnight, a good week, " +
  "a change at home. A movement between two pulses describes those two fortnights, and " +
  "nothing more.";

/* ── history ────────────────────────────────────────────────────────── */

export const DISC_HISTORY_HEADING = "My Wellbeing History";
export const DISC_HISTORY_EMPTY =
  "Your completed Wellbeing Pulses will appear here, so you can see how things have moved over time.";
export const DISC_HISTORY_SINGLE =
  "This is your first Wellbeing Pulse. When you complete another one, you will be able to see how the two compare.";
export const DISC_DIMENSION_HISTORY_HEADING = "By dimension";
export const DISC_DIMENSION_HISTORY_LEAD =
  "Choose a dimension to see how it has moved across your pulses.";

/* ── management analytics ───────────────────────────────────────────── */

export const DISC_AGGREGATE_HEADING = "Wellbeing Index";
export const DISC_LOWEST_DIMENSION_LABEL = "Current lower-scoring dimension";
export const DISC_HIGHEST_DIMENSION_LABEL = "Current higher-scoring dimension";

export const DISC_ANALYTICS_NOTE =
  "The Wellbeing Index is a reflection measure, not a validated scale. Group figures describe " +
  "what people reported over a two-week window; they do not measure the health of a workforce " +
  "and they carry no pass mark.";

export const DISC_LOWER_DIMENSION_NOTE =
  "A lower-scoring dimension is an area for attention, not a finding about anyone. It says " +
  "where a group reported less of an experience during this pulse, and nothing about why.";

export const DISC_NO_BANDS_ANALYTICS_NOTE =
  "No bands, cut-offs or categories are applied to this instrument. Any that are introduced " +
  "later would be product descriptive bands, not clinical thresholds, and would need to be " +
  "governed as such.";

/** Dimension keys in the order every surface displays them. */
export const DISC_DIMENSION_ORDER: readonly DimensionKey[] = [
  "capacity",
  "recovery_demand",
  "emotional_resilience",
  "connection_safety",
  "purpose_confidence",
  "everyday_wellbeing",
];
