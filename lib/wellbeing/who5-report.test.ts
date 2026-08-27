import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildWellbeingReport } from "../reports/model.ts";
import {
  who5CutoffCopy,
  WHO5_CUTOFF_SOURCE_NOTE,
  WHO5_DISCLAIMER_LONG,
  WHO5_SCORE_MEANING,
} from "../../data/who5-content.ts";
import { WHO5_SUGGESTED_CUTOFF_PERCENTAGE } from "../../data/who5-items.ts";

/**
 * The WHO-5 participant report.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS NEEDED ITS OWN TESTS.
 *
 * `buildWellbeingReport` is shared, and it was GHQ-shaped in two ways that a
 * WHO-5 caller could not see:
 *
 *   · It hard-coded the scale label "GHQ-12 screening score", so a WHO-5
 *     report printed a 0–100 wellbeing figure under a GHQ-12 caption.
 *   · Its `ReportScale` field was named `atOrAboveThreshold`, which reads as a
 *     fact about the score rather than as "emphasise this". A caller passing
 *     its own at-or-above flag straight through would have painted strong
 *     WHO-5 wellbeing in the attention colour.
 *
 * Both are fixed — the label is per-caller, and the presentational flag is now
 * `emphasise`. These tests hold the fix in place.
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");

function who5Document(score: number) {
  const cutoff = WHO5_SUGGESTED_CUTOFF_PERCENTAGE;
  const outcome = who5CutoffCopy(score >= cutoff);
  return buildWellbeingReport({
    participantName: "Test Participant",
    completedAt: "2026-08-27T09:00:00.000Z",
    totalScore: score,
    maxScore: 100,
    threshold: cutoff,
    atOrAboveThreshold: score < cutoff,
    scoreLabel: "WHO-5 Well-Being Score",
    scoreMetaLabel: "WHO-5 score",
    thresholdMetaLabel: "Suggested threshold",
    outcomeHeadline: outcome.headline,
    outcomeBody: outcome.body,
    outcomeDetail: WHO5_CUTOFF_SOURCE_NOTE,
    scoreMeaning: WHO5_SCORE_MEANING,
    disclaimer: WHO5_DISCLAIMER_LONG,
    history: [],
    departmentAtCompletion: null,
    workLocationAtCompletion: null,
    officeLocationAtCompletion: null,
    questionnaireVersion: 1,
    scoringVersion: "1.0.0",
    attemptNumber: 1,
  });
}

const allText = (doc: ReturnType<typeof who5Document>) => JSON.stringify(doc);

/* ── 1 · it identifies the instrument it actually is ─────────────────── */

test("a WHO-5 report is labelled WHO-5, never GHQ", () => {
  const text = allText(who5Document(72));
  assert.ok(text.includes("WHO-5 Well-Being Score"), "the scale must name WHO-5");
  assert.ok(!text.includes("GHQ-12"), "a WHO-5 report must not mention GHQ-12");
  assert.ok(!text.includes("GHQ"), "nor GHQ at all");
});

test("the figure is reported on WHO-5's own 0–100 scale", () => {
  const doc = who5Document(72);
  const text = allText(doc);
  assert.ok(text.includes("72 / 100"), "the meta line must be out of 100, not out of 12");
  assert.ok(!text.includes("/ 12"), "GHQ's maximum must not appear");
});

/* ── 2 · direction ───────────────────────────────────────────────────── */

test("a strong WHO-5 score is NOT emphasised as the concern", () => {
  // 72 is comfortably above the cut-off. Under the old shared flag this was
  // painted in the attention tone — a participant told the opposite of their
  // own result.
  const doc = who5Document(72);
  const scale = findScale(doc);
  assert.equal(scale.emphasise, false, "good wellbeing must not be flagged");
});

test("a score below the cut-off IS emphasised", () => {
  const doc = who5Document(32);
  const scale = findScale(doc);
  assert.equal(scale.emphasise, true, "below the cut-off is WHO-5's noteworthy side");
});

test("the two sides get different copy, in the right direction", () => {
  const above = allText(who5Document(72));
  const below = allText(who5Document(32));
  assert.ok(above.includes("At or above the WHO-5 suggested threshold"));
  assert.ok(below.includes("Below the WHO-5 suggested threshold"));
  assert.ok(!above.includes("Below the WHO-5 suggested threshold"));
});

/* ── 3 · the cut-off keeps its provenance ────────────────────────────── */

test("the cut-off is attributed wherever it appears", () => {
  const text = allText(who5Document(32));
  assert.ok(text.includes("WHO/UCN/MSD/MHE/2024.1"), "the source document is named");
  assert.ok(
    text.includes("not an assessment made by DISC360"),
    "and it is not presented as our finding",
  );
});

test("the report carries WHO-5's disclaimer, not GHQ's", () => {
  const text = allText(who5Document(72));
  assert.ok(text.includes("not a diagnostic instrument"));
  assert.ok(text.includes("CC BY-NC-SA 3.0 IGO"), "the licence travels with the content");
  assert.ok(text.includes("private to you"));
});

test("no organisational analytics appear in an individual report", () => {
  const text = allText(who5Document(72)).toLowerCase();
  for (const forbidden of ["cohort", "median", "percentile", "team average", "compared with"]) {
    assert.ok(!text.includes(forbidden), `an individual report must not contain "${forbidden}"`);
  }
});

/* ── 4 · the shared renderer no longer assumes a direction ───────────── */

test("the presentational flag is named for what it does, not for a direction", () => {
  const model = read("lib/reports/model.ts");
  assert.match(model, /emphasise\?: boolean;/, "ReportScale carries `emphasise`");
  const scaleBlock = model
    .slice(
      model.indexOf("export interface ReportScale"),
      model.indexOf("export interface ReportSeriesPoint"),
    )
    // Comments stripped: the field's doc-comment deliberately explains what it
    // used to be called and why that was wrong.
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
  assert.ok(
    !/atOrAboveThreshold/.test(scaleBlock),
    "a directional name on a presentational flag is what inverted WHO-5",
  );
  const pdf = read("lib/reports/pdf.ts");
  assert.match(pdf, /scale\.emphasise \? PULSE_ATTENTION : PULSE/);
});

test("the report builder routes WHO-5 to its own branch", () => {
  const report = read("lib/wellbeing/report.ts");
  assert.match(
    report,
    /if \(record\.instrumentKey === "who5"\) \{/,
    "WHO-5 must not fall through to the GHQ branch",
  );
  const branch = report.slice(
    report.indexOf('if (record.instrumentKey === "who5")'),
    report.indexOf("const outcome = outcomeCopy("),
  );
  assert.match(branch, /atOrAboveThreshold: score < cutoff/, "emphasis is inverted for WHO-5");
  assert.match(branch, /scoreLabel: "WHO-5 Well-Being Score"/);
  assert.ok(!/SCORE_MEANING\b(?<!WHO5_SCORE_MEANING)/.test(branch));
});

function findScale(doc: ReturnType<typeof who5Document>) {
  for (const section of doc.sections) {
    if (section.scale) return section.scale;
  }
  throw new Error("no scale section in the document");
}
