import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GHQ28_ITEM_STRUCTURE,
  GHQ28_SUBSCALE_STRUCTURE,
  subscaleForItemNumber,
  type Ghq28SubscaleKey,
} from "../../data/ghq28-items.ts";
import {
  computeGhq28Result,
  GHQ28_DEFAULT_THRESHOLD,
  GHQ28_MAX_LIKERT_SCORE,
  GHQ28_MAX_SCORE,
  GHQ28_SCORING_METHOD,
  GHQ28_SCORING_VERSION,
  Ghq28ScoringError,
  resolveGhq28Threshold,
} from "./ghq28.ts";

const ITEM_IDS = GHQ28_ITEM_STRUCTURE.map((item) => item.externalId);
const allAt = (position: number) => ITEM_IDS.map((itemId) => ({ itemId, position }));
const fromPositions = (positions: number[]) =>
  ITEM_IDS.map((itemId, index) => ({ itemId, position: positions[index]! }));
const sub = (result: ReturnType<typeof computeGhq28Result>, key: Ghq28SubscaleKey) =>
  result.subscales.find((subscale) => subscale.key === key)!;

/* ── structure ──────────────────────────────────────────────────────── */

test("GHQ-28 is 28 items of four positions in four seven-item blocks", () => {
  assert.equal(GHQ28_ITEM_STRUCTURE.length, 28);
  assert.equal(GHQ28_SUBSCALE_STRUCTURE.length, 4);
  assert.equal(new Set(ITEM_IDS).size, 28);
  assert.deepEqual(
    GHQ28_ITEM_STRUCTURE.map((item) => item.position),
    Array.from({ length: 28 }, (_, index) => index),
  );
});

test("items map to the published seven-item blocks", () => {
  assert.equal(subscaleForItemNumber(1), "somatic");
  assert.equal(subscaleForItemNumber(7), "somatic");
  assert.equal(subscaleForItemNumber(8), "anxiety_insomnia");
  assert.equal(subscaleForItemNumber(14), "anxiety_insomnia");
  assert.equal(subscaleForItemNumber(15), "social_dysfunction");
  assert.equal(subscaleForItemNumber(21), "social_dysfunction");
  assert.equal(subscaleForItemNumber(22), "severe_depression");
  assert.equal(subscaleForItemNumber(28), "severe_depression");
  assert.throws(() => subscaleForItemNumber(0), RangeError);
  assert.throws(() => subscaleForItemNumber(29), RangeError);
});

test("each block holds exactly seven items and all 28 are covered", () => {
  const counts = new Map<string, number>();
  for (const item of GHQ28_ITEM_STRUCTURE) {
    counts.set(item.subscale, (counts.get(item.subscale) ?? 0) + 1);
  }
  assert.equal(counts.size, 4);
  for (const [key, count] of counts) assert.equal(count, 7, `${key} holds seven items`);
});

/* ── totals ─────────────────────────────────────────────────────────── */

test("position 1 and 2 score 0; position 3 and 4 score 1", () => {
  assert.equal(computeGhq28Result({ answers: allAt(0) }).totalScore, 0);
  assert.equal(computeGhq28Result({ answers: allAt(1) }).totalScore, 0);
  assert.equal(computeGhq28Result({ answers: allAt(2) }).totalScore, 28);
  assert.equal(computeGhq28Result({ answers: allAt(3) }).totalScore, 28);
});

test("all first responses total 0; all fourth responses total 28", () => {
  assert.equal(computeGhq28Result({ answers: allAt(0) }).totalScore, 0);
  const high = computeGhq28Result({ answers: allAt(3) });
  assert.equal(high.totalScore, 28);
  assert.equal(high.totalScore, GHQ28_MAX_SCORE);
});

test("the Likert measure runs 0–84 and is independent of the 0–28 total", () => {
  assert.equal(computeGhq28Result({ answers: allAt(0) }).likertScore, 0);
  assert.equal(computeGhq28Result({ answers: allAt(1) }).likertScore, 28);
  assert.equal(computeGhq28Result({ answers: allAt(2) }).likertScore, 56);
  assert.equal(computeGhq28Result({ answers: allAt(3) }).likertScore, 84);
  assert.equal(GHQ28_MAX_LIKERT_SCORE, 84);
});

test("position 2 separates the scales — 0 bimodal, 28 Likert", () => {
  const result = computeGhq28Result({ answers: allAt(1) });
  assert.equal(result.totalScore, 0);
  assert.equal(result.likertScore, 28);
});

test("each item contributes exactly one point, and no item is reversed", () => {
  for (let index = 0; index < 28; index += 1) {
    const positions = new Array(28).fill(0);
    positions[index] = 3;
    const result = computeGhq28Result({ answers: fromPositions(positions) });
    assert.equal(result.totalScore, 1, `item ${ITEM_IDS[index]} contributes 1 at position 4`);
  }
});

/* ── subscales ──────────────────────────────────────────────────────── */

test("each subscale runs 0–7 bimodal and 0–21 Likert", () => {
  const low = computeGhq28Result({ answers: allAt(0) });
  const high = computeGhq28Result({ answers: allAt(3) });
  for (const subscale of low.subscales) {
    assert.equal(subscale.score, 0);
    assert.equal(subscale.likertScore, 0);
  }
  for (const subscale of high.subscales) {
    assert.equal(subscale.score, 7);
    assert.equal(subscale.likertScore, 21);
  }
});

test("a subscale reflects only its own seven items", () => {
  // Max items 22–28 (severe depression block), floor everything else.
  const positions = new Array(28).fill(0);
  for (let index = 21; index < 28; index += 1) positions[index] = 3;
  const result = computeGhq28Result({ answers: fromPositions(positions) });

  assert.equal(sub(result, "severe_depression").score, 7);
  assert.equal(sub(result, "somatic").score, 0);
  assert.equal(sub(result, "anxiety_insomnia").score, 0);
  assert.equal(sub(result, "social_dysfunction").score, 0);
  assert.equal(result.totalScore, 7);
});

test("subscale scores always sum to the total", () => {
  for (const positions of [
    Array.from({ length: 28 }, (_, index) => index % 4),
    Array.from({ length: 28 }, (_, index) => (index * 3) % 4),
    new Array(28).fill(2),
  ]) {
    const result = computeGhq28Result({ answers: fromPositions(positions) });
    const summed = result.subscales.reduce((total, subscale) => total + subscale.score, 0);
    assert.equal(summed, result.totalScore);
    const summedLikert = result.subscales.reduce((t, s) => t + s.likertScore, 0);
    assert.equal(summedLikert, result.likertScore);
  }
});

test("subscales are returned in published order", () => {
  const result = computeGhq28Result({ answers: allAt(1) });
  assert.deepEqual(result.subscales.map((subscale) => subscale.key), [
    "somatic",
    "anxiety_insomnia",
    "social_dysfunction",
    "severe_depression",
  ]);
});

test("NO subscale carries a threshold, a band or a flag", () => {
  const result = computeGhq28Result({ answers: allAt(3) });
  for (const subscale of result.subscales) {
    assert.deepEqual(
      Object.keys(subscale).sort(),
      ["key", "label", "likertScore", "score"],
      "a subscale exposes counts only — never an interpretation",
    );
  }
});

/* ── threshold is a TOTAL-score decision ────────────────────────────── */

test("the default GHQ-28 threshold is 5, and is configurable", () => {
  assert.equal(GHQ28_DEFAULT_THRESHOLD, 5);
  assert.equal(resolveGhq28Threshold(undefined), 5);
  assert.equal(resolveGhq28Threshold(9), 9);
  for (const bad of [0, -1, 29, 4.5, Number.NaN]) {
    assert.throws(() => resolveGhq28Threshold(bad), Ghq28ScoringError, `refuses ${bad}`);
  }
});

test("score 4 is below the default threshold and 5 is at or above it", () => {
  const four = new Array(28).fill(0);
  for (let index = 0; index < 4; index += 1) four[index] = 3;
  const below = computeGhq28Result({ answers: fromPositions(four) });
  assert.equal(below.totalScore, 4);
  assert.equal(below.atOrAboveThreshold, false);

  const five = new Array(28).fill(0);
  for (let index = 0; index < 5; index += 1) five[index] = 3;
  const at = computeGhq28Result({ answers: fromPositions(five) });
  assert.equal(at.totalScore, 5);
  assert.equal(at.atOrAboveThreshold, true);
});

test("a high subscale alone never crosses the threshold — only the total does", () => {
  // All seven severe-depression items at the top, everything else at the floor:
  // total 7, which crosses a threshold of 5 on the TOTAL. Raise the threshold
  // above 7 and the same profile no longer crosses — proving the subscale is
  // not making the decision.
  const positions = new Array(28).fill(0);
  for (let index = 21; index < 28; index += 1) positions[index] = 3;

  const crosses = computeGhq28Result({ answers: fromPositions(positions), threshold: 5 });
  assert.equal(sub(crosses, "severe_depression").score, 7);
  assert.equal(crosses.atOrAboveThreshold, true);

  const doesNot = computeGhq28Result({ answers: fromPositions(positions), threshold: 10 });
  assert.equal(sub(doesNot, "severe_depression").score, 7, "same subscale profile");
  assert.equal(doesNot.atOrAboveThreshold, false, "and the total decides, not the subscale");
});

test("the threshold in force is stamped on the result", () => {
  const result = computeGhq28Result({ answers: allAt(2), threshold: 12 });
  assert.equal(result.thresholdAtCompletion, 12);
});

/* ── validation ─────────────────────────────────────────────────────── */

test("incomplete, duplicate, unknown and out-of-range answers are all refused", () => {
  assert.throws(
    () => computeGhq28Result({ answers: allAt(0).slice(0, 27) }),
    (error: unknown) => error instanceof Ghq28ScoringError && error.code === "INCOMPLETE_ANSWERS",
  );

  const duplicate = allAt(0);
  duplicate[5] = { itemId: ITEM_IDS[0]!, position: 3 };
  assert.throws(
    () => computeGhq28Result({ answers: duplicate }),
    (error: unknown) => error instanceof Ghq28ScoringError && error.code === "DUPLICATE_ANSWER",
  );

  const unknown = allAt(0);
  unknown[3] = { itemId: "ghq28_item_99", position: 1 };
  assert.throws(
    () => computeGhq28Result({ answers: unknown }),
    (error: unknown) => error instanceof Ghq28ScoringError && error.code === "UNKNOWN_ITEM",
  );

  for (const position of [-1, 4, 1.5, Number.NaN]) {
    const answers = allAt(0);
    answers[2] = { itemId: ITEM_IDS[2]!, position };
    assert.throws(
      () => computeGhq28Result({ answers }),
      (error: unknown) => error instanceof Ghq28ScoringError && error.code === "INVALID_POSITION",
    );
  }
});

test("a GHQ-12 item id is rejected — the engines do not accept each other's input", () => {
  const answers = allAt(0);
  answers[0] = { itemId: "item_01", position: 2 };
  assert.throws(
    () => computeGhq28Result({ answers }),
    (error: unknown) => error instanceof Ghq28ScoringError && error.code === "UNKNOWN_ITEM",
  );
});

/* ── freeze ─────────────────────────────────────────────────────────── */

test("SCORING FREEZE — GHQ-28 golden values", () => {
  assert.equal(GHQ28_SCORING_METHOD, "ghq28_bimodal_0011");
  assert.equal(GHQ28_SCORING_VERSION, "1.0.0");

  // Repeating 0,1,2,3 across 28 items: seven of each position.
  const cycled = Array.from({ length: 28 }, (_, index) => index % 4);
  const result = computeGhq28Result({ answers: fromPositions(cycled) });
  assert.equal(result.totalScore, 14, "positions 2 and 3 count: 7 + 7");
  assert.equal(result.likertScore, 42, "(0+1+2+3) x 7");
  // Blocks pick up the cycle at different offsets, so they are not identical:
  //   items  1–7  → positions 0,1,2,3,0,1,2 → bimodal 3, likert 9
  //   items  8–14 → positions 3,0,1,2,3,0,1 → bimodal 3, likert 10
  //   items 15–21 → positions 2,3,0,1,2,3,0 → bimodal 4, likert 11
  //   items 22–28 → positions 1,2,3,0,1,2,3 → bimodal 4, likert 12
  assert.deepEqual(
    result.subscales.map((subscale) => subscale.score),
    [3, 3, 4, 4],
  );
  assert.deepEqual(
    result.subscales.map((subscale) => subscale.likertScore),
    [9, 10, 11, 12],
  );
});

test("every result carries its instrument, method and version", () => {
  const result = computeGhq28Result({ answers: allAt(2) });
  assert.equal(result.instrumentKey, "ghq28");
  assert.equal(result.scoringMethod, "ghq28_bimodal_0011");
  assert.equal(result.scoringVersion, "1.0.0");
});
