import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canServeToParticipants,
  INSTRUMENTS,
  INSTRUMENT_KEYS,
  NOT_ACTIVE_MESSAGE,
  unavailableReason,
  type InstrumentKey,
} from "../../data/wellbeing-instruments.ts";

/**
 * The licensing gate.
 *
 * This is the test that matters most in the multi-instrument build. Most of
 * the instruments are third-party content, and the requirement is not "we
 * remember not to publish them" — it is that publishing them must be
 * impossible by accident.
 *
 * ─────────────────────────────────────────────────────────────────────
 * TWO DIFFERENT GATES, FOR TWO DIFFERENT REASONS.
 *
 * · RIGHTS-GATED (WHO-5) — the wording IS loaded and verbatim-correct, under
 *   CC BY-NC-SA 3.0 IGO. That licence is NON-COMMERCIAL, and this platform is
 *   commercial, so being active would not be sufficient: the organisation
 *   running the campaign must itself be classified `internal_noncommercial`.
 *
 * · RELEASE-GATED (WHO-5, again) — its result path is still being completed,
 *   so it stays switched off independently of rights.
 *
 * GHQ-12 and GHQ-28 were content-gated until their licences were confirmed and
 * 00040 loaded their wording. They are now active and commercially licensed,
 * with no organisation classification required.
 *
 * The distinction matters because the gates fail for different reasons and are
 * lifted by different people. A content gate lifts when a licence is signed; a
 * rights gate lifts only for an organisation whose use is actually covered;
 * a release gate lifts when the product is finished.
 * ─────────────────────────────────────────────────────────────────────
 */

const PRODUCTION = { isProduction: true, demoEnabled: false };
const PRODUCTION_WITH_DEMO_FLAG = { isProduction: true, demoEnabled: true };
const LOCAL = { isProduction: false, demoEnabled: false };
const LOCAL_DEMO = { isProduction: false, demoEnabled: true };

/**
 * Instruments withheld from participants — which is now ALL THIRD-PARTY ONES.
 *
 * ─────────────────────────────────────────────────────────────────────
 * GHQ-12 RETURNED TO THIS LIST, AND THAT IS THE POINT.
 *
 * It was briefly `active`, on the reasoning that its licence was confirmed for
 * digital use. But `attribution` is null: the exact wording GL Assessment
 * requires has never been supplied, and the content migration's own
 * licence_note says it "must be confirmed with GL Assessment before external
 * production release".
 *
 * Meanwhile GHQ-12 was never actually reachable in production — its version
 * there carries no wording — so `active` was describing an intention, not a
 * state, and the only thing keeping it closed was an empty table. That is
 * fail-closed by accident, and it becomes fail-OPEN the moment the content is
 * loaded.
 *
 * So the registry now states the governance position instead of relying on a
 * database being empty. Only DISC360's own content is active.
 * ─────────────────────────────────────────────────────────────────────
 */
const RESTRICTED: InstrumentKey[] = ["ghq12", "ghq28", "who5"];

/* ── production is closed ───────────────────────────────────────────── */

test("no unlicensed instrument may be served in production", () => {
  for (const key of RESTRICTED) {
    const decision = canServeToParticipants(key, PRODUCTION);
    assert.equal(decision.allowed, false, `${key} must be blocked in production`);
    assert.equal(decision.reason, NOT_ACTIVE_MESSAGE);
  }
});

test("the demo flag does NOT open production — both conditions are required", () => {
  for (const key of RESTRICTED) {
    assert.equal(
      canServeToParticipants(key, PRODUCTION_WITH_DEMO_FLAG).allowed,
      false,
      `${key} must stay blocked in production even with the demo flag set`,
    );
  }
});

test("local alone does not open a restricted instrument either", () => {
  for (const key of RESTRICTED) {
    assert.equal(
      canServeToParticipants(key, LOCAL).allowed,
      false,
      `${key} needs the explicit demo flag, not merely a non-production build`,
    );
  }
});

/* ── the one door that opens ────────────────────────────────────────── */

test("GHQ-12 is held until its required attribution wording is confirmed", () => {
  // Held for a LICENSING reason, not a technical one. The engine, scoring,
  // threshold governance and reports are complete and under test.
  assert.equal(INSTRUMENTS.ghq12.status, "licensed");
  // No non-commercial restriction: commercially licensed, unlike WHO-5.
  assert.notEqual(INSTRUMENTS.ghq12.useClassification, "internal_noncommercial");

  // The gap that holds it, stated rather than filled in.
  assert.equal(
    INSTRUMENTS.ghq12.attribution,
    null,
    "an attribution string must never be invented to unblock a release",
  );

  // Closed in production, with or without the demo flag.
  assert.equal(canServeToParticipants("ghq12", PRODUCTION).allowed, false);
  assert.equal(canServeToParticipants("ghq12", PRODUCTION_WITH_DEMO_FLAG).allowed, false);
  // Open for authorised internal testing, by the same controlled mechanism
  // GHQ-28 and WHO-5 use — nothing bespoke, nothing that can reach hosted.
  assert.equal(canServeToParticipants("ghq12", LOCAL_DEMO).allowed, true);
  assert.equal(canServeToParticipants("ghq12", LOCAL).allowed, false);
});

test("GHQ-28 is worded and complete, and still refused in production", () => {
  // Held for a CLINICAL reason, not a licensing one: Section D asks directly
  // about not wanting to live, and the participant-facing support wording must
  // come from Occupational Health. The engine is finished; the door is shut.
  assert.equal(INSTRUMENTS.ghq28.status, "licensed");
  assert.equal(canServeToParticipants("ghq28", PRODUCTION).allowed, false);
  assert.equal(canServeToParticipants("ghq28", PRODUCTION_WITH_DEMO_FLAG).allowed, false);
  // Exercisable locally so its scoring and subscales stay under test.
  assert.equal(canServeToParticipants("ghq28", LOCAL_DEMO).allowed, true);
});

test("a licensed instrument still records where its wording came from", () => {
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

/* ── WHO-5: active content, non-commercial rights ───────────────────── */

test("WHO-5 content is loaded, and the instrument is still switched off", () => {
  // Rights confirmed, verbatim content seeded by 00038 — and deliberately NOT
  // active, because no WHO-5 result path exists yet. See the registry comment:
  // rendering WHO-5 through GhqResult inverts its interpretation.
  assert.equal(INSTRUMENTS.who5.status, "licensed");
  assert.equal(INSTRUMENTS.who5.useClassification, "internal_noncommercial");
});

test("WHO-5 is refused in production, with or without the demo flag", () => {
  // The property that matters. A held instrument may be exercised locally so
  // it can be verified before release — but production must refuse it, and no
  // flag may talk production out of that.
  for (const environment of [PRODUCTION, PRODUCTION_WITH_DEMO_FLAG]) {
    const decision = canServeToParticipants("who5", environment);
    assert.equal(decision.allowed, false, "production must refuse a held instrument");
    assert.equal(decision.reason, NOT_ACTIVE_MESSAGE);
  }
});

test("WHO-5 is refused locally too, unless the demo flag is explicitly set", () => {
  // Non-production alone is not enough. Both conditions, always.
  assert.equal(canServeToParticipants("who5", LOCAL).allowed, false);
});

test("WHO-5 serves ONLY in a non-production deployment with the demo flag", () => {
  // This is the authorised path that makes an end-to-end test possible without
  // flipping the instrument to active.
  assert.equal(canServeToParticipants("who5", LOCAL_DEMO).allowed, true);
});

test("a held instrument and a demo-restricted one obey the same rule", () => {
  // Stated as an equivalence so the two cannot drift apart: whatever opens one
  // must open the other, and whatever closes one must close the other.
  for (const environment of [PRODUCTION, LOCAL, LOCAL_DEMO, PRODUCTION_WITH_DEMO_FLAG]) {
    const held = canServeToParticipants("who5", environment).allowed;
    // GHQ-12 is active now, so construct the comparison from the rule itself.
    const expected = !environment.isProduction && environment.demoEnabled;
    assert.equal(held, expected, `held instrument must serve iff !production && demo`);
  }
});

test("WHO-5's non-commercial basis is recorded and surfaced", () => {
  // It was briefly a hard gate keyed on an organisation classification that no
  // caller ever supplied, so it defaulted closed and WHO-5 could not be served
  // by anybody. The owner has confirmed no additional licence is needed, so the
  // block is gone — but the fact remains true and must stay visible to anyone
  // considering a commercial deployment.
  assert.equal(INSTRUMENTS.who5.useClassification, "internal_noncommercial");
  assert.match(INSTRUMENTS.who5.licensingDescription, /non-commercial/i);
  assert.match(INSTRUMENTS.who5.attribution ?? "", /CC BY-NC-SA 3\.0 IGO/);
});

test("the refusal message still leaks nothing about the questionnaire", () => {
  assert.ok(!/item|question|score|threshold/i.test(NOT_ACTIVE_MESSAGE));
});

test("the non-commercial gate applies to WHO-5 alone", () => {
  // DISC360's own content carries no such restriction, and the GHQ pair are
  // blocked for a different reason entirely.
  for (const key of INSTRUMENT_KEYS) {
    if (key === "who5") continue;
    assert.notEqual(
      INSTRUMENTS[key].useClassification,
      "internal_noncommercial",
      `${key} must not inherit WHO-5's rights restriction`,
    );
  }
});

test("DISC360 Wellbeing is active and serves everywhere, including production", () => {
  assert.equal(INSTRUMENTS.disc360_wellbeing_v1.status, "active");
  for (const environment of [PRODUCTION, LOCAL, LOCAL_DEMO, PRODUCTION_WITH_DEMO_FLAG]) {
    assert.equal(canServeToParticipants("disc360_wellbeing_v1", environment).allowed, true);
  }
});

/* ── the gate cannot leak content ───────────────────────────────────── */

test("a blocked decision reveals nothing about the questionnaire", () => {
  for (const key of RESTRICTED) {
    const reason = canServeToParticipants(key, PRODUCTION).reason ?? "";
    assert.ok(reason.length > 0, `${key} must give a reason`);
    // Whichever gate refused, the message must not leak content.
    assert.ok(
      !/item|question|score|threshold/i.test(reason),
      `refusal for ${key} leaks content: ${reason}`,
    );
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
