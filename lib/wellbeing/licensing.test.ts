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
 * This is the test that matters most in the multi-instrument build. Three of
 * the four instruments are third-party content whose digital-use rights are
 * still being confirmed, and the requirement is not "we remember not to
 * publish them" — it is that publishing them must be impossible by accident.
 */

const PRODUCTION = { isProduction: true, demoEnabled: false };
const PRODUCTION_WITH_DEMO_FLAG = { isProduction: true, demoEnabled: true };
const LOCAL = { isProduction: false, demoEnabled: false };
const LOCAL_DEMO = { isProduction: false, demoEnabled: true };

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

test("GHQ-12 and GHQ-28 open only under local + explicit demo flag", () => {
  assert.equal(canServeToParticipants("ghq12", LOCAL_DEMO).allowed, true);
  assert.equal(canServeToParticipants("ghq28", LOCAL_DEMO).allowed, true);
});

test("WHO-5 stays closed even in local demo — its content is not loaded", () => {
  // structure_only, not demo_restricted: there is no wording to demonstrate,
  // so the gate must not pretend there is.
  assert.equal(INSTRUMENTS.who5.status, "structure_only");
  assert.equal(canServeToParticipants("who5", LOCAL_DEMO).allowed, false);
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
  assert.equal(INSTRUMENTS.who5.defaultThreshold, null);
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
