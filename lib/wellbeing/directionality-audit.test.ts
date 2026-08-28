import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  INSTRUMENTS,
  INSTRUMENT_KEYS,
  higherIsBetter,
  sharesScale,
  scoreScaleId,
  type InstrumentKey,
} from "../../data/wellbeing-instruments.ts";
import { aggregateScores } from "./aggregate.ts";
import { participantDisclaimerFor } from "../../data/wellbeing-content.ts";

/**
 * Cross-instrument directionality audit.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ONE ROOT CAUSE, AUDITED IN ONE PLACE.
 *
 * Five separate defects in this codebase had the same shape: a SHARED surface
 * whose structure silently assumed GHQ's direction, applied to an instrument
 * that runs the other way.
 *
 *   · the result page dispatched DISC360 and sent everything else to GhqResult
 *   · the completion action dispatched GHQ-12 and sent everything else to the
 *     DISC360 engine
 *   · buildWellbeingReport hard-coded "GHQ-12 screening score" as its label
 *   · ReportScale.atOrAboveThreshold was a presentational flag with a
 *     directional name
 *   · aggregateScores counted "% at or above" for every instrument
 *
 * Each was fixed by REMOVING the assumption rather than adding a branch beside
 * it, because a branch leaves the trap set for the sixth instrument.
 *
 * This file is the standing audit. It asserts the declared semantics of every
 * instrument, and then asserts that each shared surface reads direction from
 * the registry instead of assuming one.
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");
/** Source with comments removed — a doc-comment explaining a rule is not a violation of it. */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");

const GHQ: InstrumentKey[] = ["ghq12", "ghq28"];

/* ── 1 · the declared semantics of each instrument ───────────────────── */

test("GHQ-12 and GHQ-28 interpret a HIGHER score as more concerning", () => {
  for (const key of GHQ) {
    const instrument = INSTRUMENTS[key];
    assert.equal(
      instrument.scoreDirection,
      "higher_is_more_distress",
      `${key} counts upward toward distress`,
    );
    assert.equal(higherIsBetter(key), false);
    assert.equal(instrument.hasThreshold, true, `${key} has a cut-off`);
  }
  assert.equal(INSTRUMENTS.ghq12.primaryScoreMax, 12);
  assert.equal(INSTRUMENTS.ghq28.primaryScoreMax, 28);
  assert.equal(INSTRUMENTS.ghq12.defaultThreshold, 4, "the 3/4 split");
  assert.equal(INSTRUMENTS.ghq28.defaultThreshold, 5, "the 4/5 split");
});

test("WHO-5 interprets a HIGHER score as better wellbeing", () => {
  const who5 = INSTRUMENTS.who5;
  assert.equal(who5.scoreDirection, "higher_is_stronger_wellbeing");
  assert.equal(higherIsBetter("who5"), true);
  assert.equal(who5.primaryScoreMax, 100, "the published percentage scale");
  assert.equal(who5.defaultThreshold, 50, "its documented suggested cut-off");
  assert.equal(who5.subscales.length, 0, "a single scale — no invented subscales");
});

test("DISC360 Wellbeing Pulse uses its own declared semantics", () => {
  const disc = INSTRUMENTS.disc360_wellbeing_v1;
  assert.equal(disc.scoreDirection, "higher_is_stronger_wellbeing");
  assert.equal(higherIsBetter("disc360_wellbeing_v1"), true);
  assert.equal(disc.primaryScoreMax, 100);
  // Deliberately ungraded: it is not validated, so it classifies nobody.
  assert.equal(disc.hasThreshold, false);
  assert.equal(disc.defaultThreshold, null);
  assert.equal(disc.subscales.length === 0, true, "its dimensions are not subscales of a total");
});

test("no two instruments share a scale, even where they share a range", () => {
  // WHO-5 and the DISC360 index are both 0–100 and both count upward. Sharing
  // a RANGE is exactly what makes them dangerous to each other.
  assert.equal(INSTRUMENTS.who5.primaryScoreMax, INSTRUMENTS.disc360_wellbeing_v1.primaryScoreMax);
  assert.equal(sharesScale("who5", "disc360_wellbeing_v1"), false);
  const ids = INSTRUMENT_KEYS.map(scoreScaleId);
  assert.equal(new Set(ids).size, ids.length, "every scale id is distinct");
});

/* ── 2 · threshold share, computed per direction ─────────────────────── */

test("the same cohort yields opposite shares under opposite directions", () => {
  const scores = [10, 20, 30, 40, 90];
  const distress = aggregateScores(scores, {
    threshold: 50,
    maxScore: 100,
    thresholdDirection: "at_or_above",
  });
  const wellbeing = aggregateScores(scores, {
    threshold: 50,
    maxScore: 100,
    thresholdDirection: "below",
  });
  assert.equal(distress.atOrAboveThreshold, 1);
  assert.equal(wellbeing.atOrAboveThreshold, 4);
  assert.equal(distress.thresholdLabel, "≥ 50");
  assert.equal(wellbeing.thresholdLabel, "< 50");
});

test("analytics derives direction from the registry, not from a key", () => {
  const analytics = code("lib/wellbeing/analytics.ts");
  const helper = analytics.slice(
    analytics.indexOf("function aggregateOptionsFor"),
    analytics.indexOf("export type CompareDimension"),
  );
  assert.match(helper, /scoreDirection === "higher_is_stronger_wellbeing"/);
  assert.ok(!/=== "who5"/.test(helper), "no per-key special case");
  assert.ok(!/=== "ghq12"/.test(helper), "nor the reverse");
});

/* ── 3 · above/below language and comparison labels ──────────────────── */

test("cohort comparison labels come from the aggregate, never hard-coded", () => {
  for (const path of [
    "components/wellbeing/analytics/CohortComparison.tsx",
    "components/wellbeing/analytics/CohortStrip.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /thresholdLabel/, `${path} must print the computed comparator`);
    assert.equal(
      (source.match(/≥\{threshold\}/g) ?? []).length,
      0,
      `${path} hard-codes a direction`,
    );
  }
});

test("the aggregate PDF describes the side it actually counted", () => {
  assert.match(code("lib/reports/wellbeing-aggregate.ts"), /thresholdPhrase \?\? "at or above"/);
  assert.match(
    code("lib/wellbeing/aggregate-report.ts"),
    /higher_is_stronger_wellbeing" \? "below" : "at or above"/,
  );
});

/* ── 4 · report emphasis ─────────────────────────────────────────────── */

test("the report's emphasis flag carries no direction in its name", () => {
  const model = read("lib/reports/model.ts");
  const scaleBlock = model
    .slice(
      model.indexOf("export interface ReportScale"),
      model.indexOf("export interface ReportSeriesPoint"),
    )
    .replace(/\/\*[\s\S]*?\*\//g, " ");
  assert.match(scaleBlock, /emphasise\?: boolean;/);
  assert.ok(!/atOrAboveThreshold/.test(scaleBlock));
  assert.match(code("lib/reports/pdf.ts"), /scale\.emphasise \? PULSE_ATTENTION : PULSE/);
});

test("each instrument decides its own emphasis at the call site", () => {
  const report = code("lib/wellbeing/report.ts");
  // WHO-5 emphasises BELOW its cut-off.
  const who5 = report.slice(
    report.indexOf('record.instrumentKey === "who5"'),
    report.indexOf("const outcome = outcomeCopy("),
  );
  assert.match(who5, /atOrAboveThreshold: score < cutoff/);
  // GHQ emphasises at or above.
  assert.match(report, /atOrAboveThreshold: record\.atOrAboveThreshold === true/);
});

/* ── 5 · participant reports and results are instrument-specific ─────── */

test("every instrument reaches its own result renderer", () => {
  const page = code("app/(wellbeing)/wellbeing/result/[resultId]/page.tsx");
  assert.match(page, /instrumentKey === "disc360_wellbeing_v1" \? \(/);
  assert.match(page, /instrumentKey === "who5" \? \(/);
  assert.match(page, /<GhqResult/);
  // And its own long-form disclaimer, resolved rather than branched — the
  // chain that used to be here sent GHQ-28 to GHQ-12's wording.
  assert.match(page, /participantDisclaimerFor\(record\.instrumentKey\)/);
});

test("the WHO-5 report names WHO-5 and reports out of 100", () => {
  const report = code("lib/wellbeing/report.ts");
  const who5 = report.slice(
    report.indexOf('record.instrumentKey === "who5"'),
    report.indexOf("const outcome = outcomeCopy("),
  );
  assert.match(who5, /maxScore: 100/);
  assert.match(who5, /scoreLabel: "WHO-5 Well-Being Score"/);
  assert.ok(!/WELLBEING_MAX_SCORE/.test(who5), "GHQ's maximum must not leak in");
});

/* ── 6 · scoring dispatch cannot fall through ────────────────────────── */

test("every instrument is scored by its own engine, exhaustively", () => {
  const action = code("lib/actions/wellbeing.ts");
  const block = action.slice(action.indexOf("let scoredRow"), action.indexOf("const snapshot ="));
  for (const key of INSTRUMENT_KEYS) {
    assert.ok(block.includes(`instrumentKey === "${key}"`), `${key} needs its own branch`);
  }
  assert.match(block, /instrumentKey satisfies never/, "a new instrument must fail to compile");
});

test("no scoring engine is reachable from another instrument's branch", () => {
  const action = code("lib/actions/wellbeing.ts");
  const engines: Record<InstrumentKey, string> = {
    ghq12: "computeWellbeingResult",
    ghq28: "computeGhq28Result",
    who5: "computeWho5Result",
    disc360_wellbeing_v1: "computeDiscWellbeingResult",
  };
  for (const [key, engine] of Object.entries(engines) as [InstrumentKey, string][]) {
    const start = action.indexOf(`instrumentKey === "${key}"`);
    assert.ok(start > 0, `${key} branch exists`);
    const branch = action.slice(start, start + 1400);
    assert.ok(branch.includes(engine), `${key} must call ${engine}`);
    for (const [otherKey, otherEngine] of Object.entries(engines) as [InstrumentKey, string][]) {
      if (otherKey === key) continue;
      assert.ok(
        !branch.slice(0, branch.indexOf("} else if") + 1 || branch.length).includes(otherEngine),
        `${key} branch must not call ${otherEngine}`,
      );
    }
  }
});

/* ── 7 · trend interpretation says direction, never health ───────────── */

test("movement copy describes direction, not clinical change", () => {
  const page = read("app/(wellbeing)/wellbeing/result/[resultId]/page.tsx");
  const fn = page.slice(
    page.indexOf("function who5MovementDetail"),
    page.indexOf("/* ── GHQ"),
  );
  for (const clinical of ["improv", "deteriorat", "recover", "declin", "worsen"]) {
    assert.ok(
      !fn.toLowerCase().includes(clinical),
      `WHO-5 movement copy must not say "${clinical}"`,
    );
  }
  assert.match(fn, /higher than your previous check-in/i);
  assert.match(fn, /lower than your previous check-in/i);
});

/* ── 8 · the registry is the single source of direction ──────────────── */

test("every instrument declares a direction, and only two values exist", () => {
  for (const key of INSTRUMENT_KEYS) {
    assert.ok(
      ["higher_is_more_distress", "higher_is_stronger_wellbeing"].includes(
        INSTRUMENTS[key].scoreDirection,
      ),
      `${key} must declare a known direction`,
    );
  }
});

test("a thresholded instrument always states what its threshold means", () => {
  for (const key of INSTRUMENT_KEYS) {
    const instrument = INSTRUMENTS[key];
    assert.equal(
      instrument.defaultThreshold !== null,
      instrument.hasThreshold,
      `${key}: hasThreshold and defaultThreshold must agree`,
    );
    if (instrument.hasThreshold) {
      assert.ok(
        instrument.thresholdDescription.length > 40,
        `${key} must explain its threshold, not just carry a number`,
      );
      assert.match(
        instrument.thresholdDescription,
        /not a diagnosis|not a finding|screening/i,
        `${key} must say what its threshold is NOT`,
      );
    }
  }
});

/* ── 9 · every instrument names ITSELF in its disclaimer ─────────────── */

test("no participant is told they took a different questionnaire", () => {
  // The seventh instance of the shared-surface bug, and the most visible: the
  // landing page and the result page both branched two ways — DISC360, or
  // "everything else". Everything else meant GHQ-12's text, which opens with
  // the words "GHQ-12 is a screening questionnaire". So WHO-5 and GHQ-28
  // participants were told, on their own result, that they had answered a
  // questionnaire they had not seen.
  const expectations: Record<InstrumentKey, RegExp> = {
    ghq12: /GHQ-12/,
    ghq28: /GHQ-28/,
    who5: /WHO-5/,
    disc360_wellbeing_v1: /DISC360|Wellbeing Pulse/,
  };
  for (const key of INSTRUMENT_KEYS) {
    const text = participantDisclaimerFor(key);
    assert.match(text, expectations[key], `${key} must name itself`);
    // And must not name another instrument.
    for (const other of INSTRUMENT_KEYS) {
      if (other === key) continue;
      const name = other === "disc360_wellbeing_v1" ? null : INSTRUMENTS[other].name;
      if (!name) continue;
      assert.ok(
        !text.includes(name),
        `${key}'s disclaimer must not mention ${name}`,
      );
    }
  }
});

test("both participant surfaces resolve the disclaimer, not a ternary", () => {
  for (const path of [
    "app/(wellbeing)/wellbeing/page.tsx",
    "app/(wellbeing)/wellbeing/result/[resultId]/page.tsx",
  ]) {
    const source = code(path);
    assert.match(source, /participantDisclaimerFor\(/, `${path} must use the resolver`);
    assert.ok(
      !/DISC_WELLBEING_DISCLAIMER_LONG\s*\n?\s*:/.test(source),
      `${path} still branches on disclaimers by hand`,
    );
  }
});

test("every disclaimer denies diagnosis", () => {
  for (const key of INSTRUMENT_KEYS) {
    assert.match(
      participantDisclaimerFor(key),
      /does not provide a diagnosis|is not a diagnos|not a diagnostic/i,
      `${key} must say plainly that it does not diagnose`,
    );
  }
});
