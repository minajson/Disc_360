import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildWellbeingAggregateReport,
  ILLUSTRATIVE_REPORT_BANNER,
  type WellbeingAggregateReportInput,
} from "./wellbeing-aggregate.ts";

const base = (over: Partial<WellbeingAggregateReportInput> = {}): WellbeingAggregateReportInput => ({
  organizationName: "Meridian Group",
  campaignName: "Q3 Executive Offsite",
  instrumentName: "DISC360 Wellbeing Pulse",
  instrumentDescriptor: "Workplace wellbeing monitoring and reflection",
  scoreLabel: "Wellbeing Index",
  scoreMin: 0,
  scoreMax: 100,
  scoreDirectionNote: "A higher index means more of the experience described was reported.",
  asOf: "2026-06-15T10:00:00.000Z",
  invited: 71,
  participants: 59,
  responses: 236,
  participation: 83.1,
  median: 66,
  mean: 65.7,
  distribution: [
    { label: "40–49", count: 5 },
    { label: "50–59", count: 54 },
    { label: "60–69", count: 99 },
    { label: "70–79", count: 62 },
    { label: "80–89", count: 16 },
  ],
  threshold: null,
  atOrAboveThresholdShare: null,
  medianMovement: "The median is 4 points lower than the previous comparable pulse.",
  cohortLabel: "Department / Function",
  cohorts: [
    { label: "Operations", participants: 14, median: 60, suppressed: false },
    { label: "Engineering", participants: 11, median: 63, suppressed: false },
    { label: "Legal", participants: null, median: null, suppressed: true },
    { label: "Procurement", participants: null, median: null, suppressed: true },
  ],
  dimensions: [
    { label: "Capacity", median: 66 },
    { label: "Recovery & Demand", median: 59 },
  ],
  dimensionsLabel: "Dimension profile",
  dimensionsMax: 100,
  waves: [
    { label: "Q3 2025", median: 64, participants: 55 },
    { label: "Q4 2025", median: 65, participants: 57 },
    { label: "Q1 2026", median: 66, participants: 59 },
  ],
  thresholdChanged: false,
  signals: [
    {
      priority: "Emerging pattern",
      observation: "Recovery & Demand has remained lower across 3 waves.",
      evidence: "Median 61 → 59 → 58.",
      mayMean: "The pattern is persistent rather than a single-wave fluctuation.",
      considerExploring: "Workload and recovery opportunity.",
    },
  ],
  minCohort: 7,
  isDemo: false,
  fullySuppressed: false,
  ...over,
});

/** Every string the document would render. */
function allText(input: WellbeingAggregateReportInput): string {
  const doc = buildWellbeingAggregateReport(input);
  const parts: string[] = [
    doc.participantName,
    doc.productLabel,
    doc.eyebrow,
    doc.headline,
    doc.summary,
    doc.disclaimer,
    ...doc.meta.flatMap((m) => [m.label, m.value]),
  ];
  for (const section of doc.sections) {
    parts.push(section.title, section.lead ?? "");
    parts.push(...(section.paragraphs ?? []), ...(section.bullets ?? []));
    for (const column of section.columns ?? []) parts.push(column.heading, ...column.bullets);
    for (const bar of section.bars ?? []) parts.push(bar.label, bar.note ?? "", String(bar.value));
    for (const point of section.series?.points ?? []) parts.push(point.label, String(point.value));
  }
  return parts.join(" \n ");
}

/* ── privacy ─────────────────────────────────────────────────────────── */

test("the aggregate report carries no participant identifier of any kind", () => {
  const text = allText(base()).toLowerCase();
  for (const term of ["@", "profile_id", "session_id", "participant name", "roster"]) {
    assert.ok(!text.includes(term), `the aggregate report must not contain "${term}"`);
  }
});

test("the input type has nowhere to put an identifier", () => {
  // Compile-time is the real guarantee; this asserts the shape has not grown
  // a field that a future edit could fill with a name or an address.
  const input = base() as unknown as Record<string, unknown>;
  for (const forbidden of ["names", "emails", "participantsList", "roster", "responses_raw"]) {
    assert.ok(!(forbidden in input), `the input must not accept ${forbidden}`);
  }
});

test("a suppressed cohort's figures are ABSENT, not merely unlabelled", () => {
  const doc = buildWellbeingAggregateReport(base());
  const comparison = doc.sections.find((s) => s.title.startsWith("Comparison"))!;
  const barLabels = (comparison.bars ?? []).map((bar) => bar.label);
  assert.ok(!barLabels.includes("Legal"), "a withheld cohort has no bar");
  assert.ok(!barLabels.includes("Procurement"));
  // And no number for them appears anywhere in the document.
  const text = allText(base());
  assert.ok(!/Legal[^.]*\b\d/.test(text), "no figure may sit beside a withheld cohort");
});

test("the withheld count is stated but the hidden n never is", () => {
  const text = allText(base());
  assert.match(text, /2 of 4 groups are withheld/);
  assert.match(text, /worked out by subtraction/);
});

test("whole-organisation suppression produces a short, honest report", () => {
  const doc = buildWellbeingAggregateReport(base({ fullySuppressed: true }));
  assert.equal(doc.headline, "Not yet reportable");
  const text = allText(base({ fullySuppressed: true }));
  assert.ok(!text.includes("Median Wellbeing Index 66"), "no figure survives full suppression");
  assert.ok(!/\bn = \d/.test(text), "no cohort size is published either");
});

/* ── instrument awareness ────────────────────────────────────────────── */

test("an instrument with no dimensions gets no dimensions page", () => {
  const doc = buildWellbeingAggregateReport(base({ dimensions: [] }));
  assert.ok(!doc.sections.some((s) => s.title === "Dimension profile"));
});

test("an instrument with no threshold states that, and shows no cut-off", () => {
  const text = allText(base({ threshold: null }));
  assert.match(text, /no validated cut-off/);
  assert.ok(!/threshold of \d/.test(text));
});

test("an instrument with a threshold reports prevalence without diagnosing", () => {
  const text = allText(
    base({ threshold: 4, atOrAboveThresholdShare: 31, scoreLabel: "GHQ-12 screening score", scoreMax: 12 }),
  );
  assert.match(text, /31% of responses sit at or above the configured threshold of 4/);
  assert.match(text, /establishes nothing about any individual/);
});

test("a threshold change suppresses the prevalence line rather than drawing it", () => {
  const doc = buildWellbeingAggregateReport(base({ threshold: 4, thresholdChanged: true }));
  const trend = doc.sections.find((s) => s.title === "Movement across waves")!;
  assert.equal(trend.series?.threshold, undefined, "no threshold rule across a policy change");
  assert.match((trend.paragraphs ?? []).join(" "), /screening threshold changed/i);
});

test("a single wave produces no trend page", () => {
  const doc = buildWellbeingAggregateReport(base({ waves: [{ label: "Q1", median: 66, participants: 59 }] }));
  assert.ok(!doc.sections.some((s) => s.title === "Movement across waves"));
});

/* ── demo labelling ──────────────────────────────────────────────────── */

test("a demo report is labelled illustrative on the cover and in the method", () => {
  const doc = buildWellbeingAggregateReport(base({ isDemo: true }));
  assert.equal(doc.eyebrow, ILLUSTRATIVE_REPORT_BANNER);
  assert.ok(doc.meta.some((m) => m.value === ILLUSTRATIVE_REPORT_BANNER));
  const text = allText(base({ isDemo: true }));
  const occurrences = text.split(ILLUSTRATIVE_REPORT_BANNER).length - 1;
  assert.ok(occurrences >= 3, "the label must survive being read from any page");
});

test("a live report is never labelled illustrative", () => {
  const text = allText(base({ isDemo: false }));
  assert.ok(!text.includes(ILLUSTRATIVE_REPORT_BANNER));
});

/* ── the document says what it is ────────────────────────────────────── */

test("the document declares itself aggregate, so its metadata cannot claim otherwise", () => {
  const doc = buildWellbeingAggregateReport(base());
  assert.equal(doc.audience, "aggregate");
  assert.equal(doc.product, "wellbeing");
  assert.equal(doc.participantName, "Q3 Executive Offsite", "the campaign, never a person");
});

test("participants and responses are reported as different things", () => {
  const text = allText(base());
  assert.match(text, /59 people have completed/);
  assert.match(text, /236 responses in total/);
  assert.match(text, /83\.1% of the 71 people invited/);
});

test("no page claims a cause, and every mention of diagnosis denies one", () => {
  const text = allText(base({ threshold: 4, atOrAboveThresholdShare: 31 })).toLowerCase();

  // Causal and judgemental language must be absent outright.
  for (const term of ["caused by", "because of", "unhealthy", "at risk", "high risk"]) {
    assert.ok(!text.includes(term), `the report must not say "${term}"`);
  }

  // "Diagnosis" may appear ONLY inside a denial — screening the bare word
  // would flag the disclaimer that exists to prevent the very claim.
  const mentions = [...text.matchAll(/[^.]*diagnos[^.]*\./g)].map((match) => match[0]);
  assert.ok(mentions.length > 0, "the report must disclaim diagnosis somewhere");
  for (const sentence of mentions) {
    assert.match(
      sentence,
      /\b(do not|does not|is not|are not|never)\b/,
      `every mention of diagnosis must deny one — found: "${sentence.trim()}"`,
    );
  }
});

/* ── the distribution fits on its page ───────────────────────────────── */

test("empty range at the ends is trimmed, and the trim is disclosed", () => {
  // A 0–28 scale with responses only in 0–8 printed twenty empty buckets and
  // spilled the chart onto a second page containing nothing but zeros.
  const distribution = Array.from({ length: 29 }, (_, score) => ({
    label: String(score),
    count: score >= 1 && score <= 8 ? 10 : 0,
  }));
  const doc = buildWellbeingAggregateReport(
    base({ distribution, scoreMax: 28, scoreLabel: "GHQ-28 screening score" }),
  );
  const overall = doc.sections.find((s) => s.title === "Overall pattern")!;
  assert.equal(overall.bars?.length, 8, "only the occupied range is drawn");
  assert.match(
    (overall.paragraphs ?? []).join(" "),
    /full scale runs 0–28/,
    "the trim must be disclosed so the reader is not misled about the scale",
  );
});

test("interior zeros are kept, because a gap is part of the shape", () => {
  const distribution = [
    { label: "0", count: 5 },
    { label: "1", count: 0 },
    { label: "2", count: 7 },
  ];
  const doc = buildWellbeingAggregateReport(base({ distribution }));
  const overall = doc.sections.find((s) => s.title === "Overall pattern")!;
  assert.equal(overall.bars?.length, 3, "an interior gap is data, not dead range");
});

test("a subscale is drawn against its OWN ceiling, not the instrument total", () => {
  // GHQ-28 subscales are seven items each while the total runs 0–28. Drawing
  // them against 28 rendered every subscale as a sliver.
  const doc = buildWellbeingAggregateReport(
    base({
      scoreMax: 28,
      dimensionsMax: 7,
      dimensionsLabel: "Subscale profile",
      dimensions: [
        { label: "Somatic symptoms", median: 3 },
        { label: "Anxiety / insomnia", median: 2 },
      ],
    }),
  );
  const profile = doc.sections.find((s) => s.title === "Subscale profile")!;
  for (const bar of profile.bars ?? []) {
    assert.equal(bar.max, 7, "a subscale bar must use the subscale maximum");
  }
});
