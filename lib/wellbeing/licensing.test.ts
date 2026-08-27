import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canServeToParticipants,
  INSTRUMENTS,
  INSTRUMENT_KEYS,
  NON_COMMERCIAL_ONLY_MESSAGE,
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
 * · CONTENT-GATED (GHQ-12, GHQ-28) — the wording is not loaded, because the
 *   rights are not confirmed. Nothing to serve, so nothing can be served.
 *
 * · RIGHTS-GATED (WHO-5) — the wording IS loaded and verbatim-correct, under
 *   CC BY-NC-SA 3.0 IGO. That licence is NON-COMMERCIAL, and this platform is
 *   commercial, so being "active" is not sufficient: the organisation running
 *   the campaign must itself be classified `internal_noncommercial`.
 *
 * The distinction matters because the two fail for different reasons and are
 * fixed by different people. A content gate lifts when a licence is signed; a
 * rights gate lifts only for an organisation whose use is actually covered.
 * ─────────────────────────────────────────────────────────────────────
 */

const PRODUCTION = { isProduction: true, demoEnabled: false };
const PRODUCTION_WITH_DEMO_FLAG = { isProduction: true, demoEnabled: true };
const LOCAL = { isProduction: false, demoEnabled: false };
const LOCAL_DEMO = { isProduction: false, demoEnabled: true };

/** Internal, non-commercial evaluation — the only use WHO-5 is licensed for. */
const INTERNAL = { organizationUse: "internal_noncommercial" as const };

/** Content not loaded: no licence confirmed, so no wording exists to serve. */
const RESTRICTED: InstrumentKey[] = ["ghq12", "ghq28"];

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

test("GHQ-12 and GHQ-28 open only under local + explicit demo flag", () => {
  assert.equal(canServeToParticipants("ghq12", LOCAL_DEMO).allowed, true);
  assert.equal(canServeToParticipants("ghq28", LOCAL_DEMO).allowed, true);
});

/* ── WHO-5: active content, non-commercial rights ───────────────────── */

test("WHO-5 content is loaded, and the instrument is still switched off", () => {
  // Rights confirmed, verbatim content seeded by 00038 — and deliberately NOT
  // active, because no WHO-5 result path exists yet. See the registry comment:
  // rendering WHO-5 through GhqResult inverts its interpretation.
  assert.equal(INSTRUMENTS.who5.status, "licensed");
  assert.equal(INSTRUMENTS.who5.useClassification, "internal_noncommercial");
});

test("WHO-5 cannot reach a participant, by either gate independently", () => {
  // Two gates, and each must hold on its own. Relying on one means a single
  // edit can expose the instrument.
  //
  // Gate 1 — rights: no organisation classification.
  assert.equal(canServeToParticipants("who5", PRODUCTION).allowed, false);
  // Gate 2 — release readiness: even WITH the licensed use, it stays closed
  // while the result path would render it through GHQ semantics.
  assert.equal(canServeToParticipants("who5", { ...PRODUCTION, ...INTERNAL }).allowed, false);
  assert.equal(canServeToParticipants("who5", { ...LOCAL_DEMO, ...INTERNAL }).allowed, false);
});

test("WHO-5 is refused for an organisation not classified non-commercial", () => {
  // Being active is a fact about CONTENT. It says nothing about rights, and
  // must never be sufficient on its own.
  for (const environment of [PRODUCTION, LOCAL, LOCAL_DEMO, PRODUCTION_WITH_DEMO_FLAG]) {
    const decision = canServeToParticipants("who5", environment);
    assert.equal(decision.allowed, false, "an unclassified organisation must be refused");
    assert.equal(decision.reason, NON_COMMERCIAL_ONLY_MESSAGE);
  }
  // Explicitly unrestricted is a commercial customer, and is refused too.
  assert.equal(
    canServeToParticipants("who5", { ...PRODUCTION, organizationUse: "unrestricted" }).allowed,
    false,
  );
});

test("the non-commercial gate is checked before status, not after", () => {
  // Otherwise flipping a status could open licensed content to a commercial
  // customer on its own — the single change most likely to be made casually.
  // Proven by the refusal REASON: an unclassified organisation is turned away
  // on rights, not on the instrument merely being switched off.
  assert.equal(
    canServeToParticipants("who5", PRODUCTION).reason,
    NON_COMMERCIAL_ONLY_MESSAGE,
    "rights are evaluated before release status",
  );
  // With the rights satisfied, the release gate is what remains.
  assert.equal(
    canServeToParticipants("who5", { ...PRODUCTION, ...INTERNAL }).reason,
    NOT_ACTIVE_MESSAGE,
  );
});

test("the non-commercial refusal names rights, not availability", () => {
  // "Not available" would send somebody to wait for a release that will never
  // change this. The reason has to say it is a licence boundary.
  assert.match(NON_COMMERCIAL_ONLY_MESSAGE, /non-commercial/i);
  assert.match(NON_COMMERCIAL_ONLY_MESSAGE, /licence/i);
  // And still leaks nothing about the questionnaire itself.
  assert.ok(!/item|question|score|threshold/i.test(NON_COMMERCIAL_ONLY_MESSAGE));
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
    assert.equal(reason, NOT_ACTIVE_MESSAGE);
    assert.ok(!/item|question|score|threshold/i.test(reason));
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
