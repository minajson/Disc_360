import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RATE_LIMIT,
  checkNarrative,
  payloadLeaks,
  rateDecision,
  type NarrativePayload,
} from "./policy.ts";

/* ── rate limiting ──────────────────────────────────────────────────── */

test("generations are allowed up to the limit and refused at it", () => {
  assert.equal(rateDecision(0).allowed, true);
  assert.equal(rateDecision(RATE_LIMIT - 1).allowed, true);
  assert.equal(rateDecision(RATE_LIMIT).allowed, false);
  assert.equal(rateDecision(RATE_LIMIT + 50).allowed, false);
});

test("remaining never goes negative and a refusal explains itself", () => {
  const over = rateDecision(RATE_LIMIT + 10);
  assert.equal(over.remaining, 0);
  assert.ok(over.reason);
  assert.match(over.reason!, /limit/);
  // The refusal must point at the fallback rather than dead-ending.
  assert.match(over.reason!, /evidence-based insights remain available/);
  assert.equal(rateDecision(0).reason, null);
});

test("a negative count is treated as zero rather than granting extra quota", () => {
  const decision = rateDecision(-5);
  assert.equal(decision.used, 0);
  assert.equal(decision.remaining, RATE_LIMIT);
});

/* ── payload minimisation ───────────────────────────────────────────── */

const payload: NarrativePayload = {
  scopeKind: "team",
  cards: [
    {
      category: "snapshot",
      title: "A Stable–Analytical pattern",
      observation: "Across 82 completed profiles, Stable averages 64.",
      interpretation: ["a preference for structure", "consistency and follow-through"],
      evidence: [
        { metric: "S average", value: "64" },
        { metric: "A average", value: "61" },
      ],
      signal: "strong",
      sampleSize: 82,
      populationSize: 96,
    },
  ],
};

test("the sanctioned payload carries nothing identifying", () => {
  assert.deepEqual(payloadLeaks(payload), []);
});

test("any identifying field added to the payload is caught", () => {
  for (const leak of [
    { ...payload, teamName: "Applications & ERP Team" },
    { ...payload, cards: [{ ...payload.cards[0]!, department: "ERP" }] },
    { ...payload, members: [{ name: "Ada Bello" }] },
    { ...payload, cards: [{ ...payload.cards[0]!, notes: "spoke to Ada" }] },
    { ...payload, participants: ["a@b.com"] },
  ]) {
    assert.ok(payloadLeaks(leak).length > 0, JSON.stringify(leak).slice(0, 80));
  }
});

test("the leak check reaches nested structures, not just the top level", () => {
  const nested = { scopeKind: "team", cards: [{ deep: { inner: { email: "x@y.z" } } }] };
  const leaks = payloadLeaks(nested);
  assert.equal(leaks.length, 1);
  assert.match(leaks[0]!, /cards\[0\]\.deep\.inner\.email/);
});

test("null and undefined values do not crash the walk", () => {
  assert.deepEqual(payloadLeaks({ a: null, b: undefined, c: [null] }), []);
  assert.deepEqual(payloadLeaks(null), []);
});

/* ── narrative acceptance ───────────────────────────────────────────── */

const good = {
  headline: "A team that prefers evidence before commitment",
  observation:
    "Stable averages 64 and Analytical 61 across 82 completed profiles, with Dominant lowest at 45.",
  interpretation: [
    "structure and considered decision-making are likely to feel normal here",
    "responses to rapid change may be slower than the calendar assumes",
  ],
};

test("a well-formed narrative is accepted", () => {
  assert.deepEqual(checkNarrative(good), { ok: true, problems: [] });
});

test("clinical language is rejected however it arrives", () => {
  for (const word of [
    "This team shows symptoms of avoidance",
    "A diagnosis of low engagement",
    "Members may need therapy",
    "The group has a pathological aversion to risk",
  ]) {
    const result = checkNarrative({ ...good, observation: word });
    assert.equal(result.ok, false, word);
    assert.ok(result.problems.some((p) => p.includes("forbidden register")));
  }
});

test("selection and performance language is rejected", () => {
  for (const line of [
    "The weakest member should be removed",
    "Use this for your next hire",
    "Two people are poor performers",
    "This should inform promotion decisions",
  ]) {
    assert.equal(checkNarrative({ ...good, headline: line }).ok, false, line);
  }
});

test("causal claims are rejected", () => {
  const result = checkNarrative({
    ...good,
    interpretation: ["the low score is caused by poor onboarding", "and it proves the point"],
  });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.includes("causal claim")));
});

test("structurally empty or thin output is rejected", () => {
  assert.equal(checkNarrative({ ...good, headline: "   " }).ok, false);
  assert.equal(checkNarrative({ ...good, observation: "" }).ok, false);
  assert.equal(checkNarrative({ ...good, interpretation: ["only one"] }).ok, false);
  assert.equal(checkNarrative({ ...good, interpretation: [] }).ok, false);
});

test("runaway lengths are rejected so a slide cannot become a wall of text", () => {
  assert.equal(checkNarrative({ ...good, headline: "x".repeat(141) }).ok, false);
  assert.equal(checkNarrative({ ...good, observation: "x".repeat(701) }).ok, false);
  assert.equal(
    checkNarrative({ ...good, interpretation: ["ok line here", "x".repeat(401)] }).ok,
    false,
  );
});

test("every problem is reported, not just the first", () => {
  const result = checkNarrative({
    headline: "",
    observation: "This proves a diagnosis of dysfunction",
    interpretation: ["one"],
  });
  assert.equal(result.ok, false);
  assert.ok(result.problems.length >= 3, result.problems.join(" | "));
});
