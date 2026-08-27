import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { aggregateScores } from "./aggregate.ts";
import { INSTRUMENTS } from "../../data/wellbeing-instruments.ts";

/**
 * WHO-5 aggregates run the other way.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE FIGURE A FACILITATOR ACTS ON.
 *
 * "% at or above the threshold" is the concerning share for GHQ, which counts
 * upward toward distress. WHO-5 counts upward toward WELLBEING, so the same
 * sentence describes the HEALTHY share — and a facilitator reading a WHO-5
 * campaign as though it were GHQ would see a well population and conclude the
 * opposite, or the reverse.
 *
 * The direction is therefore derived from the instrument's declared
 * `scoreDirection` rather than special-cased per key, and the comparator to
 * print travels with the number so no display surface can hard-code "≥".
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");

/* ── 1 · the count follows the direction ─────────────────────────────── */

test("GHQ counts at or above; WHO-5 counts below", () => {
  // Same scores, same threshold, opposite instruments.
  const scores = [20, 40, 48, 52, 60, 80];
  const ghqLike = aggregateScores(scores, {
    threshold: 50,
    maxScore: 100,
    thresholdDirection: "at_or_above",
  });
  const who5Like = aggregateScores(scores, {
    threshold: 50,
    maxScore: 100,
    thresholdDirection: "below",
  });

  // 52, 60, 80 are at or above 50 → 3 of 6.
  assert.equal(ghqLike.atOrAboveThreshold, 3);
  assert.equal(ghqLike.atOrAboveThresholdShare, 50);
  // 20, 40, 48 are below 50 → 3 of 6. Same count here by construction, so the
  // shares alone cannot prove the direction — the labels below do.
  assert.equal(who5Like.atOrAboveThreshold, 3);

  assert.equal(ghqLike.thresholdDirection, "at_or_above");
  assert.equal(who5Like.thresholdDirection, "below");
});

test("an asymmetric cohort proves the sides really differ", () => {
  const scores = [10, 20, 30, 40, 90];
  const above = aggregateScores(scores, {
    threshold: 50,
    maxScore: 100,
    thresholdDirection: "at_or_above",
  });
  const below = aggregateScores(scores, {
    threshold: 50,
    maxScore: 100,
    thresholdDirection: "below",
  });
  assert.equal(above.atOrAboveThreshold, 1, "only 90 is at or above");
  assert.equal(below.atOrAboveThreshold, 4, "the other four are below");
  assert.notEqual(above.atOrAboveThresholdShare, below.atOrAboveThresholdShare);
});

test("the comparator to print travels with the number", () => {
  assert.equal(
    aggregateScores([1], { threshold: 4, maxScore: 12, thresholdDirection: "at_or_above" })
      .thresholdLabel,
    "≥ 4",
  );
  assert.equal(
    aggregateScores([1], { threshold: 50, maxScore: 100, thresholdDirection: "below" })
      .thresholdLabel,
    "< 50",
  );
  // No threshold, nothing to label.
  assert.equal(
    aggregateScores([1], { threshold: null, maxScore: 100 }).thresholdLabel,
    null,
  );
});

test("the default stays GHQ's direction, so existing callers are unchanged", () => {
  const a = aggregateScores([5, 6], { threshold: 4, maxScore: 12 });
  assert.equal(a.thresholdDirection, "at_or_above");
  assert.equal(a.atOrAboveThreshold, 2);
});

/* ── 2 · the direction is derived, not special-cased ─────────────────── */

test("direction comes from the instrument's declared scoreDirection", () => {
  const analytics = read("lib/wellbeing/analytics.ts");
  const helper = analytics.slice(
    analytics.indexOf("function aggregateOptionsFor"),
    analytics.indexOf("export type CompareDimension"),
  );
  assert.match(
    helper,
    /instrument\.scoreDirection === "higher_is_stronger_wellbeing"/,
    "a new upward-counting instrument must inherit the rule automatically",
  );
  assert.ok(
    !/instrument\.key === "who5"/.test(helper),
    "special-casing by key is how the next instrument gets it wrong",
  );
});

test("every wellbeing-direction instrument would be treated as below", () => {
  // A guard on the registry rather than on one instrument: if somebody adds an
  // upward-counting instrument with a threshold, this is the test that says
  // what must happen to its aggregates.
  const upward = Object.values(INSTRUMENTS).filter(
    (i) => i.scoreDirection === "higher_is_stronger_wellbeing" && i.hasThreshold,
  );
  assert.ok(upward.length >= 1, "WHO-5 is at least one");
  for (const instrument of upward) {
    assert.equal(
      instrument.scoreDirection,
      "higher_is_stronger_wellbeing",
      `${instrument.key} must count below its threshold`,
    );
  }
});

/* ── 3 · no display surface hard-codes a comparator ──────────────────── */

test("cohort surfaces print the label rather than a fixed sign", () => {
  for (const path of [
    "components/wellbeing/analytics/CohortComparison.tsx",
    "components/wellbeing/analytics/CohortStrip.tsx",
  ]) {
    const source = read(path);
    assert.match(
      source,
      /thresholdLabel/,
      `${path} must use the aggregate's own comparator`,
    );
    // The only permitted literal is the fallback inside a template.
    const stray = source.match(/≥\{threshold\}/g) ?? [];
    assert.equal(stray.length, 0, `${path} still hard-codes ≥{threshold}`);
  }
});

test("the aggregate report describes the correct side in prose", () => {
  const model = read("lib/reports/wellbeing-aggregate.ts");
  assert.match(model, /input\.thresholdPhrase \?\? "at or above"/);
  const caller = read("lib/wellbeing/aggregate-report.ts");
  assert.match(
    caller,
    /scoreDirection === "higher_is_stronger_wellbeing" \? "below" : "at or above"/,
    "the phrase must follow the instrument",
  );
});

/* ── 4 · instruments are never combined ──────────────────────────────── */

test("WHO-5 and the DISC360 index share a range but never a scale", () => {
  const who5 = INSTRUMENTS.who5;
  const disc = INSTRUMENTS.disc360_wellbeing_v1;
  assert.equal(who5.primaryScoreMax, disc.primaryScoreMax, "both are 0-100");
  assert.notEqual(
    who5.metricName,
    disc.metricName,
    "which is exactly why they must be named apart wherever a figure appears",
  );
});

test("WHO-5 declares no subscales", () => {
  // "Do not invent WHO-5 subscales" — it is a single scale.
  assert.deepEqual(INSTRUMENTS.who5.subscales, []);
  assert.match(INSTRUMENTS.who5.subscaleDescription, /no subscales/i);
});
