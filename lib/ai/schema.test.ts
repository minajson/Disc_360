import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFacilitatorInsights, INSIGHT_ORDER } from "../insights/facilitator.ts";
import type { BoardProfile } from "../insights/board.ts";
import { narrativeSchema } from "./schema.ts";
import { rulesNarrative } from "./narrative.ts";

/**
 * One shape, three checkpoints: the API enforces this schema on the model's
 * reply, the store validates the stored JSON against it, and the rules'
 * narrative must satisfy it too — otherwise the fallback would render through
 * a different path than the generated version and only one of them would be
 * exercised by the UI.
 */

const profiles: BoardProfile[] = [
  { scores: { d: 70, i: 45, s: 40, c: 55 }, primary: "D", archetypeCode: "DC", department: "A" },
  { scores: { d: 38, i: 66, s: 60, c: 44 }, primary: "I", archetypeCode: "IS", department: "A" },
  { scores: { d: 42, i: 40, s: 72, c: 68 }, primary: "S", archetypeCode: "SC", department: "B" },
  { scores: { d: 55, i: 52, s: 50, c: 58 }, primary: "C", archetypeCode: "CD", department: "B" },
];

const set = buildFacilitatorInsights(
  profiles,
  { label: "Team", basis: "group", generatedAt: "2026-08-01T09:00:00.000Z" },
  6,
);

test("the rules narrative satisfies the schema the model is held to", () => {
  const parsed = narrativeSchema.safeParse(rulesNarrative(set));
  assert.ok(parsed.success, JSON.stringify(parsed.error?.issues ?? [], null, 2));
});

test("the schema refuses a category outside the evidence layer", () => {
  const narrative = rulesNarrative(set);
  narrative.cards[0]!.category = "diagnosis";
  assert.equal(narrativeSchema.safeParse(narrative).success, false);
});

test("the schema's categories are exactly the insight order", () => {
  const parsed = narrativeSchema.safeParse({
    cards: [],
    brief: {
      opening: "x",
      observations: ["x"],
      questions: ["x"],
      watchPoints: ["x"],
      actions: ["x"],
      slideOrder: INSIGHT_ORDER,
    },
    summary: { headline: "x", paragraphs: ["x"] },
  });
  assert.ok(parsed.success);
});
