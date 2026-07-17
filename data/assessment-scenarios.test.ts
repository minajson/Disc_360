import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assessmentScenarios,
  SCENARIO_CATEGORIES,
  TOTAL_SCENARIOS,
  type Dimension,
} from "./assessment-scenarios.ts";

const DIMENSIONS: Dimension[] = ["D", "I", "S", "A"];

/**
 * Content contract for the question bank. These are the checks a human
 * reviewer would otherwise have to redo by eye every time a statement is
 * reworded, so they are enforced rather than documented.
 */

test("bank has 24 scenarios", () => {
  assert.equal(TOTAL_SCENARIOS, 24);
  assert.equal(assessmentScenarios.length, 24);
});

test("every scenario contains D, I, S and A exactly once", () => {
  for (const scenario of assessmentScenarios) {
    assert.equal(scenario.options.length, 4, `${scenario.id} has 4 options`);
    const dimensions = scenario.options.map((option) => option.dimension).sort();
    assert.deepEqual(
      dimensions,
      ["A", "D", "I", "S"],
      `${scenario.id} maps one option per dimension`,
    );
  }
});

test("no duplicate option ids anywhere in the bank", () => {
  const ids = assessmentScenarios.flatMap((scenario) =>
    scenario.options.map((option) => option.id),
  );
  assert.equal(ids.length, 96);
  assert.equal(new Set(ids).size, 96, "all 96 option ids are unique");
});

test("no duplicate scenario ids", () => {
  const ids = assessmentScenarios.map((scenario) => scenario.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("option ids never encode the dimension they score", () => {
  // An id like "s01-d" would hand the scoring key to anyone reading the DOM.
  for (const scenario of assessmentScenarios) {
    for (const option of scenario.options) {
      assert.match(
        option.id,
        /^s\d{2}-o[1-4]$/,
        `${option.id} is positional, not dimensional`,
      );
    }
  }
});

test("categories cover the 24 required themes, one per scenario, in order", () => {
  assert.equal(new Set(SCENARIO_CATEGORIES).size, 24, "themes are distinct");
  assessmentScenarios.forEach((scenario, index) => {
    assert.equal(scenario.category, SCENARIO_CATEGORIES[index]);
  });
});

test("display order is balanced: each dimension sits in each slot 6 times", () => {
  // Position must carry no signal a participant could learn mid-assessment.
  for (let slot = 0; slot < 4; slot += 1) {
    const counts = new Map<Dimension, number>(DIMENSIONS.map((d) => [d, 0]));
    for (const scenario of assessmentScenarios) {
      const dimension = scenario.options[slot]?.dimension;
      assert.ok(dimension);
      counts.set(dimension, (counts.get(dimension) ?? 0) + 1);
    }
    for (const dimension of DIMENSIONS) {
      assert.equal(
        counts.get(dimension),
        6,
        `dimension ${dimension} appears 6 times in slot ${slot}`,
      );
    }
  }
});

test("no scenario asks a trait question directly", () => {
  // "Are you confident?" measures self-image; we want behaviour in context.
  const traitPhrasing = /\b(are|do) you\b|\byour personality\b/i;
  for (const scenario of assessmentScenarios) {
    assert.doesNotMatch(
      scenario.prompt,
      traitPhrasing,
      `${scenario.id} is behavioural, not a trait question`,
    );
  }
});

test("no scenario leaks a dimension letter or label into visible copy", () => {
  const leak = /\b(dominant|influence|stable|analytical|DISC)\b/i;
  for (const scenario of assessmentScenarios) {
    assert.doesNotMatch(scenario.prompt, leak, `${scenario.id} prompt is clean`);
    for (const option of scenario.options) {
      assert.doesNotMatch(option.text, leak, `${option.id} text is clean`);
    }
  }
});

test("option texts are unique within and across scenarios", () => {
  const seen = new Map<string, string>();
  for (const scenario of assessmentScenarios) {
    const local = new Set<string>();
    for (const option of scenario.options) {
      const text = option.text.toLowerCase();
      assert.ok(!local.has(text), `${scenario.id} repeats "${option.text}"`);
      local.add(text);
      const previous = seen.get(text);
      assert.ok(
        !previous,
        `${option.id} duplicates ${previous ?? ""}: "${option.text}"`,
      );
      seen.set(text, option.id);
    }
  }
});

test("options within a scenario are comparable in length", () => {
  // A conspicuously short or long option biases selection regardless of
  // content, so the spread inside one scenario is capped.
  const MAX_SPREAD = 24;
  for (const scenario of assessmentScenarios) {
    const lengths = scenario.options.map((option) => option.text.length);
    const spread = Math.max(...lengths) - Math.min(...lengths);
    assert.ok(
      spread <= MAX_SPREAD,
      `${scenario.id} length spread ${spread} exceeds ${MAX_SPREAD} (${lengths.join("/")})`,
    );
  }
});

test("every option is a complete, plainly written sentence", () => {
  for (const scenario of assessmentScenarios) {
    assert.match(scenario.prompt, /:$/, `${scenario.id} prompt ends with a colon`);
    for (const option of scenario.options) {
      assert.match(option.text, /^[A-Z]/, `${option.id} starts capitalised`);
      assert.match(option.text, /\.$/, `${option.id} ends with a period`);
      assert.ok(option.text.length >= 25, `${option.id} is not a bare adjective`);
    }
  }
});

test("no option carries an obviously undesirable framing", () => {
  // Forced choice only works when refusing an option costs nothing socially.
  const loaded = /\b(sloppy|careless|lazy|weak|fail(?!ed\b)|stupid|bad|worst|incompetent|rude)\b/i;
  for (const scenario of assessmentScenarios) {
    for (const option of scenario.options) {
      assert.doesNotMatch(option.text, loaded, `${option.id} is neutral`);
    }
  }
});
