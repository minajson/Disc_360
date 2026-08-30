import {
  INSTRUMENTS,
  type InstrumentKey,
} from "../../data/wellbeing-instruments.ts";

/**
 * What a figure MEANS on its own questionnaire — the one place that decides.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE BUG THIS EXISTS TO MAKE IMPOSSIBLE.
 *
 * `at_or_above_threshold` is stored for every instrument that has a threshold,
 * and it means opposite things depending on which one:
 *
 *   · GHQ-12 / GHQ-28 count UPWARD toward reported difficulty, so at-or-above
 *     the threshold is the side worth noticing.
 *   · WHO-5 counts UPWARD toward wellbeing, so at-or-above its cut-off is the
 *     UNREMARKABLE side, and BELOW it is the side worth noticing.
 *
 * A participant's own history was colouring that flag warm and labelling it
 * "At or above the screening threshold" for every questionnaire — so somebody
 * whose WHO-5 wellbeing score was healthy saw it drawn as the noteworthy one.
 * Any surface that reads the raw flag is one refactor away from repeating it,
 * so no surface reads the raw flag any more: they ask this module.
 *
 * WHAT IT DOES NOT DO: INVENT A BAND.
 *
 * There is no state here that a published threshold does not justify. An
 * instrument with no threshold — Wellbeing Pulse V1, which is not validated —
 * gets `unbanded`, not a guess. No state means "good", "bad", "healthy" or
 * "at risk"; `watch` means "this is the side of the instrument's own
 * documented line that the instrument says is worth a conversation", and that
 * is the strongest claim available.
 *
 * COLOUR IS NEVER THE ONLY SIGNAL.
 *
 * Each state carries a token, a short label and a glyph. A renderer that uses
 * the colour without the label is failing this module's contract, and the
 * components in `components/wellbeing/analytics` are written to always print
 * one of the two textual carriers beside it.
 * ─────────────────────────────────────────────────────────────────────
 */

export type ReadingState =
  /** On the side of its own documented threshold that invites a look. */
  | "watch"
  /** On the other side of that threshold. */
  | "steady"
  /** The questionnaire publishes no threshold, so no side exists. */
  | "unbanded"
  /** Withheld to protect confidentiality — a group too small to report. */
  | "withheld"
  /** Not enough responses yet for a figure to exist at all. */
  | "insufficient";

export interface StateVisual {
  /** A CSS custom property name from app/globals.css. Never a literal colour. */
  color: string;
  background: string;
  /** ALWAYS rendered beside the colour. */
  label: string;
  /** A second non-colour carrier, for charts too small for a label. */
  glyph: "dot" | "ring" | "hatch" | "dash";
}

export const STATE_VISUAL: Record<ReadingState, StateVisual> = {
  steady: {
    color: "var(--color-pulse-steady)",
    background: "var(--color-pulse-steady-soft)",
    label: "Within the usual range",
    glyph: "dot",
  },
  watch: {
    color: "var(--color-pulse-watch)",
    background: "var(--color-pulse-watch-soft)",
    label: "Worth a look",
    glyph: "ring",
  },
  unbanded: {
    color: "var(--color-pulse-teal)",
    background: "var(--color-pulse-mist)",
    label: "No threshold",
    glyph: "dot",
  },
  withheld: {
    color: "var(--color-pulse-withheld)",
    background: "var(--color-pulse-withheld-soft)",
    label: "Withheld to protect confidentiality",
    glyph: "hatch",
  },
  insufficient: {
    color: "var(--color-pulse-withheld)",
    background: "var(--color-pulse-withheld-soft)",
    label: "Not enough responses yet",
    glyph: "dash",
  },
};

/**
 * The state of one figure on one questionnaire.
 *
 * `threshold` is the threshold that applied WHEN THE FIGURE WAS RECORDED, not
 * today's. A historical result read against a threshold that has since changed
 * would be reclassified by a policy decision taken after the fact.
 */
export function readingState(
  instrumentKey: InstrumentKey,
  value: number | null,
  threshold: number | null,
): ReadingState {
  if (value === null) return "insufficient";
  const instrument = INSTRUMENTS[instrumentKey];
  if (!instrument.hasThreshold || threshold === null) return "unbanded";

  return instrument.scoreDirection === "higher_is_more_distress"
    ? value >= threshold
      ? "watch"
      : "steady"
    : value < threshold
      ? "watch"
      : "steady";
}

/**
 * How a figure sits against its threshold, in that questionnaire's own words.
 *
 * GHQ's threshold is a level a score reaches; WHO-5's cut-off is a level a
 * score falls below. Saying "at or above the screening threshold" on a WHO-5
 * result is not merely awkward — it borrows GHQ's frame, in which above is the
 * side that prompts a conversation, and states the opposite of what happened.
 */
export function thresholdPhrase(
  instrumentKey: InstrumentKey,
  value: number | null,
  threshold: number | null,
): string | null {
  const state = readingState(instrumentKey, value, threshold);
  if (state === "unbanded" || state === "insufficient" || threshold === null) return null;

  const instrument = INSTRUMENTS[instrumentKey];
  if (instrument.scoreDirection === "higher_is_more_distress") {
    return state === "watch"
      ? "At or above the screening threshold"
      : "Below the screening threshold";
  }
  return state === "watch"
    ? "Below the published cut-off"
    : "At or above the published cut-off";
}

/* ── movement ───────────────────────────────────────────────────────── */

/**
 * Which way a figure moved, and which way that is ON THIS QUESTIONNAIRE.
 *
 * `direction` is the arithmetic — the number went up or down. `toward` says
 * whether that arithmetic moved toward or away from the side the questionnaire
 * itself flags, which is the only thing that can be said without a validated
 * minimum important difference. Neither is an improvement or a deterioration,
 * and `describeMovement` in personal-trends.ts declines to use those words.
 */
export interface MovementReading {
  delta: number;
  direction: "up" | "down" | "level";
  toward: "watch" | "steady" | "level";
  /** "+6 since the previous wave" — descriptive, never a clinical claim. */
  label: string;
}

export function movementReading(
  instrumentKey: InstrumentKey,
  current: number,
  previous: number,
  periodLabel = "the previous wave",
): MovementReading {
  const delta = Math.round((current - previous) * 10) / 10;
  const instrument = INSTRUMENTS[instrumentKey];

  const direction = delta === 0 ? "level" : delta > 0 ? "up" : "down";
  const worseningIsUp = instrument.scoreDirection === "higher_is_more_distress";
  const toward =
    delta === 0
      ? "level"
      : (delta > 0) === worseningIsUp
        ? "watch"
        : "steady";

  return {
    delta,
    direction,
    toward,
    label:
      delta === 0
        ? `No change since ${periodLabel}`
        : `${delta > 0 ? "+" : ""}${delta} since ${periodLabel}`,
  };
}

/**
 * The arrow. Its meaning is always printed beside it.
 *
 * Deliberately NOT coloured by `toward`: a green down-arrow on GHQ and a green
 * up-arrow on WHO-5 are the same claim rendered two ways, and both of them are
 * this product deciding that a change in somebody's score was good news. The
 * arrow shows the number's direction; the sentence beside it carries what the
 * questionnaire's direction means.
 */
export const MOVEMENT_GLYPH: Record<MovementReading["direction"], string> = {
  up: "↑",
  down: "↓",
  level: "→",
};

/**
 * The plain reading of a movement, for an ORGANISATIONAL figure.
 *
 * "Improving" and "needs attention" are the words a dashboard reaches for, and
 * both assert a cause this data cannot support: a wave is answered by a
 * different set of people from the last one, so a shift describes the
 * responses received, not the same individuals moving. The wording says that.
 */
export function aggregateMovementSentence(
  instrumentKey: InstrumentKey,
  reading: MovementReading,
  what: string,
  periodLabel = "the previous comparable wave",
): string {
  if (reading.direction === "level") {
    return `Median ${what} is unchanged from ${periodLabel}.`;
  }
  const points = Math.abs(reading.delta) === 1 ? "1 point" : `${Math.abs(reading.delta)} points`;
  const flagged = INSTRUMENTS[instrumentKey].hasThreshold
    ? reading.toward === "watch"
      ? " — toward the side this questionnaire flags"
      : " — away from the side this questionnaire flags"
    : "";
  return `Median ${what} moved ${points} ${reading.direction === "up" ? "higher" : "lower"} than ${periodLabel}${flagged}.`;
}
