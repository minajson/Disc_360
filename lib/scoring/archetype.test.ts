import assert from "node:assert/strict";
import { test } from "node:test";
import { contrastingTendency, deriveArchetype, rankDimensions } from "./archetype.ts";
import type { DiscScores } from "../types/index.ts";

const scores = (d: number, i: number, s: number, c: number): DiscScores => ({
  d,
  i,
  s,
  c,
});

test("tie-break order is D → I → S → C", () => {
  assert.deepEqual(rankDimensions(scores(60, 60, 60, 60)), ["D", "I", "S", "C"]);
  assert.deepEqual(rankDimensions(scores(40, 70, 70, 40)), ["I", "S", "D", "C"]);
});

test("balanced when spread ≤ 12", () => {
  const result = deriveArchetype(scores(56, 50, 48, 44));
  assert.equal(result.code, "BAL");
  assert.equal(result.secondary, null);
});

test("spread of exactly 13 is not balanced", () => {
  const result = deriveArchetype(scores(57, 50, 48, 44));
  assert.notEqual(result.code, "BAL");
});

test("pure archetype at gap ≥ 15", () => {
  const result = deriveArchetype(scores(80, 65, 30, 40));
  assert.equal(result.code, "D");
  assert.equal(result.primary, "D");
  assert.equal(result.secondary, null);
});

test("pair archetype at gap of 14", () => {
  const result = deriveArchetype(scores(80, 66, 30, 40));
  assert.equal(result.code, "DI");
  assert.equal(result.primary, "D");
  assert.equal(result.secondary, "I");
});

test("all eight adjacent pairs derive correctly", () => {
  assert.equal(deriveArchetype(scores(80, 70, 20, 30)).code, "DI");
  assert.equal(deriveArchetype(scores(70, 80, 20, 30)).code, "ID");
  assert.equal(deriveArchetype(scores(20, 80, 70, 30)).code, "IS");
  assert.equal(deriveArchetype(scores(20, 70, 80, 30)).code, "SI");
  assert.equal(deriveArchetype(scores(20, 30, 80, 70)).code, "SC");
  assert.equal(deriveArchetype(scores(20, 30, 70, 80)).code, "CS");
  assert.equal(deriveArchetype(scores(70, 30, 20, 80)).code, "CD");
  assert.equal(deriveArchetype(scores(80, 30, 20, 70)).code, "DC");
});

test("diagonal D/S substitutes close third dimension", () => {
  // S is D's opposite; I sits 6 below S → substitute I.
  const result = deriveArchetype(scores(80, 64, 70, 20));
  assert.equal(result.code, "DI");
  assert.equal(result.secondary, "I");
});

test("diagonal I/C substitutes close third dimension", () => {
  // C is I's opposite; D sits 6 below C → substitute D.
  const result = deriveArchetype(scores(64, 80, 20, 70));
  assert.equal(result.code, "ID");
  assert.equal(result.secondary, "D");
});

test("diagonal with distant third falls back to pure primary", () => {
  // S opposite of D; third (I) is 12 below S — outside the 8-point window.
  const result = deriveArchetype(scores(80, 58, 70, 20));
  assert.equal(result.code, "D");
  assert.equal(result.secondary, null);
});

test("contrastingTendency: suppressed opposite within reach is surfaced", () => {
  // S 56 leads, D 54 is its opposite two behind, A 48 substitutes → SA.
  // The report must still be able to name the strong D tendency.
  const result = deriveArchetype(scores(54, 30, 56, 48));
  assert.equal(result.code, "SC");
  assert.equal(contrastingTendency(scores(54, 30, 56, 48)), "D");
});

test("contrastingTendency: pure fallback still names the opposite", () => {
  // D pure because the third dimension is beyond the window — D 80 / S 70.
  assert.equal(contrastingTendency(scores(80, 58, 70, 20)), "S");
});

test("contrastingTendency: null when second is not the opposite", () => {
  assert.equal(contrastingTendency(scores(80, 70, 30, 20)), null);
});

test("contrastingTendency: null when balanced or decisively pure", () => {
  assert.equal(contrastingTendency(scores(52, 50, 48, 50)), null);
  assert.equal(contrastingTendency(scores(90, 40, 60, 30)), null);
});
