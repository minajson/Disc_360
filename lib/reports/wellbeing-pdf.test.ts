import assert from "node:assert/strict";
import { test } from "node:test";
import { renderReportPdf } from "./pdf.ts";
import { buildWellbeingReport, type WellbeingReportInput } from "./model.ts";
import { reportFilename } from "./identity.ts";

/**
 * The Wellbeing Pulse PDF.
 *
 * Two things are being defended here. First, that the charts actually render:
 * the score scale and the history line are new primitives, and a report that
 * silently dropped them would still be a valid PDF. Second, that the personal
 * report stays personal — no organisational figure, no other instrument, and
 * no DISC360 branding on an artefact belonging to someone who has never used
 * DISC360.
 */

const GENERATED_AT = "2026-03-04T10:20:00.000Z";

const baseInput = (overrides: Partial<WellbeingReportInput> = {}): WellbeingReportInput => ({
  participantName: "Mina Allison",
  completedAt: "2026-03-04T10:15:00.000Z",
  totalScore: 5,
  maxScore: 12,
  threshold: 4,
  atOrAboveThreshold: true,
  outcomeHeadline: "At or above the current screening threshold",
  outcomeBody:
    "Your responses are at or above the current GHQ-12 screening threshold and indicate more recent difficulty than usual across several wellbeing areas.",
  outcomeDetail: "Many people score here at some point, and it can move a great deal.",
  scoreMeaning: "The score counts how many of the twelve areas you described as harder than usual.",
  disclaimer: "GHQ-12 is a screening questionnaire and does not provide a diagnosis.",
  history: [
    { completedAt: "2026-01-10T09:00:00.000Z", totalScore: 2, threshold: 4 },
    { completedAt: "2026-03-04T10:15:00.000Z", totalScore: 5, threshold: 4 },
  ],
  movementLabel: "Higher than your previous pulse",
  movementDetail: "Your score is 3 points higher than your previous pulse.",
  movementCaveat: "Scores move around for all sorts of everyday reasons.",
  departmentAtCompletion: "Production",
  workLocationAtCompletion: "Office Based",
  officeLocationAtCompletion: "Port Harcourt",
  questionnaireVersion: 1,
  scoringVersion: "1.0.0",
  attemptNumber: 2,
  ...overrides,
});

const asText = (bytes: Uint8Array): string => Buffer.from(bytes).toString("latin1");

const render = (input: WellbeingReportInput) =>
  asText(renderReportPdf(buildWellbeingReport(input), { generatedAt: GENERATED_AT }));

/* ── it is a real PDF ───────────────────────────────────────────────── */

test("the wellbeing report renders a valid PDF", () => {
  const bytes = renderReportPdf(buildWellbeingReport(baseInput()), {
    generatedAt: GENERATED_AT,
  });
  const text = asText(bytes);
  assert.ok(text.startsWith("%PDF-1.4"), "PDF header");
  assert.ok(text.trimEnd().endsWith("%%EOF"), "PDF trailer");
  assert.ok(bytes.byteLength > 1500, "the file has real content");
});

test("rendering is deterministic for the same input", () => {
  assert.equal(render(baseInput()), render(baseInput()));
});

/* ── the charts are actually drawn ──────────────────────────────────── */

test("the score scale draws every cell of the 0–12 range", () => {
  const text = render(baseInput());
  // Thirteen cells plus the threshold rule; each is a filled rectangle.
  const rects = [...text.matchAll(/ re f/g)].length;
  assert.ok(rects >= 14, `expected at least 14 filled rects for the scale, saw ${rects}`);
  assert.ok(text.includes("5 / 12"), "the headline figure is printed");
  assert.ok(text.includes("Current screening threshold: 4"), "the threshold is labelled");
});

test("the history chart is drawn when more than one pulse exists", () => {
  const withHistory = render(baseInput());
  const single = render(
    baseInput({
      history: [{ completedAt: "2026-03-04T10:15:00.000Z", totalScore: 5, threshold: 4 }],
      movementLabel: undefined,
      movementDetail: undefined,
      movementCaveat: undefined,
    }),
  );
  assert.ok(withHistory.includes("Your pulses over time"), "the trend section is present");
  assert.ok(!single.includes("Your pulses over time"), "a first pulse has nothing to plot");
  assert.ok(withHistory.length > single.length, "the chart adds drawing operations");
  assert.ok(withHistory.includes("Threshold 4"), "the reference rule is labelled");
});

test("the trend plots only pulses up to and including this one", () => {
  // A report for an older result must not draw a line into the participant's
  // future; the loader slices history, and the builder plots what it is given.
  const document = buildWellbeingReport(baseInput());
  const series = document.sections.find((section) => section.series)?.series;
  assert.ok(series);
  assert.equal(series!.points.length, 2);
  assert.deepEqual(series!.points.map((point) => point.value), [2, 5]);
});

test("the threshold reaches the PDF as the value stored with the result", () => {
  const strict = render(baseInput({ threshold: 6, atOrAboveThreshold: false }));
  assert.ok(strict.includes("Current screening threshold: 6"));
  assert.ok(!strict.includes("Current screening threshold: 4"));
});

/* ── it stays a personal report ─────────────────────────────────────── */

test("the report is branded Wellbeing Pulse, not DISC360", () => {
  const text = render(baseInput());
  assert.ok(text.includes("Wellbeing"), "the wordmark is present");
  assert.ok(!text.includes("DISC360"), "no DISC360 branding on a Wellbeing Pulse report");
  assert.equal(reportFilename("Mina Allison", "wellbeing"), "Wellbeing_Mina_Allison_Pulse_Report.pdf");
});

test("the report carries the screening disclaimer", () => {
  assert.ok(render(baseInput()).includes("does not provide a diagnosis"));
});

test("the report contains no organisational or cohort figure", () => {
  const text = render(baseInput());
  for (const forbidden of ["median", "Median", "cohort", "organisation median", "percentile", "average"]) {
    assert.ok(!text.includes(forbidden), `a personal report must not mention ${forbidden}`);
  }
});

test("the Likert 0–36 measure never appears in the personal report", () => {
  const document = buildWellbeingReport(baseInput());
  const serialised = JSON.stringify(document);
  assert.ok(!/likert/i.test(serialised), "the secondary measure is not shown by default");
  assert.ok(!serialised.includes("36"), "no 0–36 figure reaches the report");
});

test("the context snapshot is printed as it was at completion", () => {
  const text = render(baseInput());
  assert.ok(text.includes("Production"));
  assert.ok(text.includes("Office Based"));
  assert.ok(text.includes("Port Harcourt"));
});

test("field-based work prints no office location", () => {
  const text = render(
    baseInput({ workLocationAtCompletion: "Field Based", officeLocationAtCompletion: null }),
  );
  assert.ok(text.includes("Field Based"));
  assert.ok(!text.includes("Port Harcourt"));
});

test("a below-threshold report is the same layout, not a softer one", () => {
  const below = buildWellbeingReport(
    baseInput({
      totalScore: 2,
      atOrAboveThreshold: false,
      outcomeHeadline: "Below the current screening threshold",
      outcomeBody: "Your responses are below the current GHQ-12 screening threshold.",
    }),
  );
  const above = buildWellbeingReport(baseInput());
  assert.deepEqual(
    below.sections.map((section) => section.title),
    above.sections.map((section) => section.title),
    "both outcomes get the same sections in the same order",
  );
});
