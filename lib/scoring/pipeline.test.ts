import assert from "node:assert/strict";
import { test } from "node:test";
import { discQuestions } from "../../data/disc-questions.ts";
import {
  computeNet,
  computeRawScores,
  normalizeScores,
  ScoringError,
  type AnswerInput,
} from "./pipeline.ts";
import type { Dimension } from "../types/index.ts";

const optionOf = (questionIndex: number, dimension: Dimension): string => {
  const question = discQuestions[questionIndex];
  assert.ok(question, `question ${questionIndex} exists`);
  const option = question.options.find((o) => o.dimension === dimension);
  assert.ok(option, `question ${questionIndex} has a ${dimension} option`);
  return option.id;
};

/** Answer every question MOST=most, LEAST=least. */
const uniformAnswers = (most: Dimension, least: Dimension): AnswerInput[] =>
  discQuestions.map((question, index) => ({
    questionId: question.id,
    mostOptionId: optionOf(index, most),
    leastOptionId: optionOf(index, least),
  }));

test("question bank integrity: 24 groups, one option per dimension each", () => {
  assert.equal(discQuestions.length, 24);
  for (const question of discQuestions) {
    assert.equal(question.options.length, 4);
    const dims = new Set(question.options.map((o) => o.dimension));
    assert.deepEqual([...dims].sort(), ["C", "D", "I", "S"]);
    const ids = new Set(question.options.map((o) => o.id));
    assert.equal(ids.size, 4);
  }
});

test("raw tallies count MOST and LEAST per dimension", () => {
  const raw = computeRawScores(uniformAnswers("D", "S"), discQuestions);
  assert.deepEqual(raw.most, { d: 24, i: 0, s: 0, c: 0 });
  assert.deepEqual(raw.least, { d: 0, i: 0, s: 24, c: 0 });
});

test("net = most − least", () => {
  const raw = computeRawScores(uniformAnswers("D", "S"), discQuestions);
  const net = computeNet(raw);
  assert.deepEqual(net, { d: 24, i: 0, s: -24, c: 0 });
});

test("normalization bounds: all-most → 100, all-least → 0, untouched → 50", () => {
  const raw = computeRawScores(uniformAnswers("D", "S"), discQuestions);
  const normalized = normalizeScores(computeNet(raw), discQuestions.length);
  assert.equal(normalized.d, 100);
  assert.equal(normalized.s, 0);
  assert.equal(normalized.i, 50);
  assert.equal(normalized.c, 50);
});

test("normalization clamps and rounds intermediate values", () => {
  // net +6 on 24 questions → (6+24)/48*100 = 62.5 → 63
  assert.deepEqual(
    normalizeScores({ d: 6, i: 0, s: -6, c: 0 }, 24),
    { d: 63, i: 50, s: 38, c: 50 },
  );
});

test("rejects incomplete answer sets", () => {
  const answers = uniformAnswers("D", "S").slice(0, 23);
  assert.throws(
    () => computeRawScores(answers, discQuestions),
    (error: unknown) =>
      error instanceof ScoringError && error.code === "INCOMPLETE_ANSWERS",
  );
});

test("rejects MOST === LEAST", () => {
  const answers = uniformAnswers("D", "S");
  const first = answers[0];
  assert.ok(first);
  first.leastOptionId = first.mostOptionId;
  assert.throws(
    () => computeRawScores(answers, discQuestions),
    (error: unknown) =>
      error instanceof ScoringError && error.code === "SAME_OPTION",
  );
});

test("rejects options from another question", () => {
  const answers = uniformAnswers("D", "S");
  const first = answers[0];
  assert.ok(first);
  first.mostOptionId = optionOf(1, "D");
  assert.throws(
    () => computeRawScores(answers, discQuestions),
    (error: unknown) =>
      error instanceof ScoringError && error.code === "OPTION_MISMATCH",
  );
});

test("rejects duplicate answers for one question", () => {
  const answers = uniformAnswers("D", "S");
  const second = answers[1];
  assert.ok(second);
  answers[1] = {
    questionId: discQuestions[0]!.id,
    mostOptionId: optionOf(0, "I"),
    leastOptionId: optionOf(0, "C"),
  };
  assert.throws(
    () => computeRawScores(answers, discQuestions),
    (error: unknown) =>
      error instanceof ScoringError && error.code === "DUPLICATE_ANSWER",
  );
});
