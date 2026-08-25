import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DISC360_WELLBEING_DIMENSIONS,
  DISC360_WELLBEING_ITEMS,
  DISC360_WELLBEING_OPTIONS,
  itemsForDimension,
  type DimensionKey,
} from "../../data/disc360-wellbeing-items.ts";
import {
  compareIndex,
  computeDiscWellbeingResult,
  DIMENSION_MAX_RAW,
  DISC_WELLBEING_MAX_RAW,
  DISC_WELLBEING_SCORING_METHOD,
  DISC_WELLBEING_SCORING_VERSION,
  DiscWellbeingScoringError,
  rankDimensions,
  roundIndex,
  toIndex,
} from "./disc360-wellbeing.ts";

const ITEM_IDS = DISC360_WELLBEING_ITEMS.map((item) => item.externalId);

const allAt = (position: number) => ITEM_IDS.map((itemId) => ({ itemId, position }));
const fromPositions = (positions: number[]) =>
  ITEM_IDS.map((itemId, index) => ({ itemId, position: positions[index]! }));
const dimensionOf = (result: ReturnType<typeof computeDiscWellbeingResult>, key: DimensionKey) =>
  result.dimensions.find((dimension) => dimension.key === key)!;

/* ── instrument shape ───────────────────────────────────────────────── */

test("V1 is twelve items of five ordered responses across six dimensions", () => {
  assert.equal(DISC360_WELLBEING_ITEMS.length, 12);
  assert.equal(DISC360_WELLBEING_OPTIONS.length, 5);
  assert.equal(DISC360_WELLBEING_DIMENSIONS.length, 6);
  assert.equal(new Set(ITEM_IDS).size, 12, "item ids are unique");
  assert.deepEqual(
    DISC360_WELLBEING_ITEMS.map((item) => item.position),
    Array.from({ length: 12 }, (_, index) => index),
  );
});

test("response options are Never → Almost always, scored 0-1-2-3-4", () => {
  assert.deepEqual(
    DISC360_WELLBEING_OPTIONS.map((option) => option.label),
    ["Never", "Rarely", "Sometimes", "Often", "Almost always"],
  );
  assert.deepEqual(DISC360_WELLBEING_OPTIONS.map((option) => option.points), [0, 1, 2, 3, 4]);
});

test("every dimension holds exactly two items, and every item has a dimension", () => {
  for (const dimension of DISC360_WELLBEING_DIMENSIONS) {
    assert.equal(
      itemsForDimension(dimension.key).length,
      2,
      `${dimension.key} must hold exactly two items`,
    );
  }
  const mapped = DISC360_WELLBEING_DIMENSIONS.flatMap((d) => itemsForDimension(d.key));
  assert.equal(mapped.length, 12, "all twelve items are mapped, none twice");
});

test("the documented dimension mapping is exactly what ships", () => {
  const byDimension = Object.fromEntries(
    DISC360_WELLBEING_DIMENSIONS.map((dimension) => [
      dimension.key,
      itemsForDimension(dimension.key).map((item) => item.facet),
    ]),
  );
  assert.deepEqual(byDimension, {
    capacity: ["Focus", "Energy"],
    recovery_demand: ["Recovery", "Workload"],
    emotional_resilience: ["Emotional Balance", "Coping"],
    connection_safety: ["Connection", "Psychological Safety"],
    purpose_confidence: ["Purpose", "Confidence"],
    everyday_wellbeing: ["Positive Experience", "Overall Wellbeing"],
  });
});

/* ── primary score ──────────────────────────────────────────────────── */

test("all Never = 0 raw and index 0", () => {
  const result = computeDiscWellbeingResult({ answers: allAt(0) });
  assert.equal(result.rawScore, 0);
  assert.equal(result.wellbeingIndex, 0);
});

test("all Almost always = 48 raw and index 100", () => {
  const result = computeDiscWellbeingResult({ answers: allAt(4) });
  assert.equal(result.rawScore, 48);
  assert.equal(result.rawScore, DISC_WELLBEING_MAX_RAW);
  assert.equal(result.wellbeingIndex, 100);
});

test("all Sometimes = 24 raw and index 50 — the exact midpoint", () => {
  const result = computeDiscWellbeingResult({ answers: allAt(2) });
  assert.equal(result.rawScore, 24);
  assert.equal(result.wellbeingIndex, 50);
});

test("each response position contributes its own point value, on every item", () => {
  for (let index = 0; index < 12; index += 1) {
    for (let position = 0; position <= 4; position += 1) {
      const positions = new Array(12).fill(0);
      positions[index] = position;
      const result = computeDiscWellbeingResult({ answers: fromPositions(positions) });
      assert.equal(
        result.rawScore,
        position,
        `item ${ITEM_IDS[index]} at position ${position} contributes ${position} — no item is reversed`,
      );
    }
  }
});

test("a known mixed vector scores exactly", () => {
  //          focus rec ene wkl emo cop con pur cnf pos psy ovr
  const positions = [4, 2, 3, 1, 3, 2, 4, 3, 2, 3, 4, 3];
  const result = computeDiscWellbeingResult({ answers: fromPositions(positions) });
  assert.equal(result.rawScore, 34);
  assert.equal(result.wellbeingIndex, 71, "(34/48)*100 = 70.83… → 71");
  assert.deepEqual(result.itemPositions, positions);
});

test("the index never leaves 0–100 across every uniform response set", () => {
  for (let position = 0; position <= 4; position += 1) {
    const { wellbeingIndex } = computeDiscWellbeingResult({ answers: allAt(position) });
    assert.ok(wellbeingIndex >= 0 && wellbeingIndex <= 100);
  }
});

/* ── rounding ───────────────────────────────────────────────────────── */

test("one documented rounding rule, applied everywhere", () => {
  assert.equal(roundIndex(70.83), 71);
  assert.equal(roundIndex(70.4), 70);
  assert.equal(roundIndex(70.5), 71, "half rounds up");
  assert.equal(toIndex(34, 48), 71);
  assert.equal(toIndex(0, 48), 0);
  assert.equal(toIndex(48, 48), 100);
  assert.equal(toIndex(5, 8), 63, "(5/8)*100 = 62.5 → 63");
  assert.equal(toIndex(1, 0), 0, "no division by zero");
});

test("the index and the dimensions round by the same rule", () => {
  // Both go through toIndex, so a half value resolves identically.
  const positions = [3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
  const result = computeDiscWellbeingResult({ answers: fromPositions(positions) });
  assert.equal(result.rawScore, 25);
  assert.equal(result.wellbeingIndex, toIndex(25, 48));
  for (const dimension of result.dimensions) {
    assert.equal(dimension.index, toIndex(dimension.raw, DIMENSION_MAX_RAW));
  }
});

/* ── dimensions ─────────────────────────────────────────────────────── */

test("each dimension runs 0–8 raw and normalizes to 0–100", () => {
  const low = computeDiscWellbeingResult({ answers: allAt(0) });
  const high = computeDiscWellbeingResult({ answers: allAt(4) });
  assert.equal(DIMENSION_MAX_RAW, 8);
  for (const dimension of low.dimensions) {
    assert.equal(dimension.raw, 0);
    assert.equal(dimension.index, 0);
  }
  for (const dimension of high.dimensions) {
    assert.equal(dimension.raw, 8);
    assert.equal(dimension.index, 100);
  }
});

test("a dimension reflects only its own two items", () => {
  // Capacity = Focus (index 0) + Energy (index 2). Max them, floor everything else.
  const positions = new Array(12).fill(0);
  positions[0] = 4;
  positions[2] = 4;
  const result = computeDiscWellbeingResult({ answers: fromPositions(positions) });

  assert.equal(dimensionOf(result, "capacity").raw, 8);
  assert.equal(dimensionOf(result, "capacity").index, 100);
  for (const key of [
    "recovery_demand",
    "emotional_resilience",
    "connection_safety",
    "purpose_confidence",
    "everyday_wellbeing",
  ] as DimensionKey[]) {
    assert.equal(dimensionOf(result, key).raw, 0, `${key} is untouched`);
  }
  assert.equal(result.rawScore, 8);
});

test("Connection & Safety pairs Connection with Psychological Safety, not adjacent items", () => {
  // Items 6 (Connection) and 10 (Psychological Safety) are NOT adjacent — a
  // naive pair-by-position mapping would get this wrong.
  const positions = new Array(12).fill(0);
  positions[6] = 4;
  positions[10] = 3;
  const result = computeDiscWellbeingResult({ answers: fromPositions(positions) });
  assert.equal(dimensionOf(result, "connection_safety").raw, 7);
  assert.equal(dimensionOf(result, "purpose_confidence").raw, 0);
  assert.equal(dimensionOf(result, "everyday_wellbeing").raw, 0);
});

test("dimension raws always sum to the overall raw", () => {
  for (const positions of [
    [0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1],
    [4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  ]) {
    const result = computeDiscWellbeingResult({ answers: fromPositions(positions) });
    const summed = result.dimensions.reduce((total, dimension) => total + dimension.raw, 0);
    assert.equal(summed, result.rawScore, `dimensions must account for every point`);
  }
});

test("dimensions are returned in the declared display order", () => {
  const result = computeDiscWellbeingResult({ answers: allAt(2) });
  assert.deepEqual(
    result.dimensions.map((dimension) => dimension.key),
    DISC360_WELLBEING_DIMENSIONS.map((dimension) => dimension.key),
  );
});

test("ranking orders by index and breaks ties by display order", () => {
  const positions = new Array(12).fill(2);
  positions[6] = 4; // Connection
  positions[10] = 4; // Psychological Safety → connection_safety highest
  const result = computeDiscWellbeingResult({ answers: fromPositions(positions) });
  const ranked = rankDimensions(result.dimensions);
  assert.equal(ranked[0]!.key, "connection_safety");
  // The remaining five are all tied at 50 and keep declared order.
  assert.deepEqual(ranked.slice(1).map((dimension) => dimension.key), [
    "capacity",
    "recovery_demand",
    "emotional_resilience",
    "purpose_confidence",
    "everyday_wellbeing",
  ]);
});

/* ── validation ─────────────────────────────────────────────────────── */

test("an incomplete answer set is an error, never a partial index", () => {
  assert.throws(
    () => computeDiscWellbeingResult({ answers: allAt(4).slice(0, 11) }),
    (error: unknown) =>
      error instanceof DiscWellbeingScoringError && error.code === "INCOMPLETE_ANSWERS",
  );
});

test("a duplicated item is rejected", () => {
  const answers = allAt(2);
  answers[5] = { itemId: ITEM_IDS[0]!, position: 4 };
  assert.throws(
    () => computeDiscWellbeingResult({ answers }),
    (error: unknown) =>
      error instanceof DiscWellbeingScoringError && error.code === "DUPLICATE_ANSWER",
  );
});

test("an item outside the version is rejected", () => {
  const answers = allAt(2);
  answers[3] = { itemId: "dw_not_a_real_item", position: 1 };
  assert.throws(
    () => computeDiscWellbeingResult({ answers }),
    (error: unknown) =>
      error instanceof DiscWellbeingScoringError && error.code === "UNKNOWN_ITEM",
  );
});

test("a GHQ item id is rejected — the engines do not accept each other's input", () => {
  const answers = allAt(2);
  answers[0] = { itemId: "item_01", position: 1 };
  assert.throws(
    () => computeDiscWellbeingResult({ answers }),
    (error: unknown) =>
      error instanceof DiscWellbeingScoringError && error.code === "UNKNOWN_ITEM",
  );
});

test("a response position outside 0–4 is rejected", () => {
  for (const position of [-1, 5, 2.5, Number.NaN]) {
    const answers = allAt(2);
    answers[2] = { itemId: ITEM_IDS[2]!, position };
    assert.throws(
      () => computeDiscWellbeingResult({ answers }),
      (error: unknown) =>
        error instanceof DiscWellbeingScoringError && error.code === "INVALID_POSITION",
      `refuses position ${position}`,
    );
  }
});

/* ── version pinning and freeze ─────────────────────────────────────── */

test("every result carries its instrument, method and versions", () => {
  const result = computeDiscWellbeingResult({ answers: allAt(3) });
  assert.equal(result.instrumentKey, "disc360_wellbeing_v1");
  assert.equal(result.scoringMethod, "disc360_wellbeing_sum_0_48");
  assert.equal(result.scoringVersion, "1.0.0");
  assert.equal(result.questionnaireVersion, 1);
});

test("SCORING FREEZE — DISC360 Wellbeing V1 golden values", () => {
  // Captured from the released engine. If any value changes, either the change
  // was unintended and must be reverted, or the contract is being versioned
  // deliberately — in which case scoring_version moves and stored results keep
  // the version they were computed under. Never "update the test to pass".
  assert.equal(DISC_WELLBEING_SCORING_METHOD, "disc360_wellbeing_sum_0_48");
  assert.equal(DISC_WELLBEING_SCORING_VERSION, "1.0.0");

  const golden: { positions: number[]; raw: number; index: number; dims: number[] }[] = [
    { positions: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], raw: 0, index: 0, dims: [0, 0, 0, 0, 0, 0] },
    { positions: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], raw: 48, index: 100, dims: [100, 100, 100, 100, 100, 100] },
    { positions: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], raw: 24, index: 50, dims: [50, 50, 50, 50, 50, 50] },
    { positions: [4, 2, 3, 1, 3, 2, 4, 3, 2, 3, 4, 3], raw: 34, index: 71, dims: [88, 38, 63, 100, 63, 75] },
    { positions: [1, 0, 2, 1, 3, 4, 2, 2, 1, 0, 3, 2], raw: 21, index: 44, dims: [38, 13, 88, 63, 38, 25] },
    { positions: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], raw: 36, index: 75, dims: [75, 75, 75, 75, 75, 75] },
  ];

  for (const entry of golden) {
    const result = computeDiscWellbeingResult({ answers: fromPositions(entry.positions) });
    assert.equal(result.rawScore, entry.raw, `raw for ${entry.positions.join("")}`);
    assert.equal(result.wellbeingIndex, entry.index, `index for ${entry.positions.join("")}`);
    assert.deepEqual(
      result.dimensions.map((dimension) => dimension.index),
      entry.dims,
      `dimensions for ${entry.positions.join("")}`,
    );
  }
});

test("a historical version's own item order re-reads its result unchanged", () => {
  const historical = [...ITEM_IDS].reverse();
  const answers = historical.map((itemId, index) => ({ itemId, position: index % 5 }));
  const result = computeDiscWellbeingResult({ answers, itemOrder: historical });
  assert.deepEqual(result.itemPositions, [0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1]);
  assert.equal(result.rawScore, 21);
});

/* ── movement ───────────────────────────────────────────────────────── */

test("movement is direction and a point count, and 'similar' means unchanged", () => {
  assert.deepEqual(compareIndex(76, 71), { movement: "higher", delta: 5, current: 76, previous: 71 });
  assert.deepEqual(compareIndex(63, 71), { movement: "lower", delta: -8, current: 63, previous: 71 });
  assert.deepEqual(compareIndex(71, 71), { movement: "similar", delta: 0, current: 71, previous: 71 });
});

test("a one-point movement keeps its own direction, never rounded to 'similar'", () => {
  assert.equal(compareIndex(72, 71).movement, "higher");
  assert.equal(compareIndex(70, 71).movement, "lower");
});

test("higher index means stronger wellbeing — the opposite direction to GHQ", () => {
  const strong = computeDiscWellbeingResult({ answers: allAt(4) });
  const weak = computeDiscWellbeingResult({ answers: allAt(0) });
  assert.ok(strong.wellbeingIndex > weak.wellbeingIndex);
  assert.equal(compareIndex(strong.wellbeingIndex, weak.wellbeingIndex).movement, "higher");
});
