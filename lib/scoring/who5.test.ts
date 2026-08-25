import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WHO5_ITEM_STRUCTURE,
  WHO5_POINTS_BY_POSITION,
  WHO5_RESPONSE_POSITIONS,
} from "../../data/who5-items.ts";
import {
  computeWho5Result,
  WHO5_MAX_SCORE,
  WHO5_RAW_MAX,
  WHO5_SCORING_METHOD,
  WHO5_SCORING_VERSION,
  WHO5_TRANSFORM_MULTIPLIER,
  Who5ScoringError,
} from "./who5.ts";

const ITEM_IDS = WHO5_ITEM_STRUCTURE.map((item) => item.externalId);
const allAt = (position: number) => ITEM_IDS.map((itemId) => ({ itemId, position }));
const fromPositions = (positions: number[]) =>
  ITEM_IDS.map((itemId, index) => ({ itemId, position: positions[index]! }));

/* ── structure ──────────────────────────────────────────────────────── */

test("WHO-5 is five items of six ordered positions scored 0–5", () => {
  assert.equal(WHO5_ITEM_STRUCTURE.length, 5);
  assert.equal(WHO5_RESPONSE_POSITIONS, 6);
  assert.deepEqual([...WHO5_POINTS_BY_POSITION], [0, 1, 2, 3, 4, 5]);
  assert.equal(WHO5_RAW_MAX, 25);
});

/* ── the official scoring ───────────────────────────────────────────── */

test("raw runs 0–25 and the transformed score is raw x 4", () => {
  assert.equal(WHO5_TRANSFORM_MULTIPLIER, 4);

  const floor = computeWho5Result({ answers: allAt(0) });
  assert.equal(floor.rawScore, 0);
  assert.equal(floor.transformedScore, 0);

  const ceiling = computeWho5Result({ answers: allAt(5) });
  assert.equal(ceiling.rawScore, 25);
  assert.equal(ceiling.transformedScore, 100);
  assert.equal(ceiling.transformedScore, WHO5_MAX_SCORE);
});

test("the transformation is exactly x4 at every raw value", () => {
  for (let position = 0; position <= 5; position += 1) {
    const result = computeWho5Result({ answers: allAt(position) });
    assert.equal(result.rawScore, position * 5);
    assert.equal(
      result.transformedScore,
      result.rawScore * 4,
      "WHO-5 uses its own documented x4, not a (raw/max)*100 normalisation",
    );
  }
});

test("a known mixed vector scores exactly", () => {
  const result = computeWho5Result({ answers: fromPositions([5, 4, 3, 2, 4]) });
  assert.equal(result.rawScore, 18);
  assert.equal(result.transformedScore, 72);
  assert.deepEqual(result.itemPositions, [5, 4, 3, 2, 4]);
});

test("higher means stronger reported wellbeing — no item is reversed", () => {
  for (let index = 0; index < 5; index += 1) {
    const positions = new Array(5).fill(0);
    positions[index] = 5;
    const result = computeWho5Result({ answers: fromPositions(positions) });
    assert.equal(result.rawScore, 5, `item ${ITEM_IDS[index]} contributes its own points`);
  }
});

test("the transformed score never leaves 0–100", () => {
  for (let position = 0; position <= 5; position += 1) {
    const { transformedScore } = computeWho5Result({ answers: allAt(position) });
    assert.ok(transformedScore >= 0 && transformedScore <= 100);
  }
});

/* ── validation ─────────────────────────────────────────────────────── */

test("incomplete, duplicate, unknown and out-of-range answers are refused", () => {
  assert.throws(
    () => computeWho5Result({ answers: allAt(3).slice(0, 4) }),
    (error: unknown) => error instanceof Who5ScoringError && error.code === "INCOMPLETE_ANSWERS",
  );

  const duplicate = allAt(2);
  duplicate[3] = { itemId: ITEM_IDS[0]!, position: 5 };
  assert.throws(
    () => computeWho5Result({ answers: duplicate }),
    (error: unknown) => error instanceof Who5ScoringError && error.code === "DUPLICATE_ANSWER",
  );

  const unknown = allAt(2);
  unknown[1] = { itemId: "who5_item_09", position: 1 };
  assert.throws(
    () => computeWho5Result({ answers: unknown }),
    (error: unknown) => error instanceof Who5ScoringError && error.code === "UNKNOWN_ITEM",
  );

  for (const position of [-1, 6, 2.5, Number.NaN]) {
    const answers = allAt(2);
    answers[0] = { itemId: ITEM_IDS[0]!, position };
    assert.throws(
      () => computeWho5Result({ answers }),
      (error: unknown) => error instanceof Who5ScoringError && error.code === "INVALID_POSITION",
    );
  }
});

test("a GHQ or DISC360 item id is rejected", () => {
  for (const foreign of ["item_01", "ghq28_item_01", "dw_focus"]) {
    const answers = allAt(2);
    answers[0] = { itemId: foreign, position: 1 };
    assert.throws(
      () => computeWho5Result({ answers }),
      (error: unknown) => error instanceof Who5ScoringError && error.code === "UNKNOWN_ITEM",
      `must reject ${foreign}`,
    );
  }
});

/* ── freeze ─────────────────────────────────────────────────────────── */

test("SCORING FREEZE — WHO-5 golden values", () => {
  assert.equal(WHO5_SCORING_METHOD, "who5_sum_x4");
  assert.equal(WHO5_SCORING_VERSION, "1.0.0");

  const golden: { positions: number[]; raw: number; transformed: number }[] = [
    { positions: [0, 0, 0, 0, 0], raw: 0, transformed: 0 },
    { positions: [5, 5, 5, 5, 5], raw: 25, transformed: 100 },
    { positions: [3, 3, 3, 3, 3], raw: 15, transformed: 60 },
    { positions: [5, 4, 3, 2, 4], raw: 18, transformed: 72 },
    { positions: [1, 0, 2, 1, 0], raw: 4, transformed: 16 },
    { positions: [4, 4, 4, 5, 5], raw: 22, transformed: 88 },
  ];

  for (const entry of golden) {
    const result = computeWho5Result({ answers: fromPositions(entry.positions) });
    assert.equal(result.rawScore, entry.raw, `raw for ${entry.positions.join("")}`);
    assert.equal(
      result.transformedScore,
      entry.transformed,
      `transformed for ${entry.positions.join("")}`,
    );
  }
});

test("every result carries its instrument, method and version", () => {
  const result = computeWho5Result({ answers: allAt(4) });
  assert.equal(result.instrumentKey, "who5");
  assert.equal(result.scoringMethod, "who5_sum_x4");
  assert.equal(result.scoringVersion, "1.0.0");
});

test("WHO-5 produces no threshold, band or classification", () => {
  const result = computeWho5Result({ answers: allAt(1) });
  assert.deepEqual(Object.keys(result).sort(), [
    "instrumentKey",
    "itemPositions",
    "rawScore",
    "scoringMethod",
    "scoringVersion",
    "transformedScore",
  ]);
});

/* ── not the same 0–100 as DISC360 ──────────────────────────────────── */

test("a WHO-5 of 72 and a Wellbeing Index of 72 are not the same measure", () => {
  // Both engines can output 72; nothing in either result lets them be treated
  // as one series, because each carries its own instrument key and method.
  const who5 = computeWho5Result({ answers: fromPositions([5, 4, 3, 2, 4]) });
  assert.equal(who5.transformedScore, 72);
  assert.equal(who5.instrumentKey, "who5");
  assert.equal(who5.scoringMethod, "who5_sum_x4");
  // The DISC360 engine is not even imported here — see the isolation suite.
});
