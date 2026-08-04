import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildFacilitatorInsights,
  INSIGHT_ORDER,
  type FacilitatorInsightSet,
} from "../insights/facilitator.ts";
import type { BoardProfile } from "../insights/board.ts";
import {
  DIMENSION_KEY,
  DIMENSIONS,
  type ArchetypeCode,
  type Dimension,
} from "../types/index.ts";
import { payloadLeaks } from "./policy.ts";
import {
  SAFE_METRIC,
  applyNarrative,
  rulesBrief,
  rulesNarrative,
  rulesSummary,
  screenBrief,
  screenSummary,
  toPayload,
  type Narrative,
} from "./narrative.ts";

/* ── a realistic team ───────────────────────────────────────────────── */

function profile(d: number, i: number, s: number, c: number, department: string): BoardProfile {
  const scores = { d, i, s, c };
  const ranked = [...DIMENSIONS].sort(
    (a, b) => scores[DIMENSION_KEY[b]] - scores[DIMENSION_KEY[a]],
  );
  const [first, second] = ranked as [Dimension, Dimension];
  return {
    scores,
    primary: first,
    archetypeCode: `${first}${second}` as ArchetypeCode,
    department,
  };
}

const profiles: BoardProfile[] = [
  profile(72, 44, 38, 55, "Delivery"),
  profile(65, 51, 42, 60, "Delivery"),
  profile(40, 68, 58, 45, "Delivery"),
  profile(35, 72, 62, 40, "Support"),
  profile(48, 40, 70, 66, "Support"),
  profile(30, 38, 74, 71, "Support"),
  profile(58, 60, 45, 48, "Delivery"),
  profile(44, 46, 66, 69, "Support"),
];

const set: FacilitatorInsightSet = buildFacilitatorInsights(
  profiles,
  { label: "Applications & ERP", basis: "group", generatedAt: "2026-08-01T09:00:00.000Z" },
  12,
);

/* ── what leaves the server ─────────────────────────────────────────── */

test("the payload carries no identifying field", () => {
  assert.deepEqual(payloadLeaks(toPayload(set)), []);
});

test("the payload never carries the team's name", () => {
  const serialized = JSON.stringify(toPayload(set));
  assert.ok(!serialized.includes("Applications"), serialized.slice(0, 200));
  assert.ok(!serialized.includes("Delivery"));
  assert.ok(!serialized.includes("Support"));
});

test("every metric name is a safe, computed label", () => {
  for (const card of toPayload(set).cards) {
    for (const chip of card.evidence) {
      assert.match(chip.metric, SAFE_METRIC, `${card.category}: ${chip.metric}`);
    }
  }
});

test("the payload covers exactly the deterministic cards", () => {
  const payload = toPayload(set);
  assert.equal(payload.scopeKind, "team");
  assert.deepEqual(
    payload.cards.map((card) => card.category),
    set.insights.map((insight) => insight.category),
  );
});

/* ── applying a model narrative ─────────────────────────────────────── */

const rewrite = (category: string) => ({
  category,
  headline: "A team that prefers agreement before pace",
  observation: "Stable averages 57 across 8 completed profiles of 12 invited.",
  interpretation: [
    "decisions may be socialised before they are announced",
    "urgency is likely to feel disruptive unless it is explained",
  ],
});

test("model prose replaces the text and nothing else", () => {
  const original = set.insights[0]!;
  const applied = applyNarrative(set, {
    cards: [rewrite(original.category)],
    brief: rulesBrief(set),
    summary: rulesSummary(set),
  });
  const card = applied.set.insights[0]!;

  assert.equal(card.title, "A team that prefers agreement before pace");
  assert.deepEqual(applied.applied, [original.category]);
  // Everything measured survives untouched.
  assert.deepEqual(card.evidence, original.evidence);
  assert.deepEqual(card.questions, original.questions);
  assert.equal(card.signal, original.signal);
  assert.equal(card.sampleSize, original.sampleSize);
  assert.equal(card.populationSize, original.populationSize);
});

test("a card the model did not write keeps its rule-written prose", () => {
  const applied = applyNarrative(set, {
    cards: [rewrite(set.insights[0]!.category)],
    brief: rulesBrief(set),
    summary: rulesSummary(set),
  });
  for (const insight of applied.set.insights.slice(1)) {
    const original = set.insights.find((entry) => entry.category === insight.category)!;
    assert.equal(insight.title, original.title);
    assert.equal(insight.observation, original.observation);
  }
  assert.equal(applied.rejected.length, set.insights.length - 1);
});

test("prose outside the register is refused card by card", () => {
  const applied = applyNarrative(set, {
    cards: [
      {
        category: set.insights[0]!.category,
        headline: "Symptoms of a difficult team",
        observation: "Two members are poor performers.",
        interpretation: ["they should be removed", "this proves the pattern"],
      },
      rewrite(set.insights[1]!.category),
    ],
    brief: rulesBrief(set),
    summary: rulesSummary(set),
  });

  assert.deepEqual(applied.applied, [set.insights[1]!.category]);
  assert.equal(applied.set.insights[0]!.title, set.insights[0]!.title);
  assert.ok(applied.rejected.some((entry) => entry.category === set.insights[0]!.category));
});

test("a category the model invented is dropped, not rendered", () => {
  const applied = applyNarrative(set, {
    cards: [{ ...rewrite("psychological_profile") }],
    brief: rulesBrief(set),
    summary: rulesSummary(set),
  });
  assert.equal(applied.set.insights.length, set.insights.length);
  assert.ok(applied.rejected.some((entry) => entry.category === "psychological_profile"));
  assert.deepEqual(applied.applied, []);
});

test("applying a narrative never changes how many cards exist", () => {
  const applied = applyNarrative(set, {
    cards: INSIGHT_ORDER.map((category) => rewrite(category)),
    brief: rulesBrief(set),
    summary: rulesSummary(set),
  });
  assert.equal(applied.set.insights.length, INSIGHT_ORDER.length);
  assert.equal(applied.applied.length, INSIGHT_ORDER.length);
});

/* ── screening the brief and summary ────────────────────────────────── */

test("the rules' own brief and summary pass their own screening", () => {
  assert.deepEqual(screenBrief(rulesBrief(set)), []);
  assert.deepEqual(screenSummary(rulesSummary(set)), []);
});

test("a brief that names an unknown category is rejected", () => {
  const brief = { ...rulesBrief(set), slideOrder: ["snapshot", "diagnosis"] };
  assert.ok(screenBrief(brief).some((problem) => problem.includes("unknown category")));
});

test("a brief in the wrong register is rejected", () => {
  const brief = { ...rulesBrief(set), actions: ["Use this in the next promotion decision"] };
  assert.ok(screenBrief(brief).some((problem) => problem.includes("forbidden register")));
});

test("an empty brief section is rejected", () => {
  assert.ok(screenBrief({ ...rulesBrief(set), questions: [] }).includes("empty questions"));
  assert.ok(screenBrief({ ...rulesBrief(set), opening: "  " }).includes("empty opening"));
});

test("a summary that claims causation is rejected", () => {
  const summary = { ...rulesSummary(set), paragraphs: ["The gap is caused by the restructure"] };
  assert.ok(screenSummary(summary).some((problem) => problem.includes("causal claim")));
});

/* ── the fallback is a complete narrative ───────────────────────────── */

test("the rules narrative covers every category", () => {
  const narrative: Narrative = rulesNarrative(set);
  assert.deepEqual(
    narrative.cards.map((card) => card.category),
    set.insights.map((insight) => insight.category),
  );
  assert.ok(narrative.brief.opening.length > 0);
  assert.ok(narrative.summary.paragraphs.length > 0);
});

test("applying the rules narrative is a no-op on the cards", () => {
  const applied = applyNarrative(set, rulesNarrative(set));
  // Every card accepted, not merely unchanged — a rejected card would also
  // keep its title, so this is what proves the platform's own prose satisfies
  // the register rules it holds a model to.
  assert.equal(applied.applied.length, set.insights.length);
  assert.deepEqual(applied.rejected, []);
  for (const [index, insight] of applied.set.insights.entries()) {
    assert.equal(insight.title, set.insights[index]!.title);
    assert.equal(insight.observation, set.insights[index]!.observation);
  }
});

test("the brief opens with coverage, not with a claim", () => {
  const brief = rulesBrief(set);
  assert.match(brief.opening, /8 of 12 people have completed/);
  assert.ok(brief.slideOrder.length === set.insights.length);
  assert.ok(brief.questions.length > 0);
});

test("a suppressed scope still yields a usable brief rather than throwing", () => {
  const tiny = buildFacilitatorInsights(profiles.slice(0, 2), set.scope, 12);
  assert.ok(tiny.suppressed);
  const brief = rulesBrief(tiny);
  assert.equal(brief.slideOrder.length, 0);
  assert.equal(brief.observations.length, 0);
  assert.equal(rulesSummary(tiny).paragraphs.length, 0);
});
