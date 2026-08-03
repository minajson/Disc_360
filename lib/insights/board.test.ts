import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BALANCED_SPREAD,
  HIGH_BAND,
  balanceIndex,
  balanceVerdict,
  behaviourDistribution,
  collaborationSummary,
  communicationTendencies,
  decisionStyle,
  facilitatorInsights,
  leadSentences,
  rankDimensions,
  riskRegister,
  sharesOf100,
  strengthDistribution,
  type BoardProfile,
} from "./board.ts";
import type { ArchetypeCode, Dimension, DiscScores } from "../types/index.ts";

function profile(
  scores: DiscScores,
  primary: Dimension,
  archetypeCode: ArchetypeCode = "D",
  department: string | null = null,
): BoardProfile {
  return { scores, primary, archetypeCode, department };
}

const balancedAverages: DiscScores = { d: 52, i: 50, s: 49, c: 48 };

/* ── text ───────────────────────────────────────────────────────────── */

test("lead sentences never double the terminating period", () => {
  const paragraph =
    "Across 92 completed profiles, this reads as a direct culture. Styles are evenly distributed. A third sentence follows.";
  const lead = leadSentences(paragraph);
  assert.equal(
    lead,
    "Across 92 completed profiles, this reads as a direct culture. Styles are evenly distributed.",
  );
  assert.ok(!lead.endsWith(".."));
});

test("lead sentences handle one sentence, no punctuation and empty input", () => {
  assert.equal(leadSentences("Only one sentence here."), "Only one sentence here.");
  assert.equal(leadSentences("No terminator at all"), "No terminator at all.");
  assert.equal(leadSentences("   "), "");
  assert.equal(leadSentences(""), "");
});

test("lead sentences respect an explicit count", () => {
  const paragraph = "One. Two. Three. Four.";
  assert.equal(leadSentences(paragraph, 1), "One.");
  assert.equal(leadSentences(paragraph, 3), "One. Two. Three.");
  // Asking for more than exist returns everything, still singly terminated.
  assert.equal(leadSentences(paragraph, 9), "One. Two. Three. Four.");
});

/* ── shares ─────────────────────────────────────────────────────────── */

test("shares always total exactly 100", () => {
  for (const counts of [
    [1, 1, 1],
    [1, 1, 1, 1],
    [3, 3, 3, 1],
    [7, 0, 0, 0],
    [5, 3, 2, 1],
    [1, 2, 3, 4, 5, 6, 7],
  ]) {
    const shares = sharesOf100(counts);
    assert.equal(
      shares.reduce((sum, value) => sum + value, 0),
      100,
      `counts ${counts.join(",")}`,
    );
  }
});

test("an all-zero split yields zeroes rather than dividing by zero", () => {
  assert.deepEqual(sharesOf100([0, 0, 0, 0]), [0, 0, 0, 0]);
  assert.deepEqual(sharesOf100([]), []);
});

test("largest remainder gives the surplus point to the largest fraction", () => {
  // 1/3 each → 33.33; one slice must round up to 34.
  const shares = sharesOf100([1, 1, 1]);
  assert.deepEqual(shares.slice().sort(), [33, 33, 34]);
});

/* ── balance ────────────────────────────────────────────────────────── */

test("balance index is 100 minus spread, clamped", () => {
  assert.equal(balanceIndex({ d: 50, i: 50, s: 50, c: 50 }), 100);
  assert.equal(balanceIndex({ d: 70, i: 50, s: 50, c: 40 }), 70);
  assert.equal(balanceIndex({ d: 100, i: 0, s: 0, c: 0 }), 0);
});

test("balance verdict escalates from balanced to leaning to concentrated", () => {
  assert.equal(balanceVerdict({ d: 52, i: 50, s: 48, c: 46 }).label, "Evenly balanced");
  assert.equal(balanceVerdict({ d: 65, i: 55, s: 50, c: 45 }).label, "Leaning");
  assert.equal(balanceVerdict({ d: 80, i: 55, s: 45, c: 30 }).label, "Concentrated");
});

test("the balanced boundary sits exactly at the documented spread", () => {
  const atBoundary: DiscScores = { d: 50 + BALANCED_SPREAD, i: 50, s: 50, c: 50 };
  assert.equal(balanceVerdict(atBoundary).label, "Evenly balanced");
  const justOver: DiscScores = { d: 51 + BALANCED_SPREAD, i: 50, s: 50, c: 50 };
  assert.equal(balanceVerdict(justOver).label, "Leaning");
});

test("dimensions rank highest first and tie-break D→I→S→C", () => {
  assert.deepEqual(rankDimensions({ d: 40, i: 80, s: 60, c: 20 }), ["I", "S", "D", "C"]);
  assert.deepEqual(rankDimensions({ d: 50, i: 50, s: 50, c: 50 }), ["D", "I", "S", "C"]);
});

/* ── distributions ──────────────────────────────────────────────────── */

test("behaviour distribution counts primaries and totals 100", () => {
  const profiles = [
    profile({ d: 70, i: 40, s: 30, c: 30 }, "D"),
    profile({ d: 30, i: 70, s: 40, c: 30 }, "I"),
    profile({ d: 30, i: 40, s: 70, c: 30 }, "S"),
  ];
  const distribution = behaviourDistribution(profiles);
  assert.deepEqual(
    distribution.map((slice) => slice.count),
    [1, 1, 1, 0],
  );
  assert.equal(
    distribution.reduce((sum, slice) => sum + slice.share, 0),
    100,
  );
});

test("an empty cohort distributes to zero without dividing by zero", () => {
  const distribution = behaviourDistribution([]);
  assert.deepEqual(distribution.map((slice) => slice.share), [0, 0, 0, 0]);
});

test("strength distribution counts everyone at or above the high band", () => {
  const profiles = [
    profile({ d: HIGH_BAND, i: HIGH_BAND - 1, s: 20, c: 20 }, "D"),
    profile({ d: 80, i: 75, s: 20, c: 20 }, "D"),
  ];
  const bands = strengthDistribution(profiles);
  assert.deepEqual(
    bands.map((band) => band.count),
    [2, 1, 0, 0],
  );
  assert.equal(bands[0]!.percentage, 100);
  assert.equal(bands[1]!.percentage, 50);
});

test("strength percentages are zero for an empty cohort", () => {
  assert.ok(strengthDistribution([]).every((band) => band.percentage === 0));
});

/* ── communication ──────────────────────────────────────────────────── */

test("communication tendencies rank by head-count and carry a risk each", () => {
  const profiles = [
    profile({ d: 70, i: 40, s: 30, c: 30 }, "D"),
    profile({ d: 70, i: 40, s: 30, c: 30 }, "D"),
    profile({ d: 30, i: 70, s: 40, c: 30 }, "I"),
  ];
  const tendencies = communicationTendencies(profiles);
  assert.equal(tendencies[0]!.dimension, "D");
  assert.equal(tendencies[0]!.count, 2);
  assert.ok(tendencies.every((entry) => entry.style.length > 0 && entry.risk.length > 0));
  assert.equal(tendencies.length, 4);
});

/* ── decision style ─────────────────────────────────────────────────── */

test("decision style tilts on the action/deliberation gap", () => {
  assert.equal(decisionStyle({ d: 80, i: 75, s: 30, c: 30 }).label, "Action-led");
  assert.equal(decisionStyle({ d: 30, i: 30, s: 80, c: 75 }).label, "Deliberation-led");
  assert.equal(decisionStyle({ d: 55, i: 50, s: 50, c: 52 }).label, "In tension");
});

test("decision style reports both halves and the signed tilt", () => {
  const style = decisionStyle({ d: 80, i: 60, s: 40, c: 20 });
  assert.equal(style.actionBias, 70);
  assert.equal(style.deliberation, 30);
  assert.equal(style.tilt, 40);
});

/* ── narrative ──────────────────────────────────────────────────────── */

test("collaboration summary degrades to a waiting message when empty", () => {
  assert.match(collaborationSummary([], balancedAverages), /once members complete/);
});

test("collaboration summary names the lead energy and the thinnest voice", () => {
  const profiles = [
    profile({ d: 85, i: 60, s: 30, c: 25 }, "D"),
    profile({ d: 75, i: 65, s: 35, c: 30 }, "D"),
  ];
  const summary = collaborationSummary(profiles, { d: 80, i: 62, s: 32, c: 27 });
  assert.match(summary, /dominant/i);
  assert.match(summary, /analytical/i);
  assert.ok(summary.length > 200);
});

/* ── insights ───────────────────────────────────────────────────────── */

const cohort = [
  profile({ d: 82, i: 55, s: 30, c: 28 }, "D"),
  profile({ d: 78, i: 60, s: 35, c: 30 }, "D"),
  profile({ d: 74, i: 52, s: 33, c: 26 }, "D"),
  profile({ d: 70, i: 58, s: 38, c: 32 }, "D"),
];
const cohortAverages: DiscScores = { d: 76, i: 56, s: 34, c: 29 };

test("no insights are generated without completed profiles", () => {
  assert.deepEqual(
    facilitatorInsights({ profiles: [], averages: balancedAverages, memberCount: 5, completedCount: 0 }),
    [],
  );
  assert.deepEqual(
    riskRegister({ profiles: [], averages: balancedAverages, memberCount: 5, completedCount: 0 }),
    [],
  );
});

test("a homogeneous cohort is flagged for concentration and thin coverage", () => {
  const insights = facilitatorInsights({
    profiles: cohort,
    averages: cohortAverages,
    memberCount: 4,
    completedCount: 4,
  });
  const titles = insights.map((insight) => insight.title);
  assert.ok(titles.some((title) => title.includes("Center of gravity: Dominant")));
  assert.ok(titles.some((title) => title.includes("concentration")));
  assert.ok(titles.some((title) => title.includes("Thinnest coverage: Analytical")));
  assert.ok(insights.every((insight) => insight.detail.length > 40));
});

test("outstanding profiles add an explicit completeness caveat", () => {
  const insights = facilitatorInsights({
    profiles: cohort,
    averages: cohortAverages,
    memberCount: 10,
    completedCount: 4,
  });
  const caveat = insights.find((insight) => insight.title.includes("outstanding"));
  assert.ok(caveat);
  assert.match(caveat!.detail, /4 of 10/);
});

test("full completion adds no outstanding caveat", () => {
  const insights = facilitatorInsights({
    profiles: cohort,
    averages: cohortAverages,
    memberCount: 4,
    completedCount: 4,
  });
  assert.ok(!insights.some((insight) => insight.title.includes("outstanding")));
});

/* ── risks ──────────────────────────────────────────────────────────── */

test("opposing strength blocks raise a high-severity conflict risk first", () => {
  const profiles = [
    profile({ d: 80, i: 40, s: 30, c: 30 }, "D"),
    profile({ d: 78, i: 42, s: 32, c: 30 }, "D"),
    profile({ d: 30, i: 40, s: 75, c: 40 }, "S"),
    profile({ d: 28, i: 38, s: 72, c: 42 }, "S"),
  ];
  const risks = riskRegister({
    profiles,
    averages: { d: 54, i: 40, s: 52, c: 36 },
    memberCount: 4,
    completedCount: 4,
  });
  assert.equal(risks[0]!.severity, "high");
  assert.match(risks[0]!.title, /Conflict-style mismatch/);
});

test("a missing strength band is called absent, not quiet", () => {
  const risks = riskRegister({
    profiles: cohort,
    averages: cohortAverages,
    memberCount: 4,
    completedCount: 4,
  });
  const missing = risks.find((risk) => risk.title.includes("No Analytical strength"));
  assert.ok(missing);
  assert.equal(missing!.severity, "high");
});

test("low completion is a watch item", () => {
  const risks = riskRegister({
    profiles: cohort,
    averages: cohortAverages,
    memberCount: 20,
    completedCount: 4,
  });
  assert.ok(risks.some((risk) => risk.title === "Incomplete coverage"));
});

test("a healthy cohort still returns one watch item rather than nothing", () => {
  const profiles = [
    profile({ d: 62, i: 55, s: 54, c: 61 }, "D"),
    profile({ d: 55, i: 63, s: 61, c: 54 }, "I"),
  ];
  const risks = riskRegister({
    profiles,
    averages: { d: 58, i: 59, s: 57, c: 57 },
    memberCount: 2,
    completedCount: 2,
  });
  assert.equal(risks.length, 1);
  assert.equal(risks[0]!.severity, "watch");
});
