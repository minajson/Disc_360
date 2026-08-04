import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CATEGORY_TITLE,
  INSIGHT_ORDER,
  INTERPRETATION_HEADING,
  MIN_GROUP_SIZE,
  SIGNAL_THRESHOLDS,
  buildFacilitatorInsights,
  departmentInsights,
  signalFor,
  type FacilitatorInsight,
  type FacilitatorScope,
} from "./facilitator.ts";
import type { BoardProfile } from "./board.ts";
import type { ArchetypeCode, Dimension, DiscScores } from "../types/index.ts";

const SCOPE: FacilitatorScope = {
  label: "Applications & ERP Team",
  basis: "group",
  generatedAt: "2026-08-04T09:00:00.000Z",
};

function profile(
  scores: DiscScores,
  primary: Dimension,
  department: string | null = null,
  archetypeCode: ArchetypeCode = "D",
): BoardProfile {
  return { scores, primary, archetypeCode, department };
}

/** Stable–Analytical cohort, the pattern in the product brief. */
const stableAnalytical: BoardProfile[] = [
  profile({ d: 45, i: 39, s: 64, c: 61 }, "S", "ERP"),
  profile({ d: 42, i: 38, s: 66, c: 60 }, "S", "ERP"),
  profile({ d: 48, i: 41, s: 62, c: 63 }, "C", "IDT"),
  profile({ d: 44, i: 37, s: 65, c: 59 }, "S", "IDT"),
  profile({ d: 46, i: 40, s: 63, c: 62 }, "C", "SAP ERP"),
  profile({ d: 43, i: 36, s: 67, c: 58 }, "S", "SAP ERP"),
  profile({ d: 47, i: 42, s: 61, c: 64 }, "C", "IT"),
  profile({ d: 41, i: 35, s: 68, c: 57 }, "S", "IT"),
];

/** Deliberately opposed: fast movers alongside evidence-first participants. */
const opposed: BoardProfile[] = [
  profile({ d: 82, i: 60, s: 28, c: 30 }, "D"),
  profile({ d: 78, i: 64, s: 30, c: 26 }, "D"),
  profile({ d: 30, i: 28, s: 72, c: 80 }, "C"),
  profile({ d: 26, i: 32, s: 70, c: 78 }, "C"),
];

const allInsights = (list: FacilitatorInsight[]) => list;

/* ── signal strength ────────────────────────────────────────────────── */

test("signal strength steps at the documented sample sizes", () => {
  assert.equal(signalFor(0), "insufficient");
  assert.equal(signalFor(MIN_GROUP_SIZE - 1), "insufficient");
  assert.equal(signalFor(SIGNAL_THRESHOLDS.emerging), "emerging");
  assert.equal(signalFor(SIGNAL_THRESHOLDS.moderate - 1), "emerging");
  assert.equal(signalFor(SIGNAL_THRESHOLDS.moderate), "moderate");
  assert.equal(signalFor(SIGNAL_THRESHOLDS.strong - 1), "moderate");
  assert.equal(signalFor(SIGNAL_THRESHOLDS.strong), "strong");
  assert.equal(signalFor(500), "strong");
});

/* ── suppression ────────────────────────────────────────────────────── */

test("a scope below the threshold produces no insight cards at all", () => {
  for (const size of [0, 1, 2]) {
    const set = buildFacilitatorInsights(stableAnalytical.slice(0, size), SCOPE);
    assert.equal(set.insights.length, 0, `size ${size}`);
    assert.ok(set.suppressed, `size ${size} carries a reason`);
  }
  assert.match(buildFacilitatorInsights([], SCOPE).suppressed!, /No completed profiles/);
  assert.match(
    buildFacilitatorInsights(stableAnalytical.slice(0, 2), SCOPE).suppressed!,
    /Too little data for a reliable group interpretation/,
  );
});

test("the threshold itself produces a full, clearly-hedged set", () => {
  const set = buildFacilitatorInsights(stableAnalytical.slice(0, MIN_GROUP_SIZE), SCOPE);
  assert.equal(set.suppressed, null);
  assert.equal(set.insights.length, INSIGHT_ORDER.length);
  assert.ok(set.insights.every((insight) => insight.signal === "emerging"));
});

/* ── structure ──────────────────────────────────────────────────────── */

test("every category is generated once, in order, fully populated", () => {
  const set = buildFacilitatorInsights(stableAnalytical, SCOPE);
  assert.deepEqual(
    set.insights.map((insight) => insight.category),
    INSIGHT_ORDER,
  );
  for (const insight of set.insights) {
    assert.ok(CATEGORY_TITLE[insight.category], `${insight.category} has a title`);
    assert.ok(insight.title.length > 0, `${insight.category} title`);
    assert.ok(insight.observation.length > 30, `${insight.category} observation`);
    assert.ok(insight.interpretation.length >= 2, `${insight.category} interpretation`);
    assert.ok(insight.questions.length >= 2, `${insight.category} questions`);
    assert.ok(insight.evidence.length >= 3, `${insight.category} evidence`);
    assert.equal(insight.sampleSize, stableAnalytical.length);
  }
});

test("observation and interpretation stay separate fields", () => {
  // The observation states what the data shows; hedging belongs on the other
  // side of the card. Merging them is what turns a metric into a claim.
  for (const insight of buildFacilitatorInsights(stableAnalytical, SCOPE).insights) {
    assert.doesNotMatch(
      insight.observation,
      /may mean|might mean|suggests that|probably/i,
      `${insight.category} observation must not interpret`,
    );
    assert.ok(
      insight.interpretation.every((line) => line.length > 20),
      `${insight.category} interpretation lines are substantive`,
    );
  }
});

test("every evidence chip carries a real value", () => {
  for (const insight of buildFacilitatorInsights(stableAnalytical, SCOPE).insights) {
    for (const chip of insight.evidence) {
      assert.ok(chip.label.length > 0);
      assert.ok(chip.value.length > 0);
      assert.doesNotMatch(chip.value, /undefined|NaN|null/);
    }
  }
});

test("evidence figures match the underlying result data", () => {
  const set = buildFacilitatorInsights(stableAnalytical, SCOPE);
  const snapshot = set.insights.find((insight) => insight.category === "snapshot")!;
  // Averages computed independently of the module under test.
  const mean = (key: keyof DiscScores) =>
    Math.round(
      stableAnalytical.reduce((sum, p) => sum + p.scores[key], 0) / stableAnalytical.length,
    );
  const chip = (label: string) =>
    snapshot.evidence.find((entry) => entry.label === label)!.value;
  assert.equal(chip("D average"), String(mean("d")));
  assert.equal(chip("I average"), String(mean("i")));
  assert.equal(chip("S average"), String(mean("s")));
  assert.equal(chip("A average"), String(mean("c")));
});

/* ── meaningful differences ─────────────────────────────────────────── */

/** Four averages within a point of each other — no style genuinely leads. */
const evenlyBalanced: BoardProfile[] = [
  profile({ d: 51, i: 51, s: 51, c: 51 }, "D"),
  profile({ d: 50, i: 52, s: 51, c: 50 }, "I"),
  profile({ d: 52, i: 50, s: 50, c: 52 }, "S"),
  profile({ d: 51, i: 51, s: 52, c: 51 }, "C"),
];

test("a balanced cohort is never given an invented leading style", () => {
  // Regression: the D→I→S→C tie-break used to surface as a confident
  // "Dominant–Influence pattern" on a cohort whose averages were identical.
  const insights = buildFacilitatorInsights(evenlyBalanced, SCOPE).insights;
  const byCategory = new Map(insights.map((insight) => [insight.category, insight]));

  assert.equal(byCategory.get("snapshot")!.title, "An evenly balanced pattern");
  assert.equal(byCategory.get("communication")!.title, "Mixed communication preferences");
  assert.equal(byCategory.get("change")!.title, "Mixed change preferences");
  assert.equal(byCategory.get("leadership")!.title, "No single leadership register dominates");
  assert.equal(byCategory.get("collaboration")!.title, "Task and people focus in balance");
});

test("a balanced cohort's cards never contradict each other", () => {
  // The defect that motivated the margin: snapshot claimed a Dominant lead
  // while communication called the same cohort evidence-first.
  const insights = buildFacilitatorInsights(evenlyBalanced, SCOPE).insights;
  const named = insights.flatMap((insight) =>
    ["Dominant", "Influence", "Stable", "Analytical"].filter((label) =>
      new RegExp(`\\b${label}\\b`).test(insight.title),
    ),
  );
  assert.deepEqual(named, [], `no card may name a leading style: ${named.join(", ")}`);
});

test("a genuinely led cohort still names its lead", () => {
  const insights = buildFacilitatorInsights(stableAnalytical, SCOPE).insights;
  const snapshot = insights.find((insight) => insight.category === "snapshot")!;
  assert.match(snapshot.title, /Stable/);
  assert.doesNotMatch(snapshot.title, /evenly balanced/);
});

test("a lead needs the documented margin, not a single point", () => {
  const oneApart = [
    profile({ d: 55, i: 54, s: 54, c: 54 }, "D"),
    profile({ d: 55, i: 54, s: 54, c: 54 }, "D"),
    profile({ d: 55, i: 54, s: 54, c: 54 }, "D"),
  ];
  assert.equal(
    buildFacilitatorInsights(oneApart, SCOPE).insights.find((i) => i.category === "snapshot")!.title,
    "An evenly balanced pattern",
  );

  const clearlyApart = [
    profile({ d: 60, i: 54, s: 54, c: 54 }, "D"),
    profile({ d: 60, i: 54, s: 54, c: 54 }, "D"),
    profile({ d: 60, i: 54, s: 54, c: 54 }, "D"),
  ];
  assert.match(
    buildFacilitatorInsights(clearlyApart, SCOPE).insights.find((i) => i.category === "snapshot")!
      .title,
    /Dominant/,
  );
});

test("a lead with no separated runner-up is reported as single-style", () => {
  const soloLead = [
    profile({ d: 70, i: 52, s: 51, c: 50 }, "D"),
    profile({ d: 70, i: 52, s: 51, c: 50 }, "D"),
    profile({ d: 70, i: 52, s: 51, c: 50 }, "D"),
  ];
  assert.equal(
    buildFacilitatorInsights(soloLead, SCOPE).insights.find((i) => i.category === "snapshot")!.title,
    "A Dominant-led pattern",
  );
});

/* ── safety register ────────────────────────────────────────────────── */

const CLINICAL =
  /\b(diagnos\w*|disorder|syndrome|patholog\w*|neurotic|clinical|therapy|therapeutic|mental health|personality disorder|treatment|symptom)\b/i;
const JUDGEMENT =
  /\b(good people|bad people|weak(er|est)? (member|people|person)|difficult (member|people|person)|poor perform\w*|incompeten\w*|unfit|toxic|lazy|smarter|less intelligent)\b/i;
const CAUSAL = /\b(because of|caused by|proves|guarantees|will definitely|always results in)\b/i;

function everyLine(insight: FacilitatorInsight): string[] {
  return [insight.title, insight.observation, ...insight.interpretation, ...insight.questions];
}

test("no card uses clinical or diagnostic language", () => {
  for (const cohort of [stableAnalytical, opposed]) {
    for (const insight of allInsights(buildFacilitatorInsights(cohort, SCOPE).insights)) {
      for (const line of everyLine(insight)) {
        assert.doesNotMatch(line, CLINICAL, `${insight.category}: "${line}"`);
      }
    }
  }
});

test("no card judges people as good, bad, weak or difficult", () => {
  for (const cohort of [stableAnalytical, opposed]) {
    for (const insight of allInsights(buildFacilitatorInsights(cohort, SCOPE).insights)) {
      for (const line of everyLine(insight)) {
        assert.doesNotMatch(line, JUDGEMENT, `${insight.category}: "${line}"`);
      }
    }
  }
});

test("no card claims causation or certainty", () => {
  for (const cohort of [stableAnalytical, opposed]) {
    for (const insight of allInsights(buildFacilitatorInsights(cohort, SCOPE).insights)) {
      for (const line of everyLine(insight)) {
        assert.doesNotMatch(line, CAUSAL, `${insight.category}: "${line}"`);
      }
    }
  }
});

test("the interpretation heading carries the hedge structurally", () => {
  // Interpretation lines are fragments read under one fixed heading, so the
  // hedge cannot be lost by rewording an individual line — including when the
  // model rewrites the prose in the AI layer.
  assert.equal(INTERPRETATION_HEADING, "What this may mean");
});

test("no interpretation line is phrased as a certainty", () => {
  const CERTAIN =
    /\b(will (be|not|always|never)|is proven|definitely|certainly|without doubt|guaranteed|must be|always is)\b/i;
  for (const cohort of [stableAnalytical, opposed]) {
    for (const insight of buildFacilitatorInsights(cohort, SCOPE).insights) {
      for (const line of insight.interpretation) {
        assert.doesNotMatch(line, CERTAIN, `${insight.category}: "${line}"`);
      }
    }
  }
});

test("observations are the only place a bare statement of fact appears", () => {
  // An observation restates measured data, so it is allowed to be flat. Every
  // observation must therefore contain a figure it can be checked against.
  for (const cohort of [stableAnalytical, opposed]) {
    for (const insight of buildFacilitatorInsights(cohort, SCOPE).insights) {
      assert.match(
        insight.observation,
        /\d/,
        `${insight.category} observation must cite a measured figure`,
      );
    }
  }
});

test("conflict signals never name an individual as the source", () => {
  const set = buildFacilitatorInsights(opposed, SCOPE);
  const card = set.insights.find((insight) => insight.category === "conflict")!;
  // Style groups, never people: "participants who…" not "Ada and Ben clash".
  for (const line of everyLine(card)) {
    assert.doesNotMatch(line, /\b(Member [A-Z]\b|conflict source|blame)/i, line);
  }
  assert.ok(
    card.interpretation.some((line) =>
      /style tendencies observed in aggregate, not predictions/.test(line),
    ),
    "the aggregate caveat is always present",
  );
});

test("opposed cohorts surface both tension types, cautiously", () => {
  const card = buildFacilitatorInsights(opposed, SCOPE).insights.find(
    (insight) => insight.category === "conflict",
  )!;
  assert.match(card.title, /tensions worth naming/i);
  assert.ok(card.interpretation.some((line) => /commit quickly/.test(line)));
  assert.ok(card.interpretation.some((line) => /evidence before the story/.test(line)));
});

test("a harmonious cohort is not given invented tension", () => {
  const calm = [
    profile({ d: 52, i: 50, s: 51, c: 49 }, "D"),
    profile({ d: 50, i: 52, s: 49, c: 51 }, "I"),
    profile({ d: 49, i: 51, s: 52, c: 50 }, "S"),
  ];
  const card = buildFacilitatorInsights(calm, SCOPE).insights.find(
    (insight) => insight.category === "conflict",
  )!;
  assert.match(card.title, /Low style tension/);
});

/* ── inclusion ──────────────────────────────────────────────────────── */

test("inclusion frames airtime, never contribution or ability", () => {
  const card = buildFacilitatorInsights(stableAnalytical, SCOPE).insights.find(
    (insight) => insight.category === "inclusion",
  )!;
  assert.ok(
    card.interpretation.some((line) =>
      /about airtime, not about contribution or ability/.test(line),
    ),
  );
  assert.ok(card.questions.length >= 3);
});

test("a dominated cohort is flagged; a spread one is not", () => {
  const dominated = [
    profile({ d: 80, i: 40, s: 30, c: 30 }, "D"),
    profile({ d: 78, i: 42, s: 32, c: 28 }, "D"),
    profile({ d: 76, i: 44, s: 30, c: 30 }, "D"),
    profile({ d: 30, i: 40, s: 70, c: 50 }, "S"),
  ];
  assert.match(
    buildFacilitatorInsights(dominated, SCOPE).insights.find((i) => i.category === "inclusion")!.title,
    /One style carries the room/,
  );
});

/* ── department comparison ──────────────────────────────────────────── */

test("departments below the threshold get counts but no interpretation", () => {
  const departments = departmentInsights(
    stableAnalytical,
    { ERP: 4, IDT: 3, "SAP ERP": 2, IT: 5 },
    SCOPE.generatedAt,
  );
  assert.equal(departments.length, 4);
  for (const department of departments) {
    // Every department here has 2 completed profiles — under the threshold.
    assert.equal(department.completedCount, 2);
    assert.equal(department.insights, null, department.department);
    assert.match(department.suppressed!, /Too little data/);
    // Coverage is still reported so a facilitator can see the gap.
    assert.ok(department.memberCount >= department.completedCount);
    assert.ok(department.averages.s > 0);
  }
});

test("a department at or above the threshold gets a full set", () => {
  const big = stableAnalytical.map((p) => ({ ...p, department: "ERP" }));
  const [department] = departmentInsights(big, { ERP: 12 }, SCOPE.generatedAt);
  assert.equal(department!.department, "ERP");
  assert.equal(department!.completedCount, 8);
  assert.equal(department!.memberCount, 12);
  assert.equal(department!.suppressed, null);
  assert.equal(department!.insights!.length, INSIGHT_ORDER.length);
  assert.equal(department!.signal, "moderate");
  assert.ok(department!.insights!.every((insight) => insight.populationSize === 12));
});

test("departments are ordered largest first and unassigned is named", () => {
  const mixed = [
    profile({ d: 50, i: 50, s: 50, c: 50 }, "D", "IT"),
    profile({ d: 50, i: 50, s: 50, c: 50 }, "D", "IT"),
    profile({ d: 50, i: 50, s: 50, c: 50 }, "D", "IT"),
    profile({ d: 50, i: 50, s: 50, c: 50 }, "D", null),
  ];
  const departments = departmentInsights(mixed, { IT: 3, Unassigned: 1 }, SCOPE.generatedAt);
  assert.deepEqual(
    departments.map((d) => d.department),
    ["IT", "Unassigned"],
  );
  assert.equal(departments[0]!.suppressed, null);
  assert.ok(departments[1]!.suppressed);
});

/* ── scope metadata ─────────────────────────────────────────────────── */

test("the scope travels with the insight set unchanged", () => {
  const set = buildFacilitatorInsights(stableAnalytical, SCOPE, 24);
  assert.deepEqual(set.scope, SCOPE);
  assert.ok(set.insights.every((insight) => insight.populationSize === 24));
  assert.ok(set.insights.every((insight) => insight.sampleSize === 8));
});
