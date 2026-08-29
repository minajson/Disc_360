import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import {
  GHQ28_SECTION_D_INDICES,
  hasPositiveSectionD,
  isPositiveResponse,
} from "./ghq28-section-d.ts";
import { GHQ28_SECTION_D_ITEM_IDS } from "../../data/ghq28-content.ts";
import {
  ghq28SupportClinicallyApproved,
  ghq28SupportPathwayApproved,
  GHQ28_SUPPORT_APPROVAL_NOTE,
  GHQ28_SUPPORT_APPROVAL_STATE,
  GHQ28_SUPPORT_APPROVED,
  GHQ28_SUPPORT_BODY,
  GHQ28_SUPPORT_HEADING,
  GHQ28_SUPPORT_NEXT_STEPS,
  GHQ28_SUPPORT_PRIVACY_NOTE,
} from "../../data/ghq28-support-content.ts";
import {
  canReleaseExternally,
  canServeToParticipants,
  INSTRUMENTS,
  SUPPORT_PATHWAY_REQUIRED_MESSAGE,
} from "../../data/wellbeing-instruments.ts";

/**
 * The GHQ-28 Section D safeguard.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT IS BEING PROTECTED, IN BOTH DIRECTIONS.
 *
 * Section D asks directly about not wanting to live. Two failures are possible
 * and both are serious:
 *
 *   · Showing nothing to a participant who answered positively. The supplied
 *     guide requires professional evaluation to follow; the least this product
 *     can do is put support information in front of them.
 *
 *   · Letting that answer escape. The moment a facilitator, analytics query,
 *     email or audit row can see it, the confidentiality that makes an honest
 *     answer possible is gone — and this instrument asks the question that
 *     most depends on it.
 *
 * These tests hold both.
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");

const NONE = Array.from({ length: 28 }, () => 0);

/* ── 1 · detection ───────────────────────────────────────────────────── */

test("Section D is items 22–28, derived rather than hard-coded", () => {
  assert.deepEqual(GHQ28_SECTION_D_INDICES, [21, 22, 23, 24, 25, 26, 27]);
  assert.equal(GHQ28_SECTION_D_ITEM_IDS.length, 7);
});

test("positive means binary weight 1 — the third or fourth anchor", () => {
  assert.equal(isPositiveResponse(0), false, '"Not at all" is not positive');
  assert.equal(isPositiveResponse(1), false, '"No more than usual" is not positive');
  assert.equal(isPositiveResponse(2), true, '"Rather more than usual" is positive');
  assert.equal(isPositiveResponse(3), true, '"Much more than usual" is positive');
});

test("no positive Section D answer means no safeguard", () => {
  assert.equal(hasPositiveSectionD(NONE), false);
  // Distress elsewhere in the questionnaire does not trigger it: Sections A–C
  // are somatic, anxiety and social items, and this safeguard is about D.
  const elsewhere = [...NONE];
  for (let i = 0; i < 21; i += 1) elsewhere[i] = 3;
  assert.equal(hasPositiveSectionD(elsewhere), false);
});

test("any single positive Section D answer triggers it", () => {
  for (const index of GHQ28_SECTION_D_INDICES) {
    for (const position of [2, 3]) {
      const answers = [...NONE];
      answers[index] = position;
      assert.equal(
        hasPositiveSectionD(answers),
        true,
        `item index ${index} at position ${position} must trigger the safeguard`,
      );
    }
  }
});

test("a malformed or missing answer set never throws", () => {
  // This drives a supportive message. It must never be the reason somebody
  // cannot open their own result.
  assert.equal(hasPositiveSectionD(null), false);
  assert.equal(hasPositiveSectionD(undefined), false);
  assert.equal(hasPositiveSectionD([]), false);
  assert.equal(hasPositiveSectionD([0, 1, 2]), false);
});

/* ── 2 · it must not escape the participant's own result ─────────────── */

test("the safeguard is used on exactly one surface", () => {
  const callers = ["app", "lib", "components"]
    .flatMap((dir) => walk(new URL(`${dir}/`, ROOT)))
    .filter((file) => !file.endsWith(".test.ts"))
    .filter((file) => read(file).includes("hasPositiveSectionD"));
  assert.deepEqual(
    callers.sort(),
    ["app/(wellbeing)/wellbeing/result/[resultId]/page.tsx", "lib/wellbeing/ghq28-section-d.ts"],
    "only the participant's own result may consult Section D",
  );
});

test("it triggers no notification, alert, audit row or analytics event", () => {
  // Comments stripped first: the module deliberately EXPLAINS that it notifies
  // nobody, and a scan that banned the word would punish saying so.
  const code = read("lib/wellbeing/ghq28-section-d.ts")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
  for (const term of ["sendEmail", "audit_logs", ".insert(", "notify(", "track(", "fetch("]) {
    assert.ok(!code.includes(term), `the safeguard must not call ${term}`);
  }
});

test("analytics reads answers only in aggregate, behind suppression", () => {
  // Analytics DOES read `item_positions` — to build cohort-level item signals.
  // That is legitimate and is the product's purpose. What must never happen is
  // an individual's answers reaching a facilitator, so the properties asserted
  // here are: no profile identifier travels with them, and the signals are
  // computed only when the cohort is publishable.
  const analytics = read("lib/wellbeing/analytics.ts");
  const columns = /WELLBEING_ANALYTICS_COLUMNS =\s*\n?\s*"([^"]+)"/.exec(analytics)?.[1] ?? "";
  assert.ok(columns.includes("item_positions"), "the column list is the one under test");
  for (const identifier of ["profile_id", "session_id", "contact_email", "job_title"]) {
    assert.ok(
      !columns.includes(identifier),
      `analytics must not select ${identifier} alongside raw answers`,
    );
  }
  assert.match(
    analytics,
    /checkSlice\(counts\.overall, context\.minCohort\)\.publishable\s*\?\s*itemSignals\(/,
    "item signals must be gated on the cohort being publishable",
  );
});

test("the own-result query that reads them is scoped to the caller", () => {
  const queries = read("lib/wellbeing/queries.ts");
  const block = queries.slice(
    queries.indexOf("const RESULT_COLUMNS"),
    queries.indexOf("export async function loadOwnWellbeingResult"),
  );
  assert.ok(block.includes("item_positions"), "the own-result query reads them");
  assert.match(
    block,
    /\.eq\("profile_id", context\.user\.id\)/,
    "and is scoped to the caller's own rows — this is what makes reading them safe",
  );
});

/* ── 3 · the wording stays inside what it may say ────────────────────── */

test("the support copy makes no clinical claim", () => {
  const copy = [
    GHQ28_SUPPORT_HEADING,
    GHQ28_SUPPORT_BODY,
    GHQ28_SUPPORT_NEXT_STEPS,
    GHQ28_SUPPORT_PRIVACY_NOTE,
  ].join(" ").toLowerCase();

  for (const forbidden of [
    "you have",
    "you are at",
    "depression",
    "depressed",
    "suicidal",
    "mental illness",
    "disorder",
    "case",
    "risk of",
    "symptom",
  ]) {
    assert.ok(!copy.includes(forbidden), `support copy must not contain "${forbidden}"`);
  }
  // It must say the two things that are true and useful.
  assert.match(copy, /support is available/);
  assert.match(copy, /private to you/);
  assert.match(copy, /nobody has been notified/);
  // "diagnosis" may appear only in the denial.
  for (const m of copy.matchAll(/diagnos\w*/g)) {
    const before = copy.slice(Math.max(0, m.index - 16), m.index);
    assert.match(before, /\bnot (a |an )?$/, `"${m[0]}" must be negated, follows: "${before}"`);
  }
});

test("the approval is recorded as interim, not as clinical sign-off", () => {
  // The flag was flipped on 2026-08-29 under an INTERIM approval from the
  // engagement's Occupational Health facilitator, for internal user testing
  // only. That is a real authorisation to serve the safeguard — and it is NOT
  // clinical governance sign-off.
  //
  // A lone boolean cannot hold that difference, so the state is asserted too.
  // If someone later takes GHQ-28 to a customer, this is the test that says
  // out loud which approval they are relying on.
  assert.equal(GHQ28_SUPPORT_APPROVED, true);
  assert.equal(
    GHQ28_SUPPORT_APPROVAL_STATE,
    "interim_internal_test",
    "GHQ-28 support wording still carries only interim internal-test approval; " +
      "final clinical-governance sign-off is required before external rollout",
  );
  assert.match(GHQ28_SUPPORT_APPROVAL_NOTE, /clinical-governance sign-off is still required/i);
});

test("the participant wording names a route to urgent help without diagnosing", () => {
  const copy = `${GHQ28_SUPPORT_BODY} ${GHQ28_SUPPORT_NEXT_STEPS}`;

  // The approved wording must actually carry the safety route.
  assert.match(copy, /emergency/i, "no route to urgent help is offered");
  assert.match(copy, /Occupational Health/i, "the organisation's own support route is unnamed");
  assert.match(copy, /not a diagnosis/i, "the disclaimer is missing");

  // And must still refuse to label the person.
  for (const forbidden of [/suicid/i, /high[- ]risk/i, /at risk/i, /diagnos(ed|is of)/i, /disorder/i]) {
    assert.ok(!forbidden.test(copy), `support copy uses alarming or diagnostic language: ${forbidden}`);
  }
});

/**
 * THE CONNECTION BETWEEN THE SAFEGUARD AND THE QUESTIONNAIRE.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY BOTH HALVES ARE ASSERTED TOGETHER, AND WHY THIS TEST CHANGED SHAPE.
 *
 * GHQ-28's Section D asks directly about not wanting to live. The one response
 * this product can make is the support information on the participant's own
 * result — it cannot notify anybody, because an individual result is private
 * by design. So answering Section D positively and being shown nothing is the
 * exact failure the safeguard exists to prevent.
 *
 * This test used to say: while the wording is unapproved, GHQ-28 must not be
 * active. It opened with `if (GHQ28_SUPPORT_APPROVED) return;`, so when the
 * interim approval was recorded on 2026-08-29 the test began returning on its
 * first line and asserting nothing at all. It went green by evaporating, which
 * is worse than going red.
 *
 * And underneath it, the connection it described was never actually enforced.
 * `GHQ28_SUPPORT_APPROVED` was documented as gating "whether GHQ-28 may be
 * served to a participant at all", but its only reader was the result page,
 * which decides whether to RENDER the panel — after the participant has
 * already answered. The two switches were independent.
 *
 * `canServeToParticipants` now reads the pathway itself, so the rule is stated
 * as a BICONDITIONAL that holds in either direction: GHQ-28 serves if and only
 * if its support pathway may serve. Withdraw the approval, blank the copy, or
 * set an unrecognised approval state, and the questionnaire closes.
 * ─────────────────────────────────────────────────────────────────────
 */
test("GHQ-28 serves if and only if its Section D support pathway may serve", () => {
  const pathway = ghq28SupportPathwayApproved();

  for (const environment of [
    { isProduction: true, demoEnabled: false },
    { isProduction: true, demoEnabled: true },
    { isProduction: false, demoEnabled: false },
    { isProduction: false, demoEnabled: true },
  ]) {
    const decision = canServeToParticipants("ghq28", environment);

    if (!pathway) {
      assert.equal(
        decision.allowed,
        false,
        `GHQ-28 must not serve with an unapproved support pathway (${JSON.stringify(environment)})`,
      );
      continue;
    }

    // The pathway being approved does not open anything by itself — the
    // ordinary status and environment rules still decide. What it must never
    // do is be the reason a refusal happens while it is approved.
    if (!decision.allowed) {
      assert.notEqual(
        decision.reason,
        SUPPORT_PATHWAY_REQUIRED_MESSAGE,
        "the support pathway is approved, so it must not be the cause of a refusal",
      );
    }
  }

  // The other direction, stated as the thing a reviewer must never see true:
  // an instrument switched on while the safeguard behind it cannot serve.
  if (INSTRUMENTS.ghq28.status === "active") {
    assert.equal(
      pathway,
      true,
      "GHQ-28 is active while its Section D support wording cannot serve",
    );
  }
});

/**
 * The approval is a complete condition, not a lone boolean.
 *
 * Each part is asserted because each part is a different way the safeguard
 * could be hollowed out without anybody flipping the flag: an unrecognised
 * approval state, or approved copy that is empty.
 */
test("the support pathway requires approval, a known state, and copy that exists", () => {
  assert.equal(GHQ28_SUPPORT_APPROVED, true);
  assert.ok(
    GHQ28_SUPPORT_APPROVAL_STATE === "interim_internal_test" ||
      GHQ28_SUPPORT_APPROVAL_STATE === "clinical_governance",
    "an unrecognised approval state must never count as an approval",
  );
  for (const copy of [
    GHQ28_SUPPORT_HEADING,
    GHQ28_SUPPORT_BODY,
    GHQ28_SUPPORT_PRIVACY_NOTE,
    GHQ28_SUPPORT_NEXT_STEPS,
  ]) {
    assert.ok(copy.trim().length > 0, "approved support copy must not be empty");
  }
  assert.equal(ghq28SupportPathwayApproved(), true);
});

/**
 * Interim approval opens the internal test and NOTHING beyond it.
 *
 * The distinction a boolean cannot hold: the engagement's Occupational Health
 * facilitator accepted this wording so internal user testing could proceed. A
 * clinician has not signed it off for general use, and until one does GHQ-28
 * is not releasable however green the suite is.
 */
test("interim approval does not clear GHQ-28 for external release", () => {
  assert.equal(ghq28SupportClinicallyApproved(), false);
  const release = canReleaseExternally("ghq28");
  assert.equal(release.allowed, false);
  assert.ok(
    release.blockers.some((blocker) => /clinical-governance sign-off/i.test(blocker)),
    "the outstanding clinical sign-off must be named where release is decided",
  );
});

function walk(dir: URL): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const child = new URL(`${entry}${entry.includes(".") ? "" : "/"}`, dir);
    const path = decodeURIComponent(child.pathname);
    if (statSync(path).isDirectory()) out.push(...walk(child));
    else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(path.slice(decodeURIComponent(ROOT.pathname).length));
    }
  }
  return out;
}
