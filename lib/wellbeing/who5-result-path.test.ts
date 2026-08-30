import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { INSTRUMENTS } from "../../data/wellbeing-instruments.ts";
import {
  WHO5_SUGGESTED_CUTOFF_PERCENTAGE,
  WHO5_SUGGESTED_CUTOFF_RAW,
} from "../../data/who5-items.ts";
import {
  who5CutoffCopy,
  WHO5_BELOW_CUTOFF_BODY,
  WHO5_CUTOFF_SOURCE_NOTE,
  WHO5_DISCLAIMER_LONG,
  WHO5_SCORE_MEANING,
} from "../../data/who5-content.ts";
import { participantDisclaimerFor } from "../../data/wellbeing-content.ts";

/**
 * WHO-5 must never be interpreted by GHQ code.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE BUG THESE TESTS EXIST TO PREVENT COMING BACK.
 *
 * The result surface dispatched `disc360_wellbeing_v1` and sent EVERYTHING
 * ELSE to GhqResult. The completion action did the mirror image: it handled
 * `ghq12` and sent everything else to the DISC360 engine.
 *
 * Either one applied to WHO-5 inverts its meaning, because the instruments run
 * in opposite directions:
 *
 *   GHQ    higher = more reported distress   at/above threshold = noteworthy
 *   WHO-5  higher = better wellbeing         BELOW cut-off      = noteworthy
 *
 * So a participant reporting strong wellbeing would have been shown GHQ's
 * at-or-above-threshold language, in the attention colour — told the opposite
 * of their own result, in the one screen that is about them.
 *
 * A fall-through default is what made it possible in both places. These tests
 * assert the dispatches are exhaustive and that WHO-5's strings are its own.
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");
const RESULT_PAGE = "app/(wellbeing)/wellbeing/result/[resultId]/page.tsx";

/* ── 1 · the result surface routes WHO-5 to its own component ────────── */

test("WHO-5 has its own branch on the result page", () => {
  const page = read(RESULT_PAGE);
  assert.match(
    page,
    /record\.instrumentKey === "who5" \? \(\s*<Who5Result/,
    "WHO-5 must render Who5Result, not fall through",
  );
});

test("Who5Result shares no scale component with GHQ", () => {
  const page = read(RESULT_PAGE);
  const start = page.indexOf("function Who5Result");
  const end = page.indexOf("function who5MovementDetail");
  assert.ok(start > 0 && end > start, "Who5Result must exist");
  const body = page.slice(start, end);
  assert.match(body, /<Who5Scale/, "WHO-5 uses its own scale");
  assert.ok(!/<ScoreScale/.test(body), "ScoreScale is GHQ-shaped and must not be reused");
  assert.ok(!/outcomeCopy\(/.test(body), "GHQ outcome copy must not be reused");
  // GHQ's `SCORE_MEANING`, not WHO-5's own `WHO5_SCORE_MEANING`.
  assert.ok(!/(?<!WHO5_)\bSCORE_MEANING\b/.test(body), "GHQ score meaning must not be reused");
  assert.ok(!/(?<!WHO5_)\bRESULT_HEADING\b/.test(body), "GHQ heading must not be reused");
});

test("the WHO-5 disclaimer is WHO-5's own", () => {
  // Resolved per instrument rather than branched. The chain this replaced sent
  // GHQ-28 to GHQ-12's text, which names GHQ-12 in its opening words.
  const page = read(RESULT_PAGE);
  assert.match(page, /participantDisclaimerFor\(record\.instrumentKey\)/);
  assert.match(participantDisclaimerFor("who5"), /WHO-5/);
  assert.ok(!participantDisclaimerFor("who5").includes("GHQ"));
});

/* ── 2 · the scale reads in WHO-5's direction ────────────────────────── */

test("the WHO-5 scale treats BELOW the cut-off as the noteworthy side", () => {
  const scale = read("components/wellbeing/Who5Scale.tsx");
  assert.match(scale, /const belowCutoff = score < cutoff/);
  assert.match(
    scale,
    /tone = belowCutoff \? "var\(--color-pulse-attention\)"/,
    "attention belongs below the cut-off, the opposite of GHQ",
  );
  // Never colour alone.
  assert.match(scale, /sr-only/, "the reading must be available as text");
  // Whitespace-tolerant: the source wraps this sentence across lines.
  assert.match(
    scale.replace(/\s+/g, " "),
    /Higher scores mean better reported wellbeing/,
    "the direction must be stated in the screen-reader line",
  );
});

test("the WHO-5 scale does not take a GHQ-shaped atOrAbove flag", () => {
  const scale = read("components/wellbeing/Who5Scale.tsx");
  const props = scale.slice(scale.indexOf("export function Who5Scale"), scale.indexOf("const max = 100"));
  assert.ok(
    !/atOrAbove/.test(props),
    "a flag whose meaning flips between instruments must not cross this boundary",
  );
});

/* ── 3 · the completion dispatch is exhaustive ───────────────────────── */

test("every instrument is scored by its own engine", () => {
  const action = read("lib/actions/wellbeing.ts");
  const block = action.slice(action.indexOf("let scoredRow"), action.indexOf("const snapshot ="));
  assert.match(block, /instrumentKey === "ghq12"/);
  assert.match(block, /instrumentKey === "ghq28"/);
  assert.match(block, /instrumentKey === "who5"/);
  assert.match(block, /instrumentKey === "disc360_wellbeing_v1"/);
  assert.match(block, /computeWho5Result\(/, "WHO-5 must reach its own engine");
  assert.match(block, /computeGhq28Result\(/, "GHQ-28 must reach its own engine");
  // The fall-through that caused the bug must be gone.
  assert.match(
    block,
    /instrumentKey satisfies never/,
    "a new instrument must fail to compile rather than borrow another's engine",
  );
});

test("WHO-5 stores the published transform and its own cut-off", () => {
  const action = read("lib/actions/wellbeing.ts");
  const start = action.indexOf('instrumentKey === "who5"');
  const block = action.slice(start, action.indexOf('instrumentKey === "disc360_wellbeing_v1"', start));
  assert.match(block, /index_score: scored\.transformedScore/, "the 0-100 percentage is the index");
  assert.match(block, /total_score: scored\.rawScore/, "the raw 0-25 is the total");
  assert.match(block, /threshold_at_completion: WHO5_SUGGESTED_CUTOFF_PERCENTAGE/);
  /*
   * The flag is computed on the TRANSFORMED score against WHO's cut-off.
   *
   * This used to pin the literal expression
   * `scored.transformedScore >= WHO5_SUGGESTED_CUTOFF_PERCENTAGE`. The
   * comparison now goes through `atOrAboveThresholdFor`, which reads the scale
   * from the registry — so the database CHECK and this code cannot state the
   * rule differently. What is asserted is therefore the SEMANTICS, which is
   * what mattered all along: the cut-off meets the transformed score, and the
   * raw 0–25 total is never what is compared against 50.
   */
  assert.match(
    block,
    /at_or_above_threshold: atOrAboveThresholdFor\(/,
    "the flag must come from the registry's rule, not a restatement of it",
  );
  assert.match(block, /indexScore: scored\.transformedScore/);
  assert.match(block, /WHO5_SUGGESTED_CUTOFF_PERCENTAGE,\s*\)/);
  assert.doesNotMatch(
    block,
    /at_or_above_threshold:[^,]*rawScore\s*>=/,
    "50 is a number on the transformed scale; a 0-25 raw can never reach it",
  );
});

/* ── 4 · the language stays inside what WHO published ────────────────── */

test("no WHO-5 copy grades a person or names a condition", () => {
  const copy = [
    WHO5_SCORE_MEANING,
    WHO5_CUTOFF_SOURCE_NOTE,
    WHO5_DISCLAIMER_LONG,
    who5CutoffCopy(true).headline,
    who5CutoffCopy(true).body,
    who5CutoffCopy(false).headline,
    who5CutoffCopy(false).body,
  ].join(" ").toLowerCase();

  for (const forbidden of [
    "diagnos",       // catches diagnosis / diagnostic / diagnose, except the explicit denial below
    "depress",
    "mental illness",
    "disorder",
    "case",
    "unfit",
    "high risk",
    "at risk",
    "abnormal",
    "clinically",
    "patient",
    "symptom",
  ]) {
    if (forbidden === "diagnos") {
      // Every occurrence must sit inside a denial. Checked per-occurrence
      // rather than by counting two different patterns, which is what made
      // the first version of this assertion wrong.
      for (const match of copy.matchAll(/diagnos\w*/g)) {
        const preceding = copy.slice(Math.max(0, match.index - 24), match.index);
        assert.match(
          preceding,
          /\bnot (a |an )?$|\bnot\b[^.]{0,12}$/,
          `"${match[0]}" must be negated, but follows: "${preceding}"`,
        );
      }
      continue;
    }
    assert.ok(!copy.includes(forbidden), `WHO-5 copy must not contain "${forbidden}"`);
  }
});

test("the below-cut-off wording stays proportionate", () => {
  const body = WHO5_BELOW_CUTOFF_BODY.toLowerCase();
  assert.match(body, /suggested threshold/);
  assert.match(body, /further assessment/);
  assert.ok(!/you (are|have|may have|might have)\b/.test(body), "it must not tell somebody what they are");
  assert.ok(!/seek|contact|urgent|immediately/.test(body), "it prompts, it does not instruct");
});

test("the cut-off is never shown without its source", () => {
  assert.match(WHO5_CUTOFF_SOURCE_NOTE, /WHO\/UCN\/MSD\/MHE\/2024\.1/);
  assert.match(WHO5_CUTOFF_SOURCE_NOTE, /not an assessment made by DISC360/i);
  assert.ok(WHO5_CUTOFF_SOURCE_NOTE.includes(String(WHO5_SUGGESTED_CUTOFF_PERCENTAGE)));
  assert.ok(WHO5_CUTOFF_SOURCE_NOTE.includes(String(WHO5_SUGGESTED_CUTOFF_RAW)));
  // And the page renders it beside the outcome, not somewhere else.
  const page = read(RESULT_PAGE);
  const block = page.slice(page.indexOf("function Who5Result"), page.indexOf("function who5MovementDetail"));
  assert.match(block, /WHO5_CUTOFF_SOURCE_NOTE/);
});

test("movement is direction, never improvement or deterioration", () => {
  const page = read(RESULT_PAGE);
  const fn = page.slice(page.indexOf("function who5MovementDetail"), page.indexOf("/* ── GHQ"));
  assert.match(fn, /higher than your previous check-in/i);
  assert.match(fn, /lower than your previous check-in/i);
  for (const clinical of ["improv", "deteriorat", "worse", "better", "recover", "declin"]) {
    assert.ok(!fn.toLowerCase().includes(clinical), `movement copy must not say "${clinical}"`);
  }
});

/* ── 5 · registry agreement ──────────────────────────────────────────── */

test("the rendered cut-off is the registry's, which is the publication's", () => {
  assert.equal(INSTRUMENTS.who5.defaultThreshold, WHO5_SUGGESTED_CUTOFF_PERCENTAGE);
  assert.equal(INSTRUMENTS.who5.scoreDirection, "higher_is_stronger_wellbeing");
  assert.equal(INSTRUMENTS.who5.primaryScoreMax, 100);
});

/* ── the cut-off's source is never folded away ──────────────────────── */

test("the WHO-5 cut-off source note is visible, not inside the disclosure", () => {
  /*
   * The result page moved its longer explanation behind "Understand my
   * result", which is a closed <details> by default. The cut-off itself —
   * "Suggested threshold 50" — is printed on the scale, so folding away WHOSE
   * cut-off it is leaves a number on screen that the product appears to have
   * decided for itself. The rule is that the cut-off never appears without its
   * source, and a closed disclosure is not "appearing".
   *
   * The end-to-end suite caught this; this test is what stops it recurring
   * without a browser in the loop.
   */
  const page = readFileSync(
    new URL("../../app/(wellbeing)/wellbeing/result/[resultId]/page.tsx", import.meta.url),
    "utf8",
  );

  const who5 = page.slice(page.indexOf("function Who5Result"), page.indexOf("function who5MovementDetail"));
  const noteAt = who5.indexOf("WHO5_CUTOFF_SOURCE_NOTE");
  assert.ok(noteAt > -1, "the WHO-5 branch must render its cut-off source note");

  const disclosureAt = who5.indexOf("<Disclosure");
  assert.ok(disclosureAt > -1, "the WHO-5 branch has a disclosure to be outside of");
  assert.ok(
    noteAt < disclosureAt,
    "the cut-off source note must be rendered BEFORE the disclosure, where it is always visible",
  );
});
