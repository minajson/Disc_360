import {
  DIMENSION_KEY,
  DIMENSIONS,
  type Answer,
  type DiscScores,
  type Question,
} from "../types/index.ts";

/**
 * Raw scoring pipeline — pure functions, no I/O, no randomness.
 *
 * Modules in lib/scoring use relative imports with explicit .ts extensions
 * so the Node test runner (`npm test`) can execute them without a bundler.
 */

export class ScoringError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ScoringError";
  }
}

export type AnswerInput = Pick<
  Answer,
  "questionId" | "mostOptionId" | "leastOptionId"
>;

export interface RawScores {
  most: DiscScores;
  least: DiscScores;
}

const zeroScores = (): DiscScores => ({ d: 0, i: 0, s: 0, c: 0 });

/**
 * Tallies MOST and LEAST picks per dimension.
 * Throws ScoringError when the answer set is incomplete, references unknown
 * questions/options, duplicates a question, or picks the same option twice.
 */
export function computeRawScores(
  answers: AnswerInput[],
  questions: Question[],
): RawScores {
  const questionById = new Map(questions.map((q) => [q.id, q]));

  if (answers.length !== questions.length) {
    throw new ScoringError(
      "INCOMPLETE_ANSWERS",
      `Expected ${questions.length} answers, received ${answers.length}`,
    );
  }

  const most = zeroScores();
  const least = zeroScores();
  const seen = new Set<string>();

  for (const answer of answers) {
    const question = questionById.get(answer.questionId);
    if (!question) {
      throw new ScoringError(
        "UNKNOWN_QUESTION",
        `Unknown question id: ${answer.questionId}`,
      );
    }
    if (seen.has(answer.questionId)) {
      throw new ScoringError(
        "DUPLICATE_ANSWER",
        `Question answered twice: ${answer.questionId}`,
      );
    }
    seen.add(answer.questionId);

    if (answer.mostOptionId === answer.leastOptionId) {
      throw new ScoringError(
        "SAME_OPTION",
        `MOST and LEAST are the same option on ${answer.questionId}`,
      );
    }

    const mostOption = question.options.find((o) => o.id === answer.mostOptionId);
    const leastOption = question.options.find(
      (o) => o.id === answer.leastOptionId,
    );
    if (!mostOption || !leastOption) {
      throw new ScoringError(
        "OPTION_MISMATCH",
        `Options do not belong to ${answer.questionId}`,
      );
    }

    most[DIMENSION_KEY[mostOption.dimension]] += 1;
    least[DIMENSION_KEY[leastOption.dimension]] += 1;
  }

  return { most, least };
}

/** net = most − least per dimension. Range −N…+N for N questions. */
export function computeNet(raw: RawScores): DiscScores {
  const net = zeroScores();
  for (const dim of DIMENSIONS) {
    const key = DIMENSION_KEY[dim];
    net[key] = raw.most[key] - raw.least[key];
  }
  return net;
}

/**
 * Linear normalization of net scores to 0–100 (midpoint 50 = neutral).
 * `questionCount` is the maximum absolute net value per dimension.
 */
export function normalizeScores(net: DiscScores, questionCount: number): DiscScores {
  const normalized = zeroScores();
  for (const dim of DIMENSIONS) {
    const key = DIMENSION_KEY[dim];
    const value = Math.round(((net[key] + questionCount) / (2 * questionCount)) * 100);
    normalized[key] = Math.max(0, Math.min(100, value));
  }
  return normalized;
}
