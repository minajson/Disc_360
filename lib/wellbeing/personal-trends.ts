import {
  INSTRUMENTS,
  type InstrumentKey,
  type ScoreDirection,
} from "../../data/wellbeing-instruments.ts";

/**
 * A participant's OWN longitudinal reading.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ENTIRELY SEPARATE FROM ORGANISATIONAL ANALYTICS.
 *
 * This module takes one person's own results and nothing else. There is no
 * parameter for a cohort, a department, an organisation or another person; no
 * function here can be handed one. A participant's history is theirs, and the
 * strongest way to guarantee that is for the comparison never to exist in the
 * code rather than to be filtered out of it.
 *
 * THE RULE THAT SHAPES EVERYTHING BELOW: NO UNIVERSAL SCORE.
 *
 * GHQ-12 counts to 12 and upward means MORE reported difficulty. GHQ-28 counts
 * to 28 the same way. WHO-5 is a percentage and upward means BETTER wellbeing.
 * Wellbeing Pulse V1 is a 0–100 index with no threshold at all. Averaging them,
 * normalising them onto a shared 0–100, or drawing them on one axis would
 * invent a number that does not exist and would read as improvement exactly
 * when the opposite happened.
 *
 * So a trend is built for ONE questionnaire, carries that questionnaire's own
 * scale, direction and vocabulary, and `sharesAxis()` refuses to let two of
 * them meet.
 *
 * NO CLINICAL SIGNIFICANCE IS INVENTED.
 *
 * There is no validated minimum important difference for these instruments at
 * the individual level. So movement is reported as arithmetic — "3 points
 * higher than your previous check-in" — and never as improvement,
 * deterioration, recovery or risk. `describeMovement` is where that discipline
 * lives, and its test asserts the vocabulary.
 * ─────────────────────────────────────────────────────────────────────
 */

/** The shape this module needs. A subset of `WellbeingHistoryRecord`. */
export interface PersonalRecord {
  id: string;
  instrumentKey: InstrumentKey;
  completedAt: string;
  totalScore: number;
  indexScore: number | null;
  threshold: number | null;
  atOrAboveThreshold: boolean | null;
  dimensions: { key: string; raw: number; index: number }[];
}

export interface TrendPoint {
  id: string;
  at: string;
  /** The figure this questionnaire reports as its headline. */
  value: number;
  /** The raw count behind a transformed figure, where the two differ. */
  raw: number | null;
  threshold: number | null;
}

export interface SubscaleSeries {
  key: string;
  label: string;
  description: string;
  max: number;
  points: { at: string; value: number }[];
}

export interface PersonalTrend {
  instrumentKey: InstrumentKey;
  questionnaireName: string;
  /** "GHQ-12 screening score", "WHO-5 Well-Being Score", … */
  metricName: string;
  min: number;
  max: number;
  direction: ScoreDirection;
  /** The one sentence that stops a reader misreading the axis. */
  directionSentence: string;
  points: TrendPoint[];
  current: TrendPoint | null;
  /** Descriptive movement against the immediately preceding check-in. */
  movement: Movement | null;
  /** Where a questionnaire carries one, and what it is and is not. */
  thresholdNote: string | null;
  /** True when the threshold was not the same across every point plotted. */
  thresholdChanged: boolean;
  subscales: SubscaleSeries[];
}

export interface Movement {
  delta: number;
  /** Direction of the NUMBER. Never a judgement about the person. */
  direction: "up" | "down" | "level";
  sentence: string;
}

/* ── the axis ───────────────────────────────────────────────────────── */

/**
 * The sentence that tells a reader which way is which.
 *
 * Required on every chart in this product, because the same visual — a line
 * going up — means opposite things on WHO-5 and on GHQ, and no amount of
 * colour makes that legible on its own.
 */
export function directionSentence(instrumentKey: InstrumentKey): string {
  const instrument = INSTRUMENTS[instrumentKey];
  switch (instrument.scoreDirection) {
    case "higher_is_more_distress":
      return "A higher score means you reported more areas being harder than usual. It is not a severity rating.";
    case "higher_is_stronger_wellbeing":
      return "A higher score means you reported better wellbeing over the period asked about.";
  }
}

/**
 * Whether two questionnaires' figures may be drawn on one axis.
 *
 * Only ever true for the same questionnaire. Sharing a RANGE is not sharing a
 * SCALE: WHO-5 and Wellbeing Pulse V1 are both 0–100 and both count upward,
 * which is exactly what makes them dangerous to each other — a chart written
 * to accept "a 0–100 series" will plot one on the other's axis and nothing
 * about the numbers will look wrong.
 */
export function sharesAxis(a: InstrumentKey, b: InstrumentKey): boolean {
  return a === b;
}

/* ── the reading ────────────────────────────────────────────────────── */

/**
 * The headline figure for one record, chosen by the questionnaire.
 *
 * GHQ reports its count. WHO-5 reports the published percentage, with the raw
 * 0–25 kept beside it. Wellbeing Pulse V1 reports its index.
 */
export function headlineOf(record: PersonalRecord): { value: number; raw: number | null } {
  const instrument = INSTRUMENTS[record.instrumentKey];
  if (instrument.reportedOn === "index") {
    return { value: record.indexScore ?? 0, raw: record.totalScore };
  }
  return { value: record.totalScore, raw: null };
}

/**
 * Movement between two consecutive check-ins of the SAME questionnaire.
 *
 * Deliberately blunt about what it is. "Up" and "down" describe the number.
 * Whether that is welcome depends on the questionnaire and on a life this
 * product knows nothing about, so neither is named.
 */
export function describeMovement(
  instrumentKey: InstrumentKey,
  current: number,
  previous: number,
): Movement {
  const delta = current - previous;
  const points = Math.abs(delta) === 1 ? "1 point" : `${Math.abs(delta)} points`;
  const metric = INSTRUMENTS[instrumentKey].metricName;

  if (delta === 0) {
    return {
      delta: 0,
      direction: "level",
      sentence: `Your ${metric} is the same as your previous check-in.`,
    };
  }
  return {
    delta,
    direction: delta > 0 ? "up" : "down",
    sentence: `Your ${metric} is ${points} ${delta > 0 ? "higher" : "lower"} than your previous check-in.`,
  };
}

/**
 * What a questionnaire's threshold is, said carefully or not at all.
 *
 * Null where there is none — Wellbeing Pulse V1 is not validated and does not
 * grade anybody, and inventing a band for it here would be the product making
 * a judgement it has explicitly declined to make.
 */
export function thresholdNote(
  instrumentKey: InstrumentKey,
  threshold: number | null,
): string | null {
  if (threshold === null) return null;
  const instrument = INSTRUMENTS[instrumentKey];

  if (instrument.scoreDirection === "higher_is_stronger_wellbeing") {
    return (
      `${threshold} is the cut-off published with this questionnaire. A score below it has been ` +
      "suggested as a prompt for a further conversation. It is the questionnaire's own " +
      "documentation, not a finding about you."
    );
  }
  return (
    `${threshold} is the level your organisation currently uses as a prompt to check in. ` +
    "It is a screening threshold, not a diagnosis, and it can be set differently by different " +
    "organisations."
  );
}

/* ── subscales ──────────────────────────────────────────────────────── */

/** Stored as `ghq28_somatic`; published as `somatic`. */
const SUBSCALE_PREFIX = "ghq28_";

/**
 * A subscale series per published subscale, oldest first.
 *
 * Only for a questionnaire that actually defines subscales. Every label,
 * description and count comes from the registry, and none of them carries a
 * threshold — a subscale is a profile dimension, and this product has no
 * authority to turn one into a finding.
 */
export function subscaleSeries(
  instrumentKey: InstrumentKey,
  records: PersonalRecord[],
): SubscaleSeries[] {
  const instrument = INSTRUMENTS[instrumentKey];
  if (instrument.subscales.length === 0) return [];

  return instrument.subscales.map((subscale) => ({
    key: subscale.key,
    label: subscale.label,
    description: subscale.description,
    max: subscale.itemCount,
    points: records
      .map((record) => {
        const found = record.dimensions.find(
          (dimension) =>
            dimension.key === subscale.key ||
            dimension.key === `${SUBSCALE_PREFIX}${subscale.key}`,
        );
        return found ? { at: record.completedAt, value: found.raw } : null;
      })
      .filter((point): point is { at: string; value: number } => point !== null),
  }));
}

/* ── the whole reading, assembled ───────────────────────────────────── */

/**
 * Records must all be the same questionnaire; anything else is dropped rather
 * than plotted. A mixed series is the one failure mode this module exists to
 * make impossible, so it is refused at the door as well as in `sharesAxis`.
 */
export function buildPersonalTrend(
  instrumentKey: InstrumentKey,
  records: readonly PersonalRecord[],
): PersonalTrend {
  const instrument = INSTRUMENTS[instrumentKey];
  const mine = records
    .filter((record) => record.instrumentKey === instrumentKey)
    .slice()
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));

  const points: TrendPoint[] = mine.map((record) => {
    const headline = headlineOf(record);
    return {
      id: record.id,
      at: record.completedAt,
      value: headline.value,
      raw: headline.raw,
      threshold: record.threshold,
    };
  });

  const current = points.at(-1) ?? null;
  const previous = points.at(-2) ?? null;

  const thresholds = new Set(
    points.map((point) => point.threshold).filter((value): value is number => value !== null),
  );

  return {
    instrumentKey,
    questionnaireName: instrument.name,
    metricName: instrument.metricName,
    min: instrument.primaryScoreMin,
    max: instrument.primaryScoreMax,
    direction: instrument.scoreDirection,
    directionSentence: directionSentence(instrumentKey),
    points,
    current,
    movement:
      current && previous
        ? describeMovement(instrumentKey, current.value, previous.value)
        : null,
    thresholdNote: current ? thresholdNote(instrumentKey, current.threshold) : null,
    thresholdChanged: thresholds.size > 1,
    subscales: subscaleSeries(instrumentKey, mine),
  };
}
