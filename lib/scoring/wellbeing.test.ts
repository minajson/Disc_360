import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BIMODAL_WEIGHTS,
  LIKERT_WEIGHTS,
  WELLBEING_ITEM_COUNT,
  WELLBEING_ITEM_STRUCTURE,
  WELLBEING_RESPONSE_POSITIONS,
} from "../../data/wellbeing-items.ts";
import {
  compareToPrevious,
  computeWellbeingResult,
  DEFAULT_SCREENING_THRESHOLD,
  isAtOrAboveThreshold,
  resolveThreshold,
  WELLBEING_MAX_LIKERT_SCORE,
  WELLBEING_MAX_SCORE,
  WELLBEING_SCORING_METHOD,
  WELLBEING_SCORING_VERSION,
  WellbeingScoringError,
} from "./wellbeing.ts";

const ITEM_IDS = WELLBEING_ITEM_STRUCTURE.map((item) => item.externalId);

/** Every item answered at the same response position. */
const allAt = (position: number) => ITEM_IDS.map((itemId) => ({ itemId, position }));

/** Positions supplied per item, in administration order. */
const fromPositions = (positions: number[]) =>
  ITEM_IDS.map((itemId, index) => ({ itemId, position: positions[index]! }));

/* ── structure ──────────────────────────────────────────────────────── */

test("the questionnaire structure is twelve items of four ordered positions", () => {
  assert.equal(WELLBEING_ITEM_COUNT, 12);
  assert.equal(WELLBEING_RESPONSE_POSITIONS, 4);
  assert.equal(WELLBEING_ITEM_STRUCTURE.length, 12);
  assert.deepEqual(
    WELLBEING_ITEM_STRUCTURE.map((item) => item.position),
    Array.from({ length: 12 }, (_, index) => index),
  );
  assert.equal(new Set(ITEM_IDS).size, 12, "item ids are unique");
});

test("bimodal weights are 0-0-1-1 and likert weights are 0-1-2-3", () => {
  assert.deepEqual([...BIMODAL_WEIGHTS], [0, 0, 1, 1]);
  assert.deepEqual([...LIKERT_WEIGHTS], [0, 1, 2, 3]);
});

/* ── position → weight, for all twelve items ────────────────────────── */

test("position 1 scores 0 and position 2 scores 0, on every item", () => {
  for (const position of [0, 1]) {
    const result = computeWellbeingResult({ answers: allAt(position) });
    assert.equal(result.totalScore, 0, `position ${position + 1} contributes 0`);
  }
});

test("position 3 scores 1 and position 4 scores 1, on every item", () => {
  for (const position of [2, 3]) {
    const result = computeWellbeingResult({ answers: allAt(position) });
    assert.equal(result.totalScore, 12, `position ${position + 1} contributes 1`);
  }
});

test("each item contributes exactly one point, and no item is reverse-scored", () => {
  // One item at a time moved from position 1 (0) to position 4 (1).
  for (let index = 0; index < WELLBEING_ITEM_COUNT; index += 1) {
    const positions = new Array(WELLBEING_ITEM_COUNT).fill(0);
    positions[index] = 3;
    const result = computeWellbeingResult({ answers: fromPositions(positions) });
    assert.equal(
      result.totalScore,
      1,
      `item ${ITEM_IDS[index]} contributes 1 point at position 4 — a reversed item would score 0 here`,
    );
  }
});

/* ── totals ─────────────────────────────────────────────────────────── */

test("all first responses total 0", () => {
  assert.equal(computeWellbeingResult({ answers: allAt(0) }).totalScore, 0);
});

test("all fourth responses total 12", () => {
  const result = computeWellbeingResult({ answers: allAt(3) });
  assert.equal(result.totalScore, 12);
  assert.equal(result.totalScore, WELLBEING_MAX_SCORE);
});

test("the total never leaves 0–12 across every uniform response set", () => {
  for (let position = 0; position < WELLBEING_RESPONSE_POSITIONS; position += 1) {
    const { totalScore } = computeWellbeingResult({ answers: allAt(position) });
    assert.ok(totalScore >= 0 && totalScore <= 12, `position ${position} stays in range`);
  }
});

test("a mixed response set counts only positions 3 and 4", () => {
  //         item: 1  2  3  4  5  6  7  8  9 10 11 12
  const positions = [0, 1, 2, 3, 0, 1, 2, 3, 0, 0, 2, 3];
  const result = computeWellbeingResult({ answers: fromPositions(positions) });
  assert.equal(result.totalScore, 6);
  assert.deepEqual(result.itemPositions, positions);
});

/* ── secondary Likert measure ───────────────────────────────────────── */

test("the Likert measure runs 0–36 and is independent of the 0–12 total", () => {
  assert.equal(computeWellbeingResult({ answers: allAt(0) }).likertScore, 0);
  assert.equal(computeWellbeingResult({ answers: allAt(1) }).likertScore, 12);
  assert.equal(computeWellbeingResult({ answers: allAt(2) }).likertScore, 24);
  assert.equal(computeWellbeingResult({ answers: allAt(3) }).likertScore, 36);
  assert.equal(WELLBEING_MAX_LIKERT_SCORE, 36);
});

test("position 2 separates the two scales — 0 bimodal, 12 Likert", () => {
  const result = computeWellbeingResult({ answers: allAt(1) });
  assert.equal(result.totalScore, 0, "second position never counts toward screening");
  assert.equal(result.likertScore, 12, "but it does carry continuous signal");
});

/* ── threshold ──────────────────────────────────────────────────────── */

test("the default threshold is 4 — the 3/4 cut-off", () => {
  assert.equal(DEFAULT_SCREENING_THRESHOLD, 4);
});

test("score 3 is below the default threshold and score 4 is at or above it", () => {
  const three = computeWellbeingResult({ answers: fromPositions([3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]) });
  assert.equal(three.totalScore, 3);
  assert.equal(three.atOrAboveThreshold, false);

  const four = computeWellbeingResult({ answers: fromPositions([3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0]) });
  assert.equal(four.totalScore, 4);
  assert.equal(four.atOrAboveThreshold, true);
});

test("every score is classified against the threshold stored with it", () => {
  for (let score = 0; score <= 12; score += 1) {
    assert.equal(isAtOrAboveThreshold(score, 4), score >= 4);
  }
});

test("a configured threshold is honoured and stamped onto the result", () => {
  const answers = fromPositions([3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0]);
  const strict = computeWellbeingResult({ answers, threshold: 6 });
  assert.equal(strict.totalScore, 4);
  assert.equal(strict.thresholdAtCompletion, 6);
  assert.equal(strict.atOrAboveThreshold, false, "same score, different configured policy");

  const lenient = computeWellbeingResult({ answers, threshold: 2 });
  assert.equal(lenient.thresholdAtCompletion, 2);
  assert.equal(lenient.atOrAboveThreshold, true);
});

test("a threshold outside 1–12 is refused rather than silently clamped", () => {
  assert.equal(resolveThreshold(undefined), 4);
  assert.equal(resolveThreshold(null), 4);
  assert.equal(resolveThreshold(1), 1);
  assert.equal(resolveThreshold(12), 12);
  for (const bad of [0, -1, 13, 4.5, Number.NaN]) {
    assert.throws(() => resolveThreshold(bad), WellbeingScoringError, `refuses ${bad}`);
  }
});

/* ── validation ─────────────────────────────────────────────────────── */

test("an incomplete answer set is an error, never a partial score", () => {
  assert.throws(
    () => computeWellbeingResult({ answers: allAt(3).slice(0, 11) }),
    (error: unknown) =>
      error instanceof WellbeingScoringError && error.code === "INCOMPLETE_ANSWERS",
  );
});

test("a duplicated item is rejected", () => {
  const answers = allAt(0);
  answers[5] = { itemId: ITEM_IDS[0]!, position: 3 };
  assert.throws(
    () => computeWellbeingResult({ answers }),
    (error: unknown) => error instanceof WellbeingScoringError && error.code === "DUPLICATE_ANSWER",
  );
});

test("an item outside the version is rejected", () => {
  const answers = allAt(0);
  answers[3] = { itemId: "item_99", position: 1 };
  assert.throws(
    () => computeWellbeingResult({ answers }),
    (error: unknown) => error instanceof WellbeingScoringError && error.code === "UNKNOWN_ITEM",
  );
});

test("a response position outside 0–3 is rejected", () => {
  for (const position of [-1, 4, 1.5, Number.NaN]) {
    const answers = allAt(0);
    answers[2] = { itemId: ITEM_IDS[2]!, position };
    assert.throws(
      () => computeWellbeingResult({ answers }),
      (error: unknown) =>
        error instanceof WellbeingScoringError && error.code === "INVALID_POSITION",
      `refuses position ${position}`,
    );
  }
});

/* ── version pinning ────────────────────────────────────────────────── */

test("every result carries its scoring method and version", () => {
  const result = computeWellbeingResult({ answers: allAt(2) });
  assert.equal(result.scoringMethod, "ghq_bimodal_0011");
  assert.equal(result.scoringVersion, WELLBEING_SCORING_VERSION);
});

test("SCORING FREEZE — the released contract is 1.0.0 / ghq_bimodal_0011", () => {
  // Golden values. If either changes, the change is either unintended and
  // must be reverted, or deliberate — in which case the version moves and
  // stored rows keep the version they were computed under. Never "update the
  // test to make it pass".
  assert.equal(WELLBEING_SCORING_METHOD, "ghq_bimodal_0011");
  assert.equal(WELLBEING_SCORING_VERSION, "1.0.0");
  assert.equal(computeWellbeingResult({ answers: allAt(0) }).totalScore, 0);
  assert.equal(computeWellbeingResult({ answers: allAt(1) }).totalScore, 0);
  assert.equal(computeWellbeingResult({ answers: allAt(2) }).totalScore, 12);
  assert.equal(computeWellbeingResult({ answers: allAt(3) }).totalScore, 12);
  assert.equal(
    computeWellbeingResult({ answers: fromPositions([0, 1, 2, 3, 3, 2, 1, 0, 0, 3, 2, 1]) })
      .totalScore,
    6,
  );
});

test("a historical version's own item order re-reads its result unchanged", () => {
  const historical = [...ITEM_IDS].reverse();
  const answers = historical.map((itemId, index) => ({ itemId, position: index % 4 }));
  const result = computeWellbeingResult({ answers, itemOrder: historical });
  assert.equal(result.itemPositions.length, 12);
  // Positions are indexed by the version's own order, not today's.
  assert.deepEqual(result.itemPositions, [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]);
});

/* ── movement language ──────────────────────────────────────────────── */

test("movement is direction plus a number, and 'similar' means unchanged", () => {
  assert.deepEqual(compareToPrevious(2, 5), { movement: "lower", delta: -3, current: 2, previous: 5 });
  assert.deepEqual(compareToPrevious(5, 2), { movement: "higher", delta: 3, current: 5, previous: 2 });
  assert.deepEqual(compareToPrevious(3, 3), { movement: "similar", delta: 0, current: 3, previous: 3 });
});

test("a one-point movement is reported in its own direction, never rounded to 'similar'", () => {
  assert.equal(compareToPrevious(4, 3).movement, "higher");
  assert.equal(compareToPrevious(3, 4).movement, "lower");
});
