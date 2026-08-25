import {
  DISC360_WELLBEING_DIMENSIONS,
  DISC360_WELLBEING_INSTRUMENT_KEY,
  DISC360_WELLBEING_ITEM_COUNT,
  DISC360_WELLBEING_ITEMS,
  DISC360_WELLBEING_MAX_ITEM_POINTS,
  DISC360_WELLBEING_OPTIONS,
  type DimensionKey,
} from "../../data/disc360-wellbeing-items.ts";

/**
 * DISC360 Wellbeing Pulse V1 scoring — pure, deterministic, versioned.
 *
 * `computeDiscWellbeingResult` is the only entry point. No I/O, no clock, no
 * randomness.
 *
 * ─────────────────────────────────────────────────────────────────────
 * INDEPENDENCE — this engine shares nothing with GHQ-12, DISC or Focus.
 *
 * It imports only its own item bank. `lib/scoring/wellbeing.ts` (GHQ) does not
 * import this file and this file does not import it — asserted in
 * lib/wellbeing/isolation.test.ts. The two instruments also run in opposite
 * directions (a higher GHQ score means more reported distress; a higher
 * Wellbeing Index means stronger reported wellbeing), so there is no
 * arithmetic that could combine them and mean anything.
 * ─────────────────────────────────────────────────────────────────────
 *
 * NOT DIAGNOSTIC, AND NOT VALIDATED. V1 carries no threshold and no severity
 * bands, deliberately: the instrument has not been psychometrically validated,
 * so it reports a number and its movement and declines to grade anyone.
 */

export class DiscWellbeingScoringError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "DiscWellbeingScoringError";
  }
}

export const DISC_WELLBEING_INSTRUMENT_KEY = DISC360_WELLBEING_INSTRUMENT_KEY;
export const DISC_WELLBEING_SCORING_METHOD = "disc360_wellbeing_sum_0_48";

/**
 * Bumped ONLY when the scoring contract changes, and never retroactively.
 * Stored rows keep the version they were computed under; nothing re-scores.
 * Frozen by lib/scoring/disc360-wellbeing.test.ts.
 */
export const DISC_WELLBEING_SCORING_VERSION = "1.0.0";
export const DISC_WELLBEING_QUESTIONNAIRE_VERSION = 1;

export const DISC_WELLBEING_RESPONSE_POSITIONS = DISC360_WELLBEING_OPTIONS.length;
export const DISC_WELLBEING_MAX_RAW = DISC360_WELLBEING_ITEM_COUNT * DISC360_WELLBEING_MAX_ITEM_POINTS;
export const DISC_WELLBEING_MIN_RAW = 0;
export const DISC_WELLBEING_INDEX_MIN = 0;
export const DISC_WELLBEING_INDEX_MAX = 100;

/** Two items per dimension → 0–8 raw. */
export const DIMENSION_MAX_RAW = 2 * DISC360_WELLBEING_MAX_ITEM_POINTS;

/**
 * The one rounding rule, used everywhere.
 *
 * Half-up on the normalised percentage, to a whole number. Declared once and
 * exported so the index, the dimension scores, the report and the analytics
 * cannot each round differently and disagree by a point.
 */
export function roundIndex(value: number): number {
  return Math.round(value);
}

/** raw → 0–100, by the documented formula. */
export function toIndex(raw: number, maxRaw: number): number {
  if (maxRaw <= 0) return 0;
  return roundIndex((raw / maxRaw) * 100);
}

export interface DiscWellbeingAnswerInput {
  /** Item external_id, e.g. "dw_focus". */
  itemId: string;
  /** Chosen response position, 0-based: 0 = Never … 4 = Almost always. */
  position: number;
}

export interface DimensionScore {
  key: DimensionKey;
  /** 0–8. */
  raw: number;
  /** 0–100. */
  index: number;
}

export interface DiscWellbeingResult {
  /** 0–48. Sum of item points. */
  rawScore: number;
  /** 0–100. (raw / 48) * 100, rounded by `roundIndex`. */
  wellbeingIndex: number;
  /** Six dimension scores, in display order. */
  dimensions: DimensionScore[];
  /** Chosen position per item, indexed by the item's position in the version. */
  itemPositions: number[];
  instrumentKey: typeof DISC360_WELLBEING_INSTRUMENT_KEY;
  scoringMethod: typeof DISC_WELLBEING_SCORING_METHOD;
  scoringVersion: typeof DISC_WELLBEING_SCORING_VERSION;
  questionnaireVersion: number;
}

export interface ComputeDiscWellbeingInput {
  answers: DiscWellbeingAnswerInput[];
  /**
   * Item external_ids in administration order. Defaults to the committed V1
   * bank; a stored historical version passes its own order so an old result
   * re-reads exactly as it was scored.
   */
  itemOrder?: readonly string[];
}

const DEFAULT_ITEM_ORDER: readonly string[] = DISC360_WELLBEING_ITEMS.map(
  (item) => item.externalId,
);

/** position → points. Identity here, but declared rather than assumed. */
const POINTS_BY_POSITION: readonly number[] = DISC360_WELLBEING_OPTIONS.map(
  (option) => option.points,
);

/** externalId → dimension, for the V1 bank. */
const DIMENSION_BY_ITEM = new Map<string, DimensionKey>(
  DISC360_WELLBEING_ITEMS.map((item) => [item.externalId, item.dimension]),
);

/**
 * Scores a complete answer set.
 *
 * Every failure is an explicit error rather than a partial score: a wellbeing
 * index computed from eleven of twelve answers would look entirely plausible
 * and be quietly wrong, and it would then anchor a person's whole trend line.
 */
export function computeDiscWellbeingResult(
  input: ComputeDiscWellbeingInput,
): DiscWellbeingResult {
  const itemOrder = input.itemOrder ?? DEFAULT_ITEM_ORDER;

  if (itemOrder.length !== DISC360_WELLBEING_ITEM_COUNT) {
    throw new DiscWellbeingScoringError(
      "INVALID_ITEM_ORDER",
      `Expected ${DISC360_WELLBEING_ITEM_COUNT} items in the version, received ${itemOrder.length}`,
    );
  }
  if (new Set(itemOrder).size !== itemOrder.length) {
    throw new DiscWellbeingScoringError(
      "INVALID_ITEM_ORDER",
      "Item order contains a duplicate id",
    );
  }
  if (input.answers.length !== DISC360_WELLBEING_ITEM_COUNT) {
    throw new DiscWellbeingScoringError(
      "INCOMPLETE_ANSWERS",
      `Expected ${DISC360_WELLBEING_ITEM_COUNT} answers, received ${input.answers.length}`,
    );
  }

  const indexById = new Map(itemOrder.map((id, index) => [id, index]));
  const positions = new Array<number>(DISC360_WELLBEING_ITEM_COUNT).fill(-1);

  for (const answer of input.answers) {
    const index = indexById.get(answer.itemId);
    if (index === undefined) {
      throw new DiscWellbeingScoringError(
        "UNKNOWN_ITEM",
        `Answer references an item outside this questionnaire version: ${answer.itemId}`,
      );
    }
    if (positions[index] !== -1) {
      throw new DiscWellbeingScoringError(
        "DUPLICATE_ANSWER",
        `Item answered more than once: ${answer.itemId}`,
      );
    }
    if (
      !Number.isInteger(answer.position) ||
      answer.position < 0 ||
      answer.position >= DISC_WELLBEING_RESPONSE_POSITIONS
    ) {
      throw new DiscWellbeingScoringError(
        "INVALID_POSITION",
        `Response position must be an integer 0–${DISC_WELLBEING_RESPONSE_POSITIONS - 1}, received ${answer.position}`,
      );
    }
    positions[index] = answer.position;
  }

  // Every item is positively worded, so points are the position's value on
  // every item — there is no reverse-scoring table, and adding one would be a
  // bug rather than a refinement.
  let rawScore = 0;
  const dimensionRaw = new Map<DimensionKey, number>();
  for (const dimension of DISC360_WELLBEING_DIMENSIONS) dimensionRaw.set(dimension.key, 0);

  positions.forEach((position, index) => {
    const points = POINTS_BY_POSITION[position]!;
    rawScore += points;

    const itemId = itemOrder[index]!;
    const dimension = DIMENSION_BY_ITEM.get(itemId);
    if (dimension) {
      dimensionRaw.set(dimension, (dimensionRaw.get(dimension) ?? 0) + points);
    }
  });

  const dimensions: DimensionScore[] = DISC360_WELLBEING_DIMENSIONS.map((dimension) => {
    const raw = dimensionRaw.get(dimension.key) ?? 0;
    return { key: dimension.key, raw, index: toIndex(raw, DIMENSION_MAX_RAW) };
  });

  return {
    rawScore,
    wellbeingIndex: toIndex(rawScore, DISC_WELLBEING_MAX_RAW),
    dimensions,
    itemPositions: positions,
    instrumentKey: DISC360_WELLBEING_INSTRUMENT_KEY,
    scoringMethod: DISC_WELLBEING_SCORING_METHOD,
    scoringVersion: DISC_WELLBEING_SCORING_VERSION,
    questionnaireVersion: DISC_WELLBEING_QUESTIONNAIRE_VERSION,
  };
}

/* ── movement ───────────────────────────────────────────────────────── */

export type IndexMovement = "higher" | "lower" | "similar";

export interface IndexComparison {
  movement: IndexMovement;
  /** current − previous, in index points. */
  delta: number;
  current: number;
  previous: number;
}

/**
 * Movement against a previous index.
 *
 * Direction and a point count, and nothing else. V1 has no validated
 * minimum-change threshold, so the product may not describe a movement as an
 * improvement, a deterioration, a percentage, or clinically meaningful.
 * "5 points higher than your previous pulse" is supportable; anything that
 * grades the person is not.
 *
 * `similar` is reserved for an unchanged index — any non-zero movement is
 * reported in its own direction with its own number.
 */
export function compareIndex(current: number, previous: number): IndexComparison {
  const delta = current - previous;
  const movement: IndexMovement = delta === 0 ? "similar" : delta > 0 ? "higher" : "lower";
  return { movement, delta, current, previous };
}

/**
 * Dimensions ordered by current index.
 *
 * Used to name a person's currently stronger and currently lower dimensions.
 * Ties keep the declared display order, so the same result always produces the
 * same reading.
 */
export function rankDimensions(dimensions: DimensionScore[]): DimensionScore[] {
  const order = new Map(DISC360_WELLBEING_DIMENSIONS.map((d, i) => [d.key, i]));
  return [...dimensions].sort(
    (a, b) => b.index - a.index || (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0),
  );
}
