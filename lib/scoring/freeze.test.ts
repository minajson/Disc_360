import assert from "node:assert/strict";
import { test } from "node:test";
import { discQuestions } from "../../data/disc-questions.ts";
import { focusQuestions } from "../../data/focus-questions.ts";
import { computeResult } from "./compute-result.ts";
import { computeFocusResult } from "./focus.ts";
import type { Dimension } from "../types/index.ts";

/**
 * Scoring freeze.
 *
 * These are golden values captured from the released engines at commit
 * 79352a4, before the Phase 2 history work. They exist so any change to
 * scoring — deliberate or accidental — fails loudly rather than silently
 * re-scoring every historical result.
 *
 * Nothing here should ever be "updated to make the test pass". If a value
 * changes, either the change was unintended and must be reverted, or the
 * scoring contract is being versioned deliberately — in which case
 * `scoring_version` moves and stored results keep the version they were
 * computed under.
 */

const CREATED_AT = "2026-01-01T00:00:00.000Z";

/** The option carrying `dim`, else a deterministic fallback. */
function pick(question: (typeof discQuestions)[number], dim: Dimension, fallback: number) {
  return (
    question.options.find((option) => option.dimension === dim) ??
    question.options[fallback % question.options.length]!
  );
}

function scoreDisc(most: Dimension, least: Dimension) {
  const answers = discQuestions.map((question, index) => {
    const mostOption = pick(question, most, index);
    let leastOption = pick(question, least, index + 1);
    if (leastOption.id === mostOption.id) {
      leastOption = question.options.find((option) => option.id !== mostOption.id)!;
    }
    return {
      questionId: question.id,
      mostOptionId: mostOption.id,
      leastOptionId: leastOption.id,
    };
  });
  return computeResult({
    resultId: "r",
    sessionId: "s",
    userId: "u",
    answers,
    questions: discQuestions,
    createdAt: CREATED_AT,
  });
}

/* ── DISC ───────────────────────────────────────────────────────────── */

const DISC_GOLDEN = {
  "pure-D": {
    most: "D" as Dimension,
    least: "S" as Dimension,
    rawMost: { d: 24, i: 0, s: 0, c: 0 },
    rawLeast: { d: 0, i: 0, s: 24, c: 0 },
    net: { d: 24, i: 0, s: -24, c: 0 },
    normalized: { d: 100, i: 50, s: 0, c: 50 },
    distribution: { d: 50, i: 25, s: 0, c: 25 },
    archetypeCode: "D",
    hybridType: "DI",
    primaryDimension: "D",
    secondaryDimension: null,
    intensity: { D: "VERY_HIGH", I: "MODERATE", S: "LOW", C: "MODERATE" },
  },
  "pure-I": {
    most: "I" as Dimension,
    least: "C" as Dimension,
    rawMost: { d: 0, i: 24, s: 0, c: 0 },
    rawLeast: { d: 0, i: 0, s: 0, c: 24 },
    net: { d: 0, i: 24, s: 0, c: -24 },
    normalized: { d: 50, i: 100, s: 50, c: 0 },
    distribution: { d: 25, i: 50, s: 25, c: 0 },
    archetypeCode: "I",
    hybridType: "ID",
    primaryDimension: "I",
    secondaryDimension: null,
    intensity: { D: "MODERATE", I: "VERY_HIGH", S: "MODERATE", C: "LOW" },
  },
  "pure-S": {
    most: "S" as Dimension,
    least: "D" as Dimension,
    rawMost: { d: 0, i: 0, s: 24, c: 0 },
    rawLeast: { d: 24, i: 0, s: 0, c: 0 },
    net: { d: -24, i: 0, s: 24, c: 0 },
    normalized: { d: 0, i: 50, s: 100, c: 50 },
    distribution: { d: 0, i: 25, s: 50, c: 25 },
    archetypeCode: "S",
    hybridType: "SI",
    primaryDimension: "S",
    secondaryDimension: null,
    intensity: { D: "LOW", I: "MODERATE", S: "VERY_HIGH", C: "MODERATE" },
  },
  "pure-A": {
    most: "C" as Dimension,
    least: "I" as Dimension,
    rawMost: { d: 0, i: 0, s: 0, c: 24 },
    rawLeast: { d: 0, i: 24, s: 0, c: 0 },
    net: { d: 0, i: -24, s: 0, c: 24 },
    normalized: { d: 50, i: 0, s: 50, c: 100 },
    distribution: { d: 25, i: 0, s: 25, c: 50 },
    archetypeCode: "C",
    hybridType: "AD",
    primaryDimension: "C",
    secondaryDimension: null,
    intensity: { D: "MODERATE", I: "LOW", S: "MODERATE", C: "VERY_HIGH" },
  },
} as const;

for (const [name, golden] of Object.entries(DISC_GOLDEN)) {
  test(`DISC scoring is frozen — ${name}`, () => {
    const result = scoreDisc(golden.most, golden.least);
    assert.deepEqual(result.rawMost, golden.rawMost, "rawMost");
    assert.deepEqual(result.rawLeast, golden.rawLeast, "rawLeast");
    assert.deepEqual(result.net, golden.net, "net");
    assert.deepEqual(result.normalized, golden.normalized, "normalized");
    assert.deepEqual(result.distribution, golden.distribution, "distribution");
    assert.equal(result.archetypeCode, golden.archetypeCode, "archetypeCode");
    assert.equal(result.hybridType, golden.hybridType, "hybridType");
    assert.equal(result.primaryDimension, golden.primaryDimension, "primaryDimension");
    assert.equal(result.secondaryDimension, golden.secondaryDimension, "secondaryDimension");
    assert.deepEqual(result.intensity, golden.intensity, "intensity");
  });
}

test("DISC scoring is frozen — diagonal blend resolves to DC / displayed DA", () => {
  const answers = discQuestions.map((question, index) => {
    const dim: Dimension = index % 2 === 0 ? "D" : "C";
    const anti: Dimension = index % 2 === 0 ? "I" : "S";
    const mostOption = pick(question, dim, index);
    let leastOption = pick(question, anti, index + 1);
    if (leastOption.id === mostOption.id) {
      leastOption = question.options.find((option) => option.id !== mostOption.id)!;
    }
    return {
      questionId: question.id,
      mostOptionId: mostOption.id,
      leastOptionId: leastOption.id,
    };
  });
  const result = computeResult({
    resultId: "r",
    sessionId: "s",
    userId: "u",
    answers,
    questions: discQuestions,
    createdAt: CREATED_AT,
  });

  assert.deepEqual(result.net, { d: 12, i: -12, s: -12, c: 12 });
  assert.deepEqual(result.normalized, { d: 75, i: 25, s: 25, c: 75 });
  assert.deepEqual(result.distribution, { d: 38, i: 13, s: 12, c: 37 });
  assert.equal(result.archetypeCode, "DC");
  assert.equal(result.hybridType, "DA");
  assert.equal(result.primaryDimension, "D");
  assert.equal(result.secondaryDimension, "C");
  assert.deepEqual(result.intensity, { D: "HIGH", I: "LOW", S: "LOW", C: "HIGH" });
});

test("the two DISC scales stay distinct and keep their invariants", () => {
  for (const golden of Object.values(DISC_GOLDEN)) {
    const result = scoreDisc(golden.most, golden.least);
    // distribution always totals exactly 100; normalized deliberately does not.
    const share = result.distribution.d + result.distribution.i + result.distribution.s + result.distribution.c;
    assert.equal(share, 100, "distribution totals 100");
    const intensity =
      result.normalized.d + result.normalized.i + result.normalized.s + result.normalized.c;
    assert.equal(intensity, 200, "normalized is intensity, not a share");
  }
});

/* ── Focus ──────────────────────────────────────────────────────────── */

function scoreFocus(offset: number) {
  const answers = focusQuestions.map((question, index) => {
    if (question.kind === "scale") {
      return { questionId: question.id, scaleValue: ((index + offset) % 10) + 1 };
    }
    const options = question.options ?? [];
    return { questionId: question.id, optionId: options[(index + offset) % options.length]!.id };
  });
  return computeFocusResult(answers as never);
}

const FOCUS_GOLDEN = [
  {
    offset: 0,
    scores: { automaticity: 7, distraction: 58, mentalLoad: 50, recovery: 80 },
    patternCode: "socially_stimulated",
    primaryLoop: "messages",
    notificationPattern: "batches",
    energyPattern: "evening",
    preferredReset: "movement",
  },
  {
    offset: 1,
    scores: { automaticity: 18, distraction: 30, mentalLoad: 52, recovery: 96 },
    patternCode: "quiet_deep_worker",
    primaryLoop: "movement",
    notificationPattern: "off",
    energyPattern: "steady",
    preferredReset: "quiet",
  },
  {
    offset: 2,
    scores: { automaticity: 67, distraction: 76, mentalLoad: 66, recovery: 64 },
    patternCode: "overloaded_switcher",
    primaryLoop: "easier",
    notificationPattern: "immediate",
    energyPattern: "morning",
    preferredReset: "priorities",
  },
] as const;

for (const golden of FOCUS_GOLDEN) {
  test(`Focus scoring is frozen — pattern ${golden.patternCode}`, () => {
    const result = scoreFocus(golden.offset);
    assert.deepEqual(result.scores, golden.scores, "scores");
    assert.equal(result.patternCode, golden.patternCode, "patternCode");
    assert.equal(result.primaryLoop, golden.primaryLoop, "primaryLoop");
    assert.equal(result.notificationPattern, golden.notificationPattern, "notificationPattern");
    assert.equal(result.energyPattern, golden.energyPattern, "energyPattern");
    assert.equal(result.preferredReset, golden.preferredReset, "preferredReset");
  });
}

/* ── Combined ───────────────────────────────────────────────────────── */

test("Combined is a composition of the two frozen engines, not a third scorer", () => {
  // The combined product pairs one DISC session with one Focus session; it
  // has no scoring of its own. Freezing both halves therefore freezes it.
  const disc = scoreDisc("D", "S");
  const focus = scoreFocus(0);
  assert.equal(disc.archetypeCode, "D");
  assert.equal(focus.patternCode, "socially_stimulated");
});

/* ── question banks ─────────────────────────────────────────────────── */

test("the question banks are unchanged in shape", () => {
  // A silently added or reordered question would move every score above.
  assert.equal(discQuestions.length, 24);
  assert.ok(discQuestions.every((question) => question.options.length === 4));
  assert.ok(focusQuestions.length > 0);
});
