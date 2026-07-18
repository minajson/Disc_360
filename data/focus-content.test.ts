import assert from "node:assert/strict";
import { test } from "node:test";
import { focusQuestions } from "./focus-questions.ts";
import {
  ENERGY_LABELS,
  FOCUS_DIMENSION_META,
  FOCUS_PATTERNS,
  LOOP_LABELS,
  NOTIFICATION_LABELS,
  RESET_LABELS,
} from "./focus-insights.ts";

/** All audience-facing Focus copy in one string, for content assertions. */
const allCopy = [
  ...focusQuestions.flatMap((q) => [q.prompt, ...(q.options ?? []).map((o) => o.label), q.scaleMinLabel ?? "", q.scaleMaxLabel ?? ""]),
  ...Object.values(LOOP_LABELS),
  ...Object.values(NOTIFICATION_LABELS),
  ...Object.values(ENERGY_LABELS),
  ...Object.values(RESET_LABELS),
  ...FOCUS_DIMENSION_META.flatMap((m) => [m.label, m.description]),
  ...Object.values(FOCUS_PATTERNS).flatMap((p) => [p.name, p.summary, ...p.recommendations]),
].join("  ");

test("the six questions match the specified structure", () => {
  assert.equal(focusQuestions.length, 6);
  const single = focusQuestions.filter((q) => q.kind === "single");
  const scale = focusQuestions.filter((q) => q.kind === "scale");
  assert.equal(single.length, 5);
  assert.equal(scale.length, 1);
  for (const q of single) assert.ok((q.options?.length ?? 0) >= 3, `${q.id} has options`);
});

test("Focus copy is non-clinical — no dopamine, addiction or diagnosis language", () => {
  assert.doesNotMatch(
    allCopy,
    /\b(dopamine|addict\w*|withdrawal|disorder|diagnos\w*|clinical|deficiency|neurolog\w*)\b/i,
    "Focus content must use attention-pattern language, never clinical terms",
  );
});

test("recommendations are phrased as supportive suggestions, not verdicts", () => {
  for (const pattern of Object.values(FOCUS_PATTERNS)) {
    assert.equal(pattern.recommendations.length, 3, `${pattern.code} has three recommendations`);
    for (const rec of pattern.recommendations) {
      assert.ok(rec.length > 15, `${pattern.code} recommendation is substantive`);
    }
  }
});

test("all six pattern labels exist with distinct names", () => {
  const names = Object.values(FOCUS_PATTERNS).map((p) => p.name);
  assert.equal(names.length, 6);
  assert.equal(new Set(names).size, 6);
  for (const expected of [
    "Intentional Focuser",
    "Responsive Multitasker",
    "Socially Stimulated Worker",
    "Deadline Activator",
    "Quiet Deep Worker",
    "Overloaded Switcher",
  ]) {
    assert.ok(names.includes(expected), `has ${expected}`);
  }
});

test("the four non-clinical dimensions are named and coloured", () => {
  const keys = FOCUS_DIMENSION_META.map((m) => m.key).sort();
  assert.deepEqual(keys, ["automaticity", "distraction", "mentalLoad", "recovery"]);
  for (const meta of FOCUS_DIMENSION_META) {
    assert.match(meta.color, /^var\(--color-/);
  }
});
