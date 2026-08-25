import {
  GHQ28_BIMODAL_WEIGHTS,
  GHQ28_INSTRUMENT_KEY,
  GHQ28_ITEM_COUNT,
  GHQ28_ITEM_STRUCTURE,
  GHQ28_LIKERT_WEIGHTS,
  GHQ28_RESPONSE_POSITIONS,
  GHQ28_SUBSCALE_MAX_BIMODAL,
  GHQ28_SUBSCALE_MAX_LIKERT,
  GHQ28_SUBSCALE_STRUCTURE,
  type Ghq28SubscaleKey,
} from "../../data/ghq28-items.ts";

/**
 * GHQ-28 scoring — pure, deterministic, versioned.
 *
 * ─────────────────────────────────────────────────────────────────────
 * A SEPARATE ENGINE, NOT GHQ-12 WITH A BIGGER LOOP.
 *
 * The brief is explicit and it is right: GHQ-28 is not GHQ-12 with the item
 * count changed. It carries a different range (0–28), a different Likert total
 * (0–84), a four-part subscale profile GHQ-12 does not have, and its own
 * threshold governance. Sharing a scorer would mean one file deciding both,
 * and the first "small" change to either would silently move the other.
 *
 * This module imports nothing from lib/scoring/wellbeing.ts, and that file
 * imports nothing from here — asserted in lib/wellbeing/isolation.test.ts.
 * ─────────────────────────────────────────────────────────────────────
 *
 * NOT DIAGNOSTIC. The total is a screening count. The four subscales are
 * PROFILE DIMENSIONS with no thresholds of their own — this engine cannot
 * produce a subscale threshold, because none exists to produce.
 */

export class Ghq28ScoringError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "Ghq28ScoringError";
  }
}

export const GHQ28_SCORING_METHOD = "ghq28_bimodal_0011";

/** Bumped only when the contract changes; never retroactively. */
export const GHQ28_SCORING_VERSION = "1.0.0";

export const GHQ28_MIN_SCORE = 0;
export const GHQ28_MAX_SCORE = GHQ28_ITEM_COUNT;
export const GHQ28_MAX_LIKERT_SCORE = GHQ28_ITEM_COUNT * 3;

/** Governance default. Configurable, and stamped onto every result. */
export const GHQ28_DEFAULT_THRESHOLD = 5;

export interface Ghq28AnswerInput {
  itemId: string;
  /** 0-based: 0 = 1st option … 3 = 4th option. */
  position: number;
}

export interface Ghq28SubscaleScore {
  key: Ghq28SubscaleKey;
  label: string;
  /** Bimodal count within this block, 0–7. */
  score: number;
  /** Likert total within this block, 0–21. */
  likertScore: number;
  /*
   * Deliberately absent: any threshold, band or flag. A subscale is a profile
   * dimension. Adding `atOrAboveThreshold` here would be the single change
   * that turns "somewhat more somatic responses this month" into a finding
   * about a person, so the type does not allow it to exist.
   */
}

export interface Ghq28Result {
  /** Primary screening score, 0–28. */
  totalScore: number;
  /** Secondary continuous measure, 0–84. Not shown by default. */
  likertScore: number;
  /** Four subscales, in published order. */
  subscales: Ghq28SubscaleScore[];
  itemPositions: number[];
  instrumentKey: typeof GHQ28_INSTRUMENT_KEY;
  scoringMethod: typeof GHQ28_SCORING_METHOD;
  scoringVersion: typeof GHQ28_SCORING_VERSION;
  thresholdAtCompletion: number;
  atOrAboveThreshold: boolean;
}

export interface ComputeGhq28Input {
  answers: Ghq28AnswerInput[];
  itemOrder?: readonly string[];
  threshold?: number;
}

const DEFAULT_ITEM_ORDER: readonly string[] = GHQ28_ITEM_STRUCTURE.map(
  (item) => item.externalId,
);

const SUBSCALE_BY_ITEM = new Map<string, Ghq28SubscaleKey>(
  GHQ28_ITEM_STRUCTURE.map((item) => [item.externalId, item.subscale]),
);

const SUBSCALE_LABEL: Record<Ghq28SubscaleKey, string> = Object.fromEntries(
  GHQ28_SUBSCALE_STRUCTURE.map((subscale) => [subscale.key, subscale.label]),
) as Record<Ghq28SubscaleKey, string>;

export function resolveGhq28Threshold(threshold?: number | null): number {
  if (threshold === undefined || threshold === null) return GHQ28_DEFAULT_THRESHOLD;
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > GHQ28_MAX_SCORE) {
    throw new Ghq28ScoringError(
      "INVALID_THRESHOLD",
      `Screening threshold must be an integer 1–${GHQ28_MAX_SCORE}, received ${threshold}`,
    );
  }
  return threshold;
}

export function computeGhq28Result(input: ComputeGhq28Input): Ghq28Result {
  const itemOrder = input.itemOrder ?? DEFAULT_ITEM_ORDER;

  if (itemOrder.length !== GHQ28_ITEM_COUNT) {
    throw new Ghq28ScoringError(
      "INVALID_ITEM_ORDER",
      `Expected ${GHQ28_ITEM_COUNT} items in the version, received ${itemOrder.length}`,
    );
  }
  if (new Set(itemOrder).size !== itemOrder.length) {
    throw new Ghq28ScoringError("INVALID_ITEM_ORDER", "Item order contains a duplicate id");
  }
  if (input.answers.length !== GHQ28_ITEM_COUNT) {
    throw new Ghq28ScoringError(
      "INCOMPLETE_ANSWERS",
      `Expected ${GHQ28_ITEM_COUNT} answers, received ${input.answers.length}`,
    );
  }

  const indexById = new Map(itemOrder.map((id, index) => [id, index]));
  const positions = new Array<number>(GHQ28_ITEM_COUNT).fill(-1);

  for (const answer of input.answers) {
    const index = indexById.get(answer.itemId);
    if (index === undefined) {
      throw new Ghq28ScoringError(
        "UNKNOWN_ITEM",
        `Answer references an item outside this questionnaire version: ${answer.itemId}`,
      );
    }
    if (positions[index] !== -1) {
      throw new Ghq28ScoringError(
        "DUPLICATE_ANSWER",
        `Item answered more than once: ${answer.itemId}`,
      );
    }
    if (
      !Number.isInteger(answer.position) ||
      answer.position < 0 ||
      answer.position >= GHQ28_RESPONSE_POSITIONS
    ) {
      throw new Ghq28ScoringError(
        "INVALID_POSITION",
        `Response position must be an integer 0–${GHQ28_RESPONSE_POSITIONS - 1}, received ${answer.position}`,
      );
    }
    positions[index] = answer.position;
  }

  let totalScore = 0;
  let likertScore = 0;
  const subscaleTotals = new Map<Ghq28SubscaleKey, { score: number; likert: number }>();
  for (const subscale of GHQ28_SUBSCALE_STRUCTURE) {
    subscaleTotals.set(subscale.key, { score: 0, likert: 0 });
  }

  positions.forEach((position, index) => {
    const bimodal = GHQ28_BIMODAL_WEIGHTS[position]!;
    const likert = GHQ28_LIKERT_WEIGHTS[position]!;
    totalScore += bimodal;
    likertScore += likert;

    const subscale = SUBSCALE_BY_ITEM.get(itemOrder[index]!);
    if (subscale) {
      const running = subscaleTotals.get(subscale)!;
      running.score += bimodal;
      running.likert += likert;
    }
  });

  const threshold = resolveGhq28Threshold(input.threshold);

  return {
    totalScore,
    likertScore,
    subscales: GHQ28_SUBSCALE_STRUCTURE.map((subscale) => {
      const running = subscaleTotals.get(subscale.key)!;
      return {
        key: subscale.key,
        label: SUBSCALE_LABEL[subscale.key],
        score: running.score,
        likertScore: running.likert,
      };
    }),
    itemPositions: positions,
    instrumentKey: GHQ28_INSTRUMENT_KEY,
    scoringMethod: GHQ28_SCORING_METHOD,
    scoringVersion: GHQ28_SCORING_VERSION,
    thresholdAtCompletion: threshold,
    // The TOTAL decides this, never a subscale. That independence is the whole
    // point of §5: a high somatic block does not make someone "a case".
    atOrAboveThreshold: totalScore >= threshold,
  };
}

export { GHQ28_SUBSCALE_MAX_BIMODAL, GHQ28_SUBSCALE_MAX_LIKERT };
