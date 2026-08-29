import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canReleaseExternally,
  canServeToParticipants,
  INSTRUMENTS,
  INSTRUMENT_KEYS,
  NOT_ACTIVE_MESSAGE,
  SUPPORT_PATHWAY_REQUIRED_MESSAGE,
  unavailableReason,
  type InstrumentKey,
} from "../../data/wellbeing-instruments.ts";
import {
  GHQ28_SUPPORT_APPROVAL_STATE,
  ghq28SupportPathwayApproved,
} from "../../data/ghq28-support-content.ts";

/**
 * The licensing gate.
 *
 * This is the test that matters most in the multi-instrument build. Most of
 * the instruments are third-party content, and the requirement is not "we
 * remember not to publish them" — it is that publishing them must be
 * impossible by accident.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT CHANGED ON 2026-08-29, AND WHAT DID NOT.
 *
 * All four instruments were activated for AUTHORISED INTERNAL USER TESTING.
 * This file previously pinned the state before that decision — "GHQ-12 is
 * held", "WHO-5 must stay switched off" — and those pins are gone, because a
 * test that asserts a superseded decision is not protecting anything; it is
 * only reporting that somebody made a different one.
 *
 * What has NOT changed is every rule underneath, and this file now states each
 * one as a rule rather than as a name:
 *
 *  · A NON-ACTIVE instrument can be opened only outside production with the
 *    demo flag, and by nothing else — asserted against whatever is non-active,
 *    including nothing.
 *  · An instrument's ACTIVATION and its RELEASE are two separate
 *    authorisations. Internal testing is authorised; external and commercial
 *    release is not, and `canReleaseExternally` must keep saying so.
 *  · GHQ-28 cannot serve unless its Section D support pathway may serve.
 *  · Attribution and provenance are reported, never invented: `attribution`
 *    stays null while GL Assessment's wording is unconfirmed, and no copy may
 *    claim otherwise.
 *  · A refusal never leaks the questionnaire.
 *
 * TWO GATES, FOR TWO DIFFERENT QUESTIONS.
 *
 * `canServeToParticipants` — may a participant in the authorised internal test
 * open this? `canReleaseExternally` — may this go to a customer? They were one
 * question while nothing was switched on. Activating the third-party
 * instruments split them, and conflating them again is the mistake this file
 * exists to make loud.
 * ─────────────────────────────────────────────────────────────────────
 */

const PRODUCTION = { isProduction: true, demoEnabled: false };
const PRODUCTION_WITH_DEMO_FLAG = { isProduction: true, demoEnabled: true };
const LOCAL = { isProduction: false, demoEnabled: false };
const LOCAL_DEMO = { isProduction: false, demoEnabled: true };

/**
 * The instruments NOT switched on, derived — never a hand-kept list.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS IS A FILTER AND NOT `["ghq12","ghq28","who5"]`.
 *
 * It was that array, and on 2026-08-29 the array became false. Every test that
 * looped over it then asserted a policy that no longer existed, and the suite
 * went red for the one reason a suite must never go red: it was describing the
 * past.
 *
 * The rule these tests protect was never "these three names are off". It is
 * "an instrument that is not `active` cannot be opened by any environment, and
 * only a non-production deployment with the demo flag may look at it". Derived,
 * that rule keeps holding for whichever instrument is held next — and it holds
 * vacuously today, which is why the registry's composition is pinned
 * separately below rather than left to be inferred from an empty loop.
 * ─────────────────────────────────────────────────────────────────────
 */
const HELD: InstrumentKey[] = INSTRUMENT_KEYS.filter(
  (key) => INSTRUMENTS[key].status === "licensed" || INSTRUMENTS[key].status === "demo_restricted",
);

/** No content exists to serve: refused everywhere, under every flag. */
const NEVER_SERVABLE: InstrumentKey[] = INSTRUMENT_KEYS.filter(
  (key) => INSTRUMENTS[key].status === "structure_only" || INSTRUMENTS[key].status === "retired",
);

const ACTIVE: InstrumentKey[] = INSTRUMENT_KEYS.filter(
  (key) => INSTRUMENTS[key].status === "active",
);

const ALL_ENVIRONMENTS = [PRODUCTION, PRODUCTION_WITH_DEMO_FLAG, LOCAL, LOCAL_DEMO];

/* ── 1 · the activation decision, pinned once and deliberately ──────── */

test("the registry's activation state is the one this suite was told about", () => {
  // Deriving the sets above means an empty set passes every loop. So the
  // composition itself is asserted here: switching an instrument on or off
  // fails THIS test and nothing else, which makes it a decision somebody has
  // to state rather than a side effect of editing one word.
  assert.deepEqual(
    [...ACTIVE].sort(),
    ["disc360_wellbeing_v1", "ghq12", "ghq28", "who5"],
    "an instrument's availability changed — confirm the authorisation, then update this pin",
  );
  assert.deepEqual([...HELD].sort(), []);
  assert.deepEqual([...NEVER_SERVABLE].sort(), []);
});

/* ── 2 · the held rule, whatever is held ────────────────────────────── */

test("a non-active instrument is refused in production, with or without the demo flag", () => {
  for (const key of HELD) {
    for (const environment of [PRODUCTION, PRODUCTION_WITH_DEMO_FLAG]) {
      const decision = canServeToParticipants(key, environment);
      assert.equal(decision.allowed, false, `${key} must be blocked in production`);
      assert.equal(decision.reason, NOT_ACTIVE_MESSAGE);
    }
  }
});

test("a non-active instrument needs the demo flag, not merely a local build", () => {
  for (const key of HELD) {
    assert.equal(
      canServeToParticipants(key, LOCAL).allowed,
      false,
      `${key} needs the explicit demo flag, not merely a non-production build`,
    );
    assert.equal(canServeToParticipants(key, LOCAL_DEMO).allowed, true);
  }
});

test("structure-only and retired instruments serve nowhere at all", () => {
  for (const key of NEVER_SERVABLE) {
    for (const environment of ALL_ENVIRONMENTS) {
      assert.equal(
        canServeToParticipants(key, environment).allowed,
        false,
        `${key} has no servable content and must never open`,
      );
    }
  }
});

/**
 * The rule stated as an equivalence, exercised against whatever is held.
 *
 * The old version of this test used WHO-5 by name. WHO-5 is active now, so it
 * would have gone on passing while examining nothing. The gate takes its status
 * from the registry, so the rule is instead asserted through the two statuses
 * that carry it — which is what "iff" actually means here.
 */
test("held and demo-restricted obey one rule: open iff not production and demo on", () => {
  for (const key of INSTRUMENT_KEYS) {
    const status = INSTRUMENTS[key].status;
    if (status !== "licensed" && status !== "demo_restricted") continue;
    for (const environment of ALL_ENVIRONMENTS) {
      assert.equal(
        canServeToParticipants(key, environment).allowed,
        !environment.isProduction && environment.demoEnabled,
        `${key} must serve iff !production && demo`,
      );
    }
  }
});

/* ── 3 · active instruments, and what activation does NOT mean ──────── */

test("an active instrument serves everywhere, including production", () => {
  for (const key of ACTIVE) {
    for (const environment of ALL_ENVIRONMENTS) {
      assert.equal(
        canServeToParticipants(key, environment).allowed,
        true,
        `${key} is active and must serve in ${JSON.stringify(environment)}`,
      );
    }
  }
});

/**
 * ACTIVATION IS NOT RELEASE. The distinction this file exists to keep.
 *
 * Internal user testing is authorised for all four. External and commercial
 * release is authorised for exactly one — DISC360's own content — and every
 * other instrument must name what is outstanding. If this ever passes for a
 * third-party instrument, somebody has cleared a rights or governance
 * condition, and that must be a deliberate edit here rather than a consequence
 * of flipping `status`.
 */
test("internal-test activation does not confer external or commercial release", () => {
  for (const key of INSTRUMENT_KEYS) {
    const instrument = INSTRUMENTS[key];
    const release = canReleaseExternally(key);

    if (instrument.releaseScope === "general_release") continue;

    assert.equal(
      release.allowed,
      false,
      `${key} is scoped to internal testing and must not read as released`,
    );
    assert.ok(
      release.blockers.length > 0,
      `${key} must say WHAT is outstanding, not merely refuse`,
    );
    assert.ok(
      instrument.releaseScopeNote.trim().length > 0,
      `${key} must record why its release scope is limited`,
    );
  }
});

test("only DISC360's own content is cleared for external release", () => {
  const released = INSTRUMENT_KEYS.filter((key) => canReleaseExternally(key).allowed);
  assert.deepEqual(
    [...released].sort(),
    ["disc360_wellbeing_v1"],
    "an instrument became externally releasable — confirm the rights and governance position",
  );
});

test("each outstanding condition is named by the instrument that carries it", () => {
  // GL Assessment's attribution wording, for both GHQs.
  for (const key of ["ghq12", "ghq28"] as const) {
    assert.ok(
      canReleaseExternally(key).blockers.some((blocker) => /GL Assessment/i.test(blocker)),
      `${key} must name the unconfirmed attribution as a release blocker`,
    );
  }
  // WHO-5's non-commercial licence.
  assert.ok(
    canReleaseExternally("who5").blockers.some((blocker) => /non-commercial/i.test(blocker)),
    "WHO-5 must name its non-commercial licence as a release blocker",
  );
  // GHQ-28's interim-only safeguard approval.
  assert.ok(
    canReleaseExternally("ghq28").blockers.some((blocker) =>
      /clinical-governance sign-off/i.test(blocker),
    ),
    "GHQ-28 must name its interim support approval as a release blocker",
  );
});

/* ── 4 · GHQ-28's safeguard is a precondition of serving at all ─────── */

/**
 * The invariant that outranks every other one in this file.
 *
 * GHQ-28's Section D asks directly about not wanting to live. The one thing
 * this product can offer in response is the support information on the
 * participant's own result. So the questionnaire may not open unless that
 * pathway can serve — approved, in a KNOWN approval state, with copy that
 * actually exists.
 *
 * Previously this connection lived in a comment while the flag was read only
 * by the result page, which decides whether to render the panel AFTER the
 * participant has answered. It is now enforced in the gate, and asserted here
 * in both directions.
 */
test("GHQ-28 cannot serve unless its Section D support pathway may serve", () => {
  const pathway = ghq28SupportPathwayApproved();

  for (const environment of ALL_ENVIRONMENTS) {
    const decision = canServeToParticipants("ghq28", environment);
    if (!pathway) {
      assert.equal(
        decision.allowed,
        false,
        "GHQ-28 must not open while its support pathway is unapproved",
      );
      assert.equal(decision.reason, SUPPORT_PATHWAY_REQUIRED_MESSAGE);
    }
  }

  if (INSTRUMENTS.ghq28.status === "active") {
    assert.equal(
      pathway,
      true,
      "GHQ-28 is active while its Section D support wording cannot serve",
    );
  }
});

test("the interim approval does not imply clinical-governance sign-off", () => {
  // The approval state is a real authorisation to serve inside the internal
  // test, and it is NOT the final one. A boolean cannot hold that difference,
  // which is why the state exists — and why external release still refuses.
  assert.equal(GHQ28_SUPPORT_APPROVAL_STATE, "interim_internal_test");
  assert.equal(canReleaseExternally("ghq28").allowed, false);
});

/* ── 5 · provenance and attribution: reported, never invented ───────── */

test("third-party content records the document its wording came from", () => {
  // The supplied guides carry no attribution statement, so `attribution` is
  // null and `sourceDocument` is the only provenance there is. Losing it would
  // leave licensed third-party content with nothing identifying its origin.
  for (const key of ["ghq12", "ghq28"] as const) {
    assert.match(
      INSTRUMENTS[key].sourceDocument ?? "",
      /Questionnaire_and_Assessment_Guide\.pdf$/,
      `${key} must name the document it was transcribed from`,
    );
  }
});

/**
 * An attribution that is not confirmed stays null — activation changes nothing
 * about this. Inventing a plausible GL Assessment credit to make an instrument
 * look finished would be a fabricated legal claim, and it is exactly the kind
 * of thing an activation sweep invites.
 */
test("an unconfirmed attribution is left null, not filled in", () => {
  for (const key of ["ghq12", "ghq28"] as const) {
    assert.equal(
      INSTRUMENTS[key].attribution,
      null,
      "an attribution string must never be invented to make an instrument look released",
    );
    // And the gap must be visible where release is decided.
    assert.ok(
      canReleaseExternally(key).blockers.some((blocker) => /attribution/i.test(blocker)),
      `${key}'s missing attribution must block external release`,
    );
  }
});

test("no instrument's copy claims a contractual attribution it does not hold", () => {
  for (const key of ["ghq12", "ghq28"] as const) {
    const copy = [
      INSTRUMENTS[key].licensingDescription,
      INSTRUMENTS[key].releaseScopeNote,
    ].join(" ");
    // It may say the licence was confirmed by the product owner for digital
    // use — that is what happened. It may NOT say the attribution wording is
    // agreed, because it is not.
    assert.ok(
      !/attribution (statement )?(confirmed|agreed|supplied|provided)/i.test(copy),
      `${key} must not claim an attribution position it does not hold`,
    );
  }
});

/* ── 6 · WHO-5's non-commercial basis ───────────────────────────────── */

test("WHO-5's non-commercial basis is recorded, surfaced and still binding", () => {
  // It was briefly a hard gate keyed on an organisation classification that no
  // caller ever supplied, so it defaulted closed and WHO-5 could not be served
  // by anybody. The owner has confirmed no additional licence is needed for
  // internal, non-commercial use — so the SERVING block is gone, while the
  // RELEASE consequence is not.
  assert.equal(INSTRUMENTS.who5.useClassification, "internal_noncommercial");
  assert.match(INSTRUMENTS.who5.licensingDescription, /non-commercial/i);
  assert.match(INSTRUMENTS.who5.attribution ?? "", /CC BY-NC-SA 3\.0 IGO/);
  assert.match(INSTRUMENTS.who5.releaseScopeNote, /non-commercial/i);
  assert.equal(canReleaseExternally("who5").allowed, false);
});

test("WHO-5's activation carries no unrestricted commercial implication", () => {
  const copy = [
    INSTRUMENTS.who5.licensingDescription,
    INSTRUMENTS.who5.releaseScopeNote,
    INSTRUMENTS.who5.attribution ?? "",
  ]
    .join(" ")
    .toLowerCase();
  for (const forbidden of ["commercially licensed", "cleared for commercial", "unrestricted use"]) {
    assert.ok(!copy.includes(forbidden), `WHO-5 copy must not claim "${forbidden}"`);
  }
});

test("the non-commercial classification applies to WHO-5 alone", () => {
  // DISC360's own content carries no such restriction, and the GHQ pair are
  // limited for a different reason entirely.
  for (const key of INSTRUMENT_KEYS) {
    if (key === "who5") continue;
    assert.notEqual(
      INSTRUMENTS[key].useClassification,
      "internal_noncommercial",
      `${key} must not inherit WHO-5's rights restriction`,
    );
  }
});

/* ── 7 · the gate cannot leak content ───────────────────────────────── */

test("the refusal messages leak nothing about the questionnaire", () => {
  for (const message of [NOT_ACTIVE_MESSAGE, SUPPORT_PATHWAY_REQUIRED_MESSAGE]) {
    assert.ok(!/item|question|score|threshold/i.test(message), `refusal leaks: ${message}`);
  }
});

test("every refusal, whatever refused it, carries a safe reason", () => {
  // Exercised across every instrument and every environment, so a refusal
  // produced by a gate added later is covered without this test being edited.
  for (const key of INSTRUMENT_KEYS) {
    for (const environment of ALL_ENVIRONMENTS) {
      const decision = canServeToParticipants(key, environment);
      if (decision.allowed) {
        assert.equal(decision.reason, null, `${key} must not carry a reason when allowed`);
        continue;
      }
      const reason = decision.reason ?? "";
      assert.ok(reason.length > 0, `${key} must give a reason`);
      assert.ok(
        !/item|question|score|threshold/i.test(reason),
        `refusal for ${key} leaks content: ${reason}`,
      );
    }
  }
});

test("every non-active instrument has a facilitator-facing reason", () => {
  for (const key of INSTRUMENT_KEYS) {
    const reason = unavailableReason(key);
    if (INSTRUMENTS[key].status === "active") {
      assert.equal(reason, "");
    } else {
      assert.match(reason, /^Not available — /);
    }
  }
});

/* ── registry integrity ─────────────────────────────────────────────── */

test("all four instruments are registered and distinct", () => {
  assert.deepEqual([...INSTRUMENT_KEYS], ["ghq12", "ghq28", "who5", "disc360_wellbeing_v1"]);
  const engines = INSTRUMENT_KEYS.map((key) => INSTRUMENTS[key].scoringEngine);
  assert.equal(new Set(engines).size, 4, "each instrument has its own scoring engine");
  const methods = INSTRUMENT_KEYS.map((key) => INSTRUMENTS[key].scoringMethod);
  assert.equal(new Set(methods).size, 4, "each instrument has its own scoring method");
});

test("scales are instrument-specific and are not interchangeable", () => {
  assert.equal(INSTRUMENTS.ghq12.primaryScoreMax, 12);
  assert.equal(INSTRUMENTS.ghq28.primaryScoreMax, 28);
  assert.equal(INSTRUMENTS.who5.primaryScoreMax, 100);
  assert.equal(INSTRUMENTS.disc360_wellbeing_v1.primaryScoreMax, 100);

  // WHO-5 and the DISC360 index share a 0–100 range and still are NOT the same
  // measure — the registry records different engines, methods and publishers so
  // nothing can treat them as one series.
  assert.notEqual(INSTRUMENTS.who5.scoringMethod, INSTRUMENTS.disc360_wellbeing_v1.scoringMethod);
  assert.notEqual(INSTRUMENTS.who5.publisher, INSTRUMENTS.disc360_wellbeing_v1.publisher);
});

test("the two GHQ instruments run toward distress; WHO-5 and DISC360 toward wellbeing", () => {
  assert.equal(INSTRUMENTS.ghq12.scoreDirection, "higher_is_more_distress");
  assert.equal(INSTRUMENTS.ghq28.scoreDirection, "higher_is_more_distress");
  assert.equal(INSTRUMENTS.who5.scoreDirection, "higher_is_stronger_wellbeing");
  assert.equal(INSTRUMENTS.disc360_wellbeing_v1.scoreDirection, "higher_is_stronger_wellbeing");
});

test("only instruments with a threshold declare a default, and vice versa", () => {
  for (const key of INSTRUMENT_KEYS) {
    const instrument = INSTRUMENTS[key];
    assert.equal(
      instrument.defaultThreshold !== null,
      instrument.hasThreshold,
      `${key}: hasThreshold and defaultThreshold must agree`,
    );
  }
  assert.equal(INSTRUMENTS.disc360_wellbeing_v1.defaultThreshold, null);
  // WHO-5 carries the cut-off its OWN publication documents — 50 on the
  // percentage scale. It is instrument documentation, not a DISC360 judgement,
  // and the description must say so rather than presenting it as a finding.
  assert.equal(INSTRUMENTS.who5.defaultThreshold, 50);
  assert.match(INSTRUMENTS.who5.thresholdDescription, /suggested/i);
  assert.match(INSTRUMENTS.who5.thresholdDescription, /further assessment/i);
  assert.match(INSTRUMENTS.who5.thresholdDescription, /WHO\/UCN\/MSD\/MHE\/2024\.1/);
  assert.match(INSTRUMENTS.who5.thresholdDescription, /not a diagnosis/i);
});

/* ── GHQ-28 subscales ───────────────────────────────────────────────── */

test("GHQ-28 defines four subscales of seven items covering all 28", () => {
  const subscales = INSTRUMENTS.ghq28.subscales;
  assert.equal(subscales.length, 4);
  assert.deepEqual(subscales.map((s) => s.label), [
    "Somatic symptoms",
    "Anxiety / insomnia",
    "Social dysfunction",
    "Severe depression",
  ]);
  assert.deepEqual(subscales.map((s) => s.itemRange), [
    [1, 7],
    [8, 14],
    [15, 21],
    [22, 28],
  ]);
  for (const subscale of subscales) {
    assert.equal(subscale.itemCount, 7);
  }
  assert.equal(
    subscales.reduce((total, s) => total + s.itemCount, 0),
    28,
  );
});

test("GHQ-28 subscales are described as profile dimensions, never as conditions", () => {
  for (const subscale of INSTRUMENTS.ghq28.subscales) {
    assert.match(subscale.description, /profile dimension only/i);
  }
  assert.match(INSTRUMENTS.ghq28.subscaleDescription, /carry no thresholds of their own/i);
  assert.ok(
    INSTRUMENTS.ghq28.notClaims.includes(
      "subscales are not separately interpretable as conditions",
    ),
  );
});

/* ── WHO-5 attribution ──────────────────────────────────────────────── */

test("WHO-5 carries its publisher, licence and required attribution", () => {
  const who5 = INSTRUMENTS.who5;
  assert.equal(who5.publisher, "World Health Organization");
  assert.equal(who5.licensing, "open_licence");
  assert.match(who5.licensingDescription, /CC BY-NC-SA 3\.0 IGO/);
  assert.ok(who5.attribution, "WHO-5 must carry an attribution string");
  assert.match(who5.attribution!, /World Health Organization/);
  assert.match(who5.attribution!, /CC BY-NC-SA 3\.0 IGO/);
});

test("the WHO-5 attribution explicitly disclaims endorsement", () => {
  assert.match(INSTRUMENTS.who5.attribution!, /does not endorse/i);
  assert.ok(INSTRUMENTS.who5.notClaims.includes("not endorsed by the World Health Organization"));
});

test("no instrument claims endorsement or superiority", () => {
  const text = INSTRUMENT_KEYS.flatMap((key) => {
    const instrument = INSTRUMENTS[key];
    return [
      instrument.purpose,
      instrument.descriptor,
      instrument.licensingDescription,
      instrument.subscaleDescription,
      instrument.attribution ?? "",
    ];
  })
    .join(" ")
    .toLowerCase();
  for (const forbidden of [
    "endorsed by",
    "approved by who",
    "better than",
    "superior",
    "gold standard",
    "most accurate",
  ]) {
    assert.ok(!text.includes(forbidden), `instrument metadata must not claim "${forbidden}"`);
  }
});
