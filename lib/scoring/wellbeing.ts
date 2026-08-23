import {
  BIMODAL_WEIGHTS,
  LIKERT_WEIGHTS,
  WELLBEING_ITEM_COUNT,
  WELLBEING_ITEM_STRUCTURE,
  WELLBEING_RESPONSE_POSITIONS,
} from "../../data/wellbeing-items.ts";

/**
 * Wellbeing Pulse scoring — pure, deterministic, versioned.
 *
 * `computeWellbeingResult` is the only entry point. No I/O, no clock, no
 * randomness: the same answers always produce the same result, which is what
 * makes a stored `scoring_version` meaningful.
 *
 * ─────────────────────────────────────────────────────────────────────
 * INDEPENDENCE — this engine shares nothing with DISC or Focus.
 *
 * It imports no DISC type, no Focus type and no shared score model, and
 * nothing in lib/scoring/{compute-result,pipeline,archetype,intensity,focus}
 * imports this file. A wellbeing total can therefore never be added to,
 * averaged with, or ranked against a behavioural or attention score, because
 * there is no code path where the two values meet.
 * ─────────────────────────────────────────────────────────────────────
 *
 * NOT DIAGNOSTIC. The total is a screening count of responses indicating more
 * recent difficulty than usual. It is not a severity scale, not a diagnosis,
 * and carries no clinical meaning on its own.
 */

export class WellbeingScoringError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "WellbeingScoringError";
  }
}

/** Identifier stored on every result so historical rows stay interpretable. */
export const WELLBEING_SCORING_METHOD = "ghq_bimodal_0011";

/**
 * Bumped ONLY when the scoring contract changes, and never retroactively.
 * Existing rows keep the version they were computed under; nothing re-scores.
 * Frozen by lib/scoring/wellbeing.test.ts.
 */
export const WELLBEING_SCORING_VERSION = "1.0.0";

/** Platform default screening cut-off (3/4). Governance may configure it. */
export const DEFAULT_SCREENING_THRESHOLD = 4;

export const WELLBEING_MIN_SCORE = 0;
export const WELLBEING_MAX_SCORE = WELLBEING_ITEM_COUNT;
export const WELLBEING_MAX_LIKERT_SCORE = WELLBEING_ITEM_COUNT * (WELLBEING_RESPONSE_POSITIONS - 1);

export interface WellbeingAnswerInput {
  /** Item external_id, e.g. "item_07". */
  itemId: string;
  /** Chosen response position, 0-based: 0 = 1st option … 3 = 4th option. */
  position: number;
}

export interface WellbeingScore {
  /**
   * Primary screening score, 0–12. Higher means more responses indicating
   * increased psychological distress relative to usual.
   */
  totalScore: number;
  /**
   * Secondary continuous measure, 0–36. Research and trend use only — it does
   * not set the threshold and is not surfaced to participants or to
   * management analytics by default.
   */
  likertScore: number;
  /**
   * Chosen position per item, indexed by the item's position in the version.
   * Length is always WELLBEING_ITEM_COUNT.
   */
  itemPositions: number[];
  scoringMethod: typeof WELLBEING_SCORING_METHOD;
  scoringVersion: typeof WELLBEING_SCORING_VERSION;
}

export interface WellbeingResult extends WellbeingScore {
  /** The cut-off in force when this attempt completed. Stored on the row. */
  thresholdAtCompletion: number;
  /** totalScore >= thresholdAtCompletion. Screening outcome, not a diagnosis. */
  atOrAboveThreshold: boolean;
}

export interface ComputeWellbeingInput {
  answers: WellbeingAnswerInput[];
  /**
   * Item external_ids in administration order. Defaults to the committed
   * structure; a stored historical version passes its own order so an old
   * result re-reads exactly as it was scored.
   */
  itemOrder?: readonly string[];
  /** Cut-off in force for this attempt. Defaults to the platform default. */
  threshold?: number;
}

const DEFAULT_ITEM_ORDER: readonly string[] = WELLBEING_ITEM_STRUCTURE.map(
  (item) => item.externalId,
);

/**
 * Validates a complete, well-formed answer set and returns both scores.
 *
 * Every failure is an explicit error rather than a partial score: a wellbeing
 * screening result that quietly dropped an item would still look like a valid
 * total, and would be wrong in the direction of under-detection.
 */
export function computeWellbeingResult(input: ComputeWellbeingInput): WellbeingResult {
  const itemOrder = input.itemOrder ?? DEFAULT_ITEM_ORDER;

  if (itemOrder.length !== WELLBEING_ITEM_COUNT) {
    throw new WellbeingScoringError(
      "INVALID_ITEM_ORDER",
      `Expected ${WELLBEING_ITEM_COUNT} items in the version, received ${itemOrder.length}`,
    );
  }
  if (new Set(itemOrder).size !== itemOrder.length) {
    throw new WellbeingScoringError("INVALID_ITEM_ORDER", "Item order contains a duplicate id");
  }
  if (input.answers.length !== WELLBEING_ITEM_COUNT) {
    throw new WellbeingScoringError(
      "INCOMPLETE_ANSWERS",
      `Expected ${WELLBEING_ITEM_COUNT} answers, received ${input.answers.length}`,
    );
  }

  const indexById = new Map(itemOrder.map((id, index) => [id, index]));
  const positions = new Array<number>(WELLBEING_ITEM_COUNT).fill(-1);

  for (const answer of input.answers) {
    const index = indexById.get(answer.itemId);
    if (index === undefined) {
      throw new WellbeingScoringError(
        "UNKNOWN_ITEM",
        `Answer references an item outside this questionnaire version: ${answer.itemId}`,
      );
    }
    if (positions[index] !== -1) {
      throw new WellbeingScoringError(
        "DUPLICATE_ANSWER",
        `Item answered more than once: ${answer.itemId}`,
      );
    }
    if (
      !Number.isInteger(answer.position) ||
      answer.position < 0 ||
      answer.position >= WELLBEING_RESPONSE_POSITIONS
    ) {
      throw new WellbeingScoringError(
        "INVALID_POSITION",
        `Response position must be an integer 0–${WELLBEING_RESPONSE_POSITIONS - 1}, received ${answer.position}`,
      );
    }
    positions[index] = answer.position;
  }

  let totalScore = 0;
  let likertScore = 0;
  for (const position of positions) {
    totalScore += BIMODAL_WEIGHTS[position]!;
    likertScore += LIKERT_WEIGHTS[position]!;
  }

  const threshold = resolveThreshold(input.threshold);

  return {
    totalScore,
    likertScore,
    itemPositions: positions,
    scoringMethod: WELLBEING_SCORING_METHOD,
    scoringVersion: WELLBEING_SCORING_VERSION,
    thresholdAtCompletion: threshold,
    atOrAboveThreshold: totalScore >= threshold,
  };
}

/**
 * A configured threshold must land inside the score range, or the screen is
 * either unreachable or always true. Governance sets the value; this is the
 * last line that refuses a nonsensical one.
 */
export function resolveThreshold(threshold?: number | null): number {
  if (threshold === undefined || threshold === null) return DEFAULT_SCREENING_THRESHOLD;
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > WELLBEING_MAX_SCORE) {
    throw new WellbeingScoringError(
      "INVALID_THRESHOLD",
      `Screening threshold must be an integer 1–${WELLBEING_MAX_SCORE}, received ${threshold}`,
    );
  }
  return threshold;
}

/** Screening outcome for a score already stored with its own threshold. */
export function isAtOrAboveThreshold(totalScore: number, threshold: number): boolean {
  return totalScore >= threshold;
}

export type WellbeingMovement = "lower" | "higher" | "similar";

export interface WellbeingComparison {
  movement: WellbeingMovement;
  /** current − previous. Negative means fewer such responses than last time. */
  delta: number;
  current: number;
  previous: number;
}

/**
 * Movement against this participant's own previous pulse.
 *
 * Direction and a number, and nothing else. There is no validated
 * minimum-change threshold for GHQ-12 at the individual level, so the product
 * must not describe a movement as an improvement, a deterioration, or a
 * percentage — "2 points lower than your previous pulse" is supportable;
 * "your mental health improved by 40%" is not.
 *
 * `similar` is reserved for an unchanged score. Any non-zero movement is
 * reported in its own direction with its own number, never rounded away.
 */
export function compareToPrevious(current: number, previous: number): WellbeingComparison {
  const delta = current - previous;
  const movement: WellbeingMovement = delta === 0 ? "similar" : delta < 0 ? "lower" : "higher";
  return { movement, delta, current, previous };
}
