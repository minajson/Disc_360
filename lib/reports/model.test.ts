import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCombinedReport, buildDiscReport, buildFocusReport } from "./model.ts";
import type { ReportDocument, ReportSection } from "./model.ts";
import { insightMap } from "../../data/insight-maps.ts";
import type { FocusResult } from "../scoring/focus.ts";
import type { DiscScores } from "../types/index.ts";

const SCORES: DiscScores = { d: 82, i: 48, s: 30, c: 64 };
const COMPLETED_AT = "2026-03-04T10:15:00.000Z";

const FOCUS: FocusResult = {
  scores: { automaticity: 62, distraction: 71, mentalLoad: 68, recovery: 44 },
  patternCode: "responsive_multitasker",
  primaryLoop: "messages",
  notificationPattern: "immediate",
  energyPattern: "post_lunch",
  preferredReset: "movement",
};

const disc = () =>
  buildDiscReport({
    participantName: "Mina Allison",
    completedAt: COMPLETED_AT,
    scores: SCORES,
    archetypeCode: "DC",
    primary: "D",
    secondary: "C",
  });

const focus = () =>
  buildFocusReport({
    participantName: "Mina Allison",
    completedAt: COMPLETED_AT,
    focus: FOCUS,
  });

const combined = () =>
  buildCombinedReport({
    participantName: "Mina Allison",
    completedAt: COMPLETED_AT,
    scores: SCORES,
    archetypeCode: "DC",
    primary: "D",
    secondary: "C",
    focus: FOCUS,
  });

/** Every rendered string in a document, for content assertions. */
function allText(document: ReportDocument): string {
  const fromSection = (section: ReportSection): string[] => [
    section.title,
    section.lead ?? "",
    ...(section.paragraphs ?? []),
    ...(section.bullets ?? []),
    ...(section.columns ?? []).flatMap((column) => [column.heading, ...column.bullets]),
    ...(section.bars ?? []).flatMap((bar) => [bar.label, bar.note ?? "", String(bar.value)]),
  ];
  return [
    document.participantName,
    document.productLabel,
    document.eyebrow,
    document.headline,
    document.summary,
    document.disclaimer,
    ...document.meta.flatMap((item) => [item.label, item.value]),
    ...document.sections.flatMap(fromSection),
  ].join("\n");
}

test("the DISC report carries the participant's own scores, unaltered", () => {
  const document = disc();
  const bars = document.sections.find((section) => section.bars)?.bars ?? [];
  assert.deepEqual(
    bars.map((bar) => bar.value),
    [82, 48, 30, 64],
    "scores are passed through, never recomputed",
  );
  assert.deepEqual(
    bars.map((bar) => bar.tone),
    ["D", "I", "S", "C"],
  );
  assert.equal(document.participantName, "Mina Allison");
});

test("the DISC report reads its prose from the insight map", () => {
  const document = disc();
  assert.equal(document.headline, insightMap.DC.name);
  assert.equal(document.summary, insightMap.DC.summary);
  const strengths = document.sections.find((section) => section.title === "Strengths");
  assert.equal(strengths?.bullets?.length, insightMap.DC.strengths.length);
});

test("a stored snapshot wins over today's insight map, so history stays readable", () => {
  const snapshot = { ...insightMap.DC, name: "The Archived Reading", summary: "As written then." };
  const document = buildDiscReport({
    participantName: "Mina Allison",
    completedAt: COMPLETED_AT,
    scores: SCORES,
    archetypeCode: "DC",
    primary: "D",
    secondary: "C",
    insight: snapshot,
  });
  assert.equal(document.headline, "The Archived Reading");
  assert.equal(document.summary, "As written then.");
});

test("the Analytical dimension never renders as C, and never as Conscientiousness", () => {
  const text = allText(disc());
  assert.match(text, /Analytical/);
  assert.ok(!/Conscientiousness/.test(text), "no Conscientiousness");
  assert.ok(!/Steadiness/.test(text), "no Steadiness");
  assert.ok(!/Dominance/.test(text), "no Dominance");
  // DC renders as DA for the reader; the internal code stays C.
  assert.match(disc().eyebrow, /DA/);
  assert.ok(!/·\s*DC\b/.test(disc().eyebrow), "no internal blend code on the page");
});

test("the Focus report carries its four measures and its recommendations", () => {
  const document = focus();
  const bars = document.sections.find((section) => section.bars)?.bars ?? [];
  assert.deepEqual(
    bars.map((bar) => bar.value),
    [62, 71, 68, 44],
  );
  const recommendations = document.sections.find(
    (section) => section.title === "Three things to try",
  );
  assert.equal(recommendations?.bullets?.length, 3);
});

test("the combined report contains both halves plus the interaction reading", () => {
  const document = combined();
  const text = allText(document);
  assert.match(text, /Behaviour × attention/);
  assert.match(text, new RegExp(insightMap.DC.name));
  assert.match(text, /Responsive Multitasker/);
  // Both score sets survive into one document.
  const values = document.sections.flatMap((section) => section.bars ?? []).map((bar) => bar.value);
  for (const expected of [82, 48, 30, 64, 62, 71, 68, 44]) {
    assert.ok(values.includes(expected), `missing score ${expected}`);
  }
});

test("an individual report contains no facilitator-only or team-aggregate surface", () => {
  // Vocabulary that only the team/facilitator modules produce. (The word
  // "team" on its own is not a leak — the archetype coaching copy legitimately
  // says things like "tells your team"; it is about the reader, not about a
  // roster.)
  const forbidden = [
    /facilitator/i,
    /roster/i,
    /pairing/i,
    /presentation mode/i,
    /session card/i,
    /team average/i,
    /team map/i,
    /across the team/i,
    /other participants/i,
    /culture summary/i,
    /communication gaps/i,
  ];
  for (const [label, document] of [
    ["disc", disc()],
    ["focus", focus()],
    ["combined", combined()],
  ] as const) {
    const text = allText(document);
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(text), `${label} report leaked ${pattern} — ${text.match(pattern)}`);
    }
  }
});

test("an individual report carries no identifiers — no email, no id, no one else", () => {
  for (const [label, document] of [
    ["disc", disc()],
    ["focus", focus()],
    ["combined", combined()],
  ] as const) {
    const text = allText(document);
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(text), `${label} report contains an email address`);
    assert.ok(
      !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text),
      `${label} report contains a uuid`,
    );
  }
});

test("two participants with identical results differ ONLY by name", () => {
  // Nothing outside the participant's own row can reach the document: given
  // the same scores, the only difference between two people's reports is who
  // it is addressed to. A team, department or cohort figure creeping in later
  // fails here.
  const one = allText(disc());
  const two = allText(
    buildDiscReport({
      participantName: "Other Person",
      completedAt: COMPLETED_AT,
      scores: SCORES,
      archetypeCode: "DC",
      primary: "D",
      secondary: "C",
    }),
  );
  assert.equal(one.replaceAll("Mina Allison", "NAME"), two.replaceAll("Other Person", "NAME"));
  assert.ok(!two.includes("Mina Allison"), "one participant's report named another");
});

test("every report states the non-clinical disclaimer", () => {
  for (const document of [disc(), focus(), combined()]) {
    assert.match(document.disclaimer, /not a (medical|diagnosis)|not a medical/i);
  }
  assert.match(disc().disclaimer, /employment-selection/);
});
