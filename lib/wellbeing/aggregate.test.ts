import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aggregateScores,
  buildTrend,
  itemSignals,
  mean,
  median,
  type WavePoint,
} from "./aggregate.ts";

const wave = (key: string, at: string, scores: number[], threshold = 4, invited?: number): WavePoint => ({
  key,
  label: key,
  at,
  aggregate: aggregateScores(scores, { threshold, invited: invited ?? null }),
});

/* ── central measures ───────────────────────────────────────────────── */

test("median handles odd and even counts, and reports halves honestly", () => {
  assert.equal(median([1, 3, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([5]), 5);
  assert.equal(median([]), 0);
});

test("mean is available but is not the headline", () => {
  assert.equal(mean([0, 0, 0, 12]), 3);
  assert.equal(mean([1, 2]), 1.5);
});

test("median and mean diverge exactly where a single mean would mislead", () => {
  // Eleven people reporting nothing unusual, one reporting a great deal.
  const skewed = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12];
  const result = aggregateScores(skewed);
  assert.equal(result.median, 0, "the typical response is unchanged");
  assert.equal(result.mean, 1, "the mean alone would imply a mild general shift");
  assert.equal(result.atOrAboveThreshold, 1, "and the distribution shows the one person");
});

/* ── distribution ───────────────────────────────────────────────────── */

test("the distribution always spans 0–12 so the axis never moves", () => {
  const result = aggregateScores([4, 4, 7]);
  assert.equal(result.distribution.length, 13);
  assert.deepEqual(
    result.distribution.map((bucket) => bucket.score),
    Array.from({ length: 13 }, (_, index) => index),
  );
  assert.equal(result.distribution[4]!.count, 2);
  assert.equal(result.distribution[7]!.count, 1);
  assert.equal(result.distribution[0]!.count, 0);
});

test("each bucket knows which side of the threshold it sits on", () => {
  const result = aggregateScores([0, 5], { threshold: 4 });
  assert.deepEqual(
    result.distribution.filter((bucket) => bucket.atOrAboveThreshold).map((bucket) => bucket.score),
    [4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  const strict = aggregateScores([0, 5], { threshold: 6 });
  assert.equal(strict.distribution[5]!.atOrAboveThreshold, false);
});

test("bucket shares total 100 for a non-empty cohort", () => {
  const result = aggregateScores([0, 1, 2, 3]);
  const total = result.distribution.reduce((sum, bucket) => sum + bucket.share, 0);
  assert.equal(total, 100);
});

/* ── threshold share ────────────────────────────────────────────────── */

test("the boundary is at-or-above: 3 is below, 4 counts", () => {
  const result = aggregateScores([3, 4], { threshold: 4 });
  assert.equal(result.atOrAboveThreshold, 1);
  assert.equal(result.atOrAboveThresholdShare, 50);
});

test("a configured threshold changes the share, not the scores", () => {
  const scores = [0, 2, 4, 6, 8];
  assert.equal(aggregateScores(scores, { threshold: 4 }).atOrAboveThresholdShare, 60);
  assert.equal(aggregateScores(scores, { threshold: 6 }).atOrAboveThresholdShare, 40);
  assert.equal(aggregateScores(scores, { threshold: 4 }).median, 4);
  assert.equal(aggregateScores(scores, { threshold: 6 }).median, 4, "median is threshold-free");
});

/* ── participation ──────────────────────────────────────────────────── */

test("participation needs a denominator and stays null without one", () => {
  assert.equal(aggregateScores([1, 2, 3]).participation, null);
  assert.equal(aggregateScores([1, 2, 3], { invited: 12 }).participation, 25);
  assert.equal(aggregateScores([1, 2, 3], { invited: 0 }).participation, null);
});

test("participation is never reported above 100% — the denominator is wrong, not the rate", () => {
  // More completions than the roster: people joined through a shared link, or
  // the roster was trimmed after the wave.
  const over = aggregateScores([1, 2, 3, 4, 5], { invited: 3 });
  assert.equal(over.participation, null, "no figure beats a nonsensical one");
  assert.equal(over.completed, 5, "the counts themselves are still reported");
  assert.equal(over.invited, 3);

  // The exact boundary still reports.
  assert.equal(aggregateScores([1, 2, 3], { invited: 3 }).participation, 100);
});

/* ── validation ─────────────────────────────────────────────────────── */

test("a score outside 0–12 throws instead of being clamped into plausibility", () => {
  for (const bad of [-1, 13, 4.5, Number.NaN]) {
    assert.throws(() => aggregateScores([0, bad]), RangeError, `refuses ${bad}`);
  }
});

test("an empty cohort produces zeroes rather than NaN", () => {
  const result = aggregateScores([]);
  assert.equal(result.completed, 0);
  assert.equal(result.median, 0);
  assert.equal(result.mean, 0);
  assert.equal(result.atOrAboveThresholdShare, 0);
  assert.equal(result.distribution.every((bucket) => bucket.count === 0 && bucket.share === 0), true);
});

/* ── trends ─────────────────────────────────────────────────────────── */

test("waves are ordered by date regardless of input order", () => {
  const trend = buildTrend([
    wave("Q3", "2026-07-01T00:00:00.000Z", [1, 1]),
    wave("Q1", "2026-01-01T00:00:00.000Z", [5, 5]),
    wave("Q2", "2026-04-01T00:00:00.000Z", [3, 3]),
  ]);
  assert.deepEqual(trend.points.map((point) => point.key), ["Q1", "Q2", "Q3"]);
});

test("movement between the two most recent waves is direction and magnitude", () => {
  const trend = buildTrend([
    wave("Q1", "2026-01-01T00:00:00.000Z", [2, 2, 2, 2], 4, 8),
    wave("Q2", "2026-04-01T00:00:00.000Z", [5, 5, 5, 5], 4, 8),
  ]);
  assert.equal(trend.medianChange!.movement, "higher");
  assert.equal(trend.medianChange!.delta, 3);
  assert.equal(trend.thresholdShareChange!.current, 100);
  assert.equal(trend.thresholdShareChange!.previous, 0);
});

test("an unchanged median reads as unchanged, not as a tiny movement", () => {
  const trend = buildTrend([
    wave("Q1", "2026-01-01T00:00:00.000Z", [3, 3]),
    wave("Q2", "2026-04-01T00:00:00.000Z", [3, 3]),
  ]);
  assert.equal(trend.medianChange!.movement, "unchanged");
  assert.equal(trend.medianChange!.delta, 0);
});

test("a threshold change makes the threshold series incomparable, and says so", () => {
  const trend = buildTrend([
    wave("Q1", "2026-01-01T00:00:00.000Z", [3, 5], 4),
    wave("Q2", "2026-04-01T00:00:00.000Z", [3, 5], 6),
  ]);
  assert.equal(trend.thresholdConsistent, false);
  assert.deepEqual(trend.thresholds, [4, 6]);
  assert.equal(
    trend.thresholdShareChange,
    null,
    "the % at/above series is not drawn across a policy change",
  );
  assert.ok(trend.medianChange, "the median remains comparable and is still reported");
});

test("a single wave has no movement to report", () => {
  const trend = buildTrend([wave("Q1", "2026-01-01T00:00:00.000Z", [1, 2, 3])]);
  assert.equal(trend.medianChange, null);
  assert.equal(trend.thresholdShareChange, null);
  assert.equal(trend.thresholdConsistent, true);
});

/* ── item-level signal ──────────────────────────────────────────────── */

const IDS = Array.from({ length: 12 }, (_, index) => `item_${String(index + 1).padStart(2, "0")}`);

test("item signal counts positions 3 and 4 as elevated, per item", () => {
  const rows = [
    [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3],
  ];
  const signals = itemSignals(rows, IDS);
  assert.equal(signals.length, 12);
  assert.equal(signals[0]!.elevatedCount, 2, "positions 3 and 4 on item_01");
  assert.equal(signals[0]!.elevatedShare, 50);
  assert.equal(signals[1]!.elevatedCount, 0, "position 2 is not elevated");
  assert.equal(signals[11]!.elevatedCount, 1);
});

test("item signals carry item ids only — the engine cannot express a subscale", () => {
  const signals = itemSignals([new Array(12).fill(0)], IDS);
  assert.deepEqual(signals.map((signal) => signal.itemId), IDS);
  for (const signal of signals) {
    assert.deepEqual(Object.keys(signal).sort(), [
      "completed",
      "elevatedCount",
      "elevatedShare",
      "itemId",
      "position",
    ]);
  }
});

test("a malformed item row throws rather than silently under-counting", () => {
  assert.throws(() => itemSignals([[0, 1, 2]], IDS), RangeError);
});

test("no completed responses yields zero shares, not NaN", () => {
  const signals = itemSignals([], IDS);
  assert.equal(signals.every((signal) => signal.elevatedShare === 0), true);
});


/* ── other instrument scales ────────────────────────────────────────── */

test("GHQ-28 aggregates on its own 0–28 scale", () => {
  const result = aggregateScores([0, 14, 28], { maxScore: 28, threshold: 5 });
  assert.equal(result.maxScore, 28);
  assert.equal(result.distribution.length, 29, "one column per point");
  assert.equal(result.median, 14);
  assert.equal(result.atOrAboveThreshold, 2, "14 and 28 are at or above 5");
  assert.throws(() => aggregateScores([29], { maxScore: 28 }), RangeError);
});

test("a 0–100 scale buckets rather than drawing 101 columns", () => {
  const result = aggregateScores([0, 12, 47, 72, 100], { maxScore: 100, threshold: null, bucketSize: 10 });
  assert.equal(result.distribution.length, 11, "0–9, 10–19 … 100");
  assert.deepEqual(
    result.distribution.map((bucket) => bucket.score),
    [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  );
  assert.equal(result.distribution[0]!.count, 1, "0 lands in the first bucket");
  assert.equal(result.distribution[1]!.count, 1, "12 lands in 10–19");
  assert.equal(result.distribution[4]!.count, 1, "47 lands in 40–49");
  assert.equal(result.distribution[7]!.count, 1, "72 lands in 70–79");
  assert.equal(result.distribution[10]!.count, 1, "100 lands in the last bucket");
});

test("an instrument with NO threshold reports no threshold and no share", () => {
  const result = aggregateScores([20, 60, 90], { maxScore: 100, threshold: null, bucketSize: 10 });
  assert.equal(result.threshold, null);
  assert.equal(result.atOrAboveThreshold, 0);
  assert.equal(result.atOrAboveThresholdShare, 0);
  assert.ok(
    result.distribution.every((bucket) => bucket.atOrAboveThreshold === false),
    "nothing is 'at or above' a line that does not exist",
  );
  assert.equal(result.median, 60, "central tendency still works");
});

test("a thresholdless trend draws no threshold series and stays comparable on the median", () => {
  const scale = { maxScore: 100, threshold: null, bucketSize: 10 } as const;
  const trend = buildTrend([
    {
      key: "Q1",
      label: "Q1",
      at: "2026-01-01T00:00:00.000Z",
      aggregate: aggregateScores([40, 60], scale),
    },
    {
      key: "Q2",
      label: "Q2",
      at: "2026-04-01T00:00:00.000Z",
      aggregate: aggregateScores([70, 80], scale),
    },
  ]);
  assert.equal(trend.thresholdShareChange, null, "no threshold series exists to draw");
  assert.ok(trend.medianChange, "the median remains comparable");
  assert.equal(trend.medianChange!.movement, "higher");
  assert.equal(trend.thresholdConsistent, true, "no thresholds means nothing inconsistent");
});
