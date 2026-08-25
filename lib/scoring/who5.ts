import {
  WHO5_INSTRUMENT_KEY,
  WHO5_ITEM_COUNT,
  WHO5_ITEM_STRUCTURE,
  WHO5_POINTS_BY_POSITION,
  WHO5_RAW_MAX,
  WHO5_RESPONSE_POSITIONS,
  WHO5_TRANSFORM_MULTIPLIER,
} from "../../data/who5-items.ts";

/**
 * WHO-5 Well-Being Index scoring — pure, deterministic, versioned.
 *
 * Uses the instrument's OWN documented scoring: sum the five items 0–5 for a
 * raw 0–25, then multiply by 4 for the published 0–100 percentage scale.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THE ×4 MATTERS, AND WHY THIS IS NOT THE DISC360 FORMULA.
 *
 * The DISC360 Wellbeing Index normalises with (raw / max) * 100. WHO-5 uses
 * raw * 4. On WHO-5's own numbers the two happen to agree — 25 × 4 = 100 and
 * (25/25) × 100 = 100 — but they are different documented rules belonging to
 * different instruments, and implementing WHO-5 with DISC360's formula would
 * be adopting someone else's scale by coincidence rather than by specification.
 *
 * The two also produce 0–100 numbers that must never be compared. A WHO-5 of
 * 72 and a Wellbeing Index of 72 are not the same statement about a person.
 * ─────────────────────────────────────────────────────────────────────
 *
 * NOT DIAGNOSTIC, and NOT WHO-ENDORSED. This deployment configures no
 * threshold and invents no classification.
 */

export class Who5ScoringError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "Who5ScoringError";
  }
}

export const WHO5_SCORING_METHOD = "who5_sum_x4";
export const WHO5_SCORING_VERSION = "1.0.0";
export const WHO5_MIN_SCORE = 0;
export const WHO5_MAX_SCORE = 100;

export interface Who5AnswerInput {
  itemId: string;
  /** 0-based: 0 = "at no time" … 5 = "all of the time". */
  position: number;
}

export interface Who5Result {
  /** Raw total across five items, 0–25. */
  rawScore: number;
  /** The published transformed score, 0–100. */
  transformedScore: number;
  itemPositions: number[];
  instrumentKey: typeof WHO5_INSTRUMENT_KEY;
  scoringMethod: typeof WHO5_SCORING_METHOD;
  scoringVersion: typeof WHO5_SCORING_VERSION;
}

export interface ComputeWho5Input {
  answers: Who5AnswerInput[];
  itemOrder?: readonly string[];
}

const DEFAULT_ITEM_ORDER: readonly string[] = WHO5_ITEM_STRUCTURE.map((item) => item.externalId);

export function computeWho5Result(input: ComputeWho5Input): Who5Result {
  const itemOrder = input.itemOrder ?? DEFAULT_ITEM_ORDER;

  if (itemOrder.length !== WHO5_ITEM_COUNT) {
    throw new Who5ScoringError(
      "INVALID_ITEM_ORDER",
      `Expected ${WHO5_ITEM_COUNT} items in the version, received ${itemOrder.length}`,
    );
  }
  if (new Set(itemOrder).size !== itemOrder.length) {
    throw new Who5ScoringError("INVALID_ITEM_ORDER", "Item order contains a duplicate id");
  }
  if (input.answers.length !== WHO5_ITEM_COUNT) {
    throw new Who5ScoringError(
      "INCOMPLETE_ANSWERS",
      `Expected ${WHO5_ITEM_COUNT} answers, received ${input.answers.length}`,
    );
  }

  const indexById = new Map(itemOrder.map((id, index) => [id, index]));
  const positions = new Array<number>(WHO5_ITEM_COUNT).fill(-1);

  for (const answer of input.answers) {
    const index = indexById.get(answer.itemId);
    if (index === undefined) {
      throw new Who5ScoringError(
        "UNKNOWN_ITEM",
        `Answer references an item outside this questionnaire version: ${answer.itemId}`,
      );
    }
    if (positions[index] !== -1) {
      throw new Who5ScoringError(
        "DUPLICATE_ANSWER",
        `Item answered more than once: ${answer.itemId}`,
      );
    }
    if (
      !Number.isInteger(answer.position) ||
      answer.position < 0 ||
      answer.position >= WHO5_RESPONSE_POSITIONS
    ) {
      throw new Who5ScoringError(
        "INVALID_POSITION",
        `Response position must be an integer 0–${WHO5_RESPONSE_POSITIONS - 1}, received ${answer.position}`,
      );
    }
    positions[index] = answer.position;
  }

  let rawScore = 0;
  for (const position of positions) rawScore += WHO5_POINTS_BY_POSITION[position]!;

  return {
    rawScore,
    transformedScore: rawScore * WHO5_TRANSFORM_MULTIPLIER,
    itemPositions: positions,
    instrumentKey: WHO5_INSTRUMENT_KEY,
    scoringMethod: WHO5_SCORING_METHOD,
    scoringVersion: WHO5_SCORING_VERSION,
  };
}

export { WHO5_RAW_MAX, WHO5_TRANSFORM_MULTIPLIER };
