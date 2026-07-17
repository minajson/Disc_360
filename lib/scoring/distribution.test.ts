import assert from "node:assert/strict";
import { test } from "node:test";
import { discQuestions } from "../../data/disc-questions.ts";
import {
  computeDistribution,
  computeNet,
  computeRawScores,
  ScoringError,
  type AnswerInput,
} from "./pipeline.ts";
import { computeResult } from "./compute-result.ts";
import { deriveHybridType, rankDimensions } from "./archetype.ts";
import { DIMENSION_KEY, type Dimension, type DiscScores } from "../types/index.ts";

const optionOf = (questionIndex: number, dimension: Dimension): string => {
  const question = discQuestions[questionIndex];
  assert.ok(question);
  const option = question.options.find((o) => o.dimension === dimension);
  assert.ok(option);
  return option.id;
};

const uniformAnswers = (most: Dimension, least: Dimension): AnswerInput[] =>
  discQuestions.map((question, index) => ({
    questionId: question.id,
    mostOptionId: optionOf(index, most),
    leastOptionId: optionOf(index, least),
  }));

const total = (scores: DiscScores): number =>
  scores.d + scores.i + scores.s + scores.c;

/* ── Displayed percentages ──────────────────────────────────── */

test("distribution totals exactly 100 for a uniform profile", () => {
  const net = computeNet(computeRawScores(uniformAnswers("D", "S"), discQuestions));
  assert.equal(total(computeDistribution(net, 24)), 100);
});

test("distribution totals exactly 100 for a flat profile", () => {
  assert.deepEqual(computeDistribution({ d: 0, i: 0, s: 0, c: 0 }, 24), {
    d: 25,
    i: 25,
    s: 25,
    c: 25,
  });
});

test("distribution totals exactly 100 across every reachable net split", () => {
  // Net scores always sum to zero: each answer adds +1 to one dimension and
  // −1 to another. Sweep the reachable space rather than a sampled subset.
  let checked = 0;
  for (let d = -24; d <= 24; d += 1) {
    for (let i = -24; i <= 24; i += 1) {
      for (let s = -24; s <= 24; s += 1) {
        const c = -(d + i + s);
        if (c < -24 || c > 24) continue;
        const distribution = computeDistribution({ d, i, s, c }, 24);
        assert.equal(
          total(distribution),
          100,
          `net ${d}/${i}/${s}/${c} → ${JSON.stringify(distribution)}`,
        );
        checked += 1;
      }
    }
  }
  assert.ok(checked > 50_000, `swept ${checked} nets`);
});

test("distribution never emits a negative share", () => {
  const net = computeNet(computeRawScores(uniformAnswers("D", "S"), discQuestions));
  const distribution = computeDistribution(net, 24);
  for (const key of ["d", "i", "s", "c"] as const) {
    assert.ok(distribution[key] >= 0, `${key} is non-negative`);
  }
});

test("distribution reflects the ranking: strongest dimension gets the largest share", () => {
  const net = computeNet(computeRawScores(uniformAnswers("D", "S"), discQuestions));
  const distribution = computeDistribution(net, 24);
  assert.ok(distribution.d > distribution.i);
  assert.ok(distribution.i > distribution.s);
  assert.equal(distribution.s, 0, "a fully rejected dimension bottoms out at 0");
});

test("distribution rejects a zero-weight input rather than dividing by zero", () => {
  assert.throws(
    () => computeDistribution({ d: -24, i: -24, s: -24, c: -24 }, 24),
    (error: unknown) =>
      error instanceof ScoringError && error.code === "EMPTY_DISTRIBUTION",
  );
});

/* ── Determinism ────────────────────────────────────────────── */

test("ties resolve deterministically in D → I → S → C order", () => {
  assert.deepEqual(rankDimensions({ d: 50, i: 50, s: 50, c: 50 }), [
    "D",
    "I",
    "S",
    "C",
  ]);
  assert.deepEqual(rankDimensions({ d: 10, i: 60, s: 60, c: 10 }), [
    "I",
    "S",
    "D",
    "C",
  ]);
});

test("largest remainder awards leftover points to the largest fractions", () => {
  // weights 25/25/23/23 → exact 26.04/26.04/23.96/23.96, floors sum to 98.
  // The two 0.96 fractions take both leftover points.
  const distribution = computeDistribution({ d: 1, i: 1, s: -1, c: -1 }, 24);
  assert.equal(total(distribution), 100);
  assert.deepEqual(distribution, { d: 26, i: 26, s: 24, c: 24 });
});

test("a fractional tie breaks in D → I → S → C order", () => {
  // weights 12/12/48/24 → exact 12.5/12.5/50/25, floors sum to 99, so exactly
  // one leftover point is available to two dimensions tied at .5. D must take
  // it — this is the only case where the tie-break is observable.
  const distribution = computeDistribution({ d: -12, i: -12, s: 24, c: 0 }, 24);
  assert.equal(total(distribution), 100);
  assert.deepEqual(distribution, { d: 13, i: 12, s: 50, c: 25 });
});

test("scoring is deterministic: identical answers produce identical results", () => {
  const answers = uniformAnswers("I", "C");
  const run = () =>
    computeResult({
      resultId: "r1",
      sessionId: "s1",
      userId: "u1",
      answers,
      questions: discQuestions,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  assert.deepEqual(run(), run());
});

/* ── Display randomization must not move the score ──────────── */

test("randomized option display preserves scoring", () => {
  // Scoring reads option ids, so shuffling the presented order — including
  // shuffling the questions themselves — must not move a single number.
  const answers = uniformAnswers("D", "C");
  const baseline = computeResult({
    resultId: "r",
    sessionId: "s",
    userId: "u",
    answers,
    questions: discQuestions,
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  // Deterministic pseudo-shuffle: no Math.random, so failures reproduce.
  let seed = 7;
  const nextInt = (bound: number): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % bound;
  };
  const shuffle = <T>(items: T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = nextInt(i + 1);
      [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
    }
    return copy;
  };

  const shuffledQuestions = shuffle(
    discQuestions.map((question) => ({
      ...question,
      options: shuffle([...question.options]) as typeof question.options,
    })),
  );

  const shuffled = computeResult({
    resultId: "r",
    sessionId: "s",
    userId: "u",
    answers: shuffle([...answers]),
    questions: shuffledQuestions,
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.deepEqual(shuffled.normalized, baseline.normalized);
  assert.deepEqual(shuffled.distribution, baseline.distribution);
  assert.equal(shuffled.archetypeCode, baseline.archetypeCode);
  assert.equal(shuffled.hybridType, baseline.hybridType);
});

/* ── Hybrid type ────────────────────────────────────────────── */

test("hybrid type uses the two highest dimensions, highest first", () => {
  assert.equal(deriveHybridType({ d: 90, i: 70, s: 40, c: 20 }), "DI");
  assert.equal(deriveHybridType({ d: 70, i: 20, s: 90, c: 40 }), "SD");
  assert.equal(deriveHybridType({ d: 20, i: 90, s: 40, c: 70 }), "IA");
});

test("hybrid type can express the diagonal pairs the archetype suppresses", () => {
  // D↔S and I↔C never pair in `archetypeCode`; the hybrid type is the plain
  // top-two reading, so DS and IA must be reachable.
  assert.equal(deriveHybridType({ d: 90, i: 20, s: 80, c: 10 }), "DS");
  assert.equal(deriveHybridType({ d: 10, i: 90, s: 20, c: 80 }), "IA");
});

test("hybrid type renders Analytical as A, never C", () => {
  const hybrids = [
    deriveHybridType({ d: 10, i: 20, s: 30, c: 90 }),
    deriveHybridType({ d: 90, i: 10, s: 20, c: 80 }),
    deriveHybridType({ d: 10, i: 80, s: 20, c: 90 }),
  ];
  for (const hybrid of hybrids) {
    assert.doesNotMatch(hybrid, /C/, `${hybrid} uses A for Analytical`);
  }
  assert.equal(deriveHybridType({ d: 10, i: 20, s: 30, c: 90 }), "AS");
});

test("hybrid type agrees with the archetype about the primary dimension", () => {
  const result = computeResult({
    resultId: "r",
    sessionId: "s",
    userId: "u",
    answers: uniformAnswers("S", "D"),
    questions: discQuestions,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  const primaryLetter = result.primaryDimension === "C" ? "A" : result.primaryDimension;
  assert.equal(result.hybridType[0], primaryLetter);
});

/* ── The two scales stay distinct ───────────────────────────── */

test("normalized is an intensity scale and is not expected to total 100", () => {
  const net = computeNet(computeRawScores(uniformAnswers("D", "S"), discQuestions));
  const result = computeResult({
    resultId: "r",
    sessionId: "s",
    userId: "u",
    answers: uniformAnswers("D", "S"),
    questions: discQuestions,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(result.normalized.d, 100);
  assert.equal(result.normalized.s, 0);
  assert.equal(total(result.normalized), 200);
  assert.equal(total(result.distribution), 100);
  assert.equal(net.d, 24);
});

test("negative raw net values are preserved on the result", () => {
  const result = computeResult({
    resultId: "r",
    sessionId: "s",
    userId: "u",
    answers: uniformAnswers("D", "S"),
    questions: discQuestions,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(result.net.s, -24, "rejection stays negative internally");
  assert.equal(result.distribution.s, 0, "but never displays as negative");
});

test("DIMENSION_KEY maps the internal Analytical key to c", () => {
  assert.equal(DIMENSION_KEY.C, "c");
});
