import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isDemoEnabled,
  isProduction,
  type DeploymentEnv,
} from "./environment-rules.ts";
import {
  canServeToParticipants,
  INSTRUMENTS,
  INSTRUMENT_KEYS,
} from "../../data/wellbeing-instruments.ts";

/**
 * The production gate, EXECUTED rather than described.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THIS PROVES THAT NOTHING ELSE DID.
 *
 * Every safety claim in Wellbeing Pulse ultimately rests on one sentence,
 * repeated in a dozen comments: "isProductionEnvironment() returns true
 * unconditionally on Vercel, so nothing here can open the hosted product."
 *
 * Until now that sentence was covered only by tests that read the source and
 * matched a regular expression against it. A regex can show that a line LOOKS
 * like the rule. It cannot show that the rule holds — not for an ordering
 * mistake, not for a flag added later, not for the case where two variables are
 * set at once.
 *
 * These tests run the real function over every combination of the four
 * variables that touch it, and then run the whole gate — environment plus
 * instrument status — end to end. If a flag can ever open a held instrument on
 * the hosted deployment, that is a failure here rather than an incident.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Held instruments: complete, and deliberately not switched on. */
const HELD = ["ghq12", "ghq28", "who5"] as const;

/** Every combination of the flags that could plausibly be set. */
const FLAG_COMBINATIONS: DeploymentEnv[] = [];
for (const VERCEL of [undefined, "1", "0"]) {
  for (const VERCEL_ENV of [undefined, "production", "preview", "development"]) {
    for (const NODE_ENV of [undefined, "production", "development", "test"]) {
      for (const WELLBEING_LOCAL_TEST of [undefined, "true", "false", "TRUE", "1"]) {
        for (const WELLBEING_DEMO_MODE of [undefined, "true", "false"]) {
          FLAG_COMBINATIONS.push({
            VERCEL,
            VERCEL_ENV,
            NODE_ENV,
            WELLBEING_LOCAL_TEST,
            WELLBEING_DEMO_MODE,
          });
        }
      }
    }
  }
}

const onVercel = (env: DeploymentEnv) => env.VERCEL === "1" || Boolean(env.VERCEL_ENV);

/* ── 1 · the hosted deployment is production, whatever else is set ───── */

test("anything running on Vercel is production, under every flag combination", () => {
  const hosted = FLAG_COMBINATIONS.filter(onVercel);
  assert.ok(hosted.length > 0, "the matrix must actually contain hosted cases");

  for (const env of hosted) {
    assert.equal(
      isProduction(env),
      true,
      `Vercel must be production, but was not for ${JSON.stringify(env)}`,
    );
  }
});

test("the local-test marker cannot talk Vercel out of being production", () => {
  // The exact shape of the mistake this guards against: someone sets the test
  // rig marker in the hosted project, by copying an env file or by habit.
  for (const VERCEL_ENV of ["production", "preview", "development"]) {
    assert.equal(
      isProduction({
        VERCEL: "1",
        VERCEL_ENV,
        NODE_ENV: "production",
        WELLBEING_LOCAL_TEST: "true",
        WELLBEING_DEMO_MODE: "true",
      }),
      true,
      `WELLBEING_LOCAL_TEST must be inert on Vercel (${VERCEL_ENV})`,
    );
  }
});

/* ── 2 · off Vercel, the default is still the cautious answer ─────────── */

test("a production build off Vercel is production unless explicitly marked a test rig", () => {
  const base = { NODE_ENV: "production" } as const;
  assert.equal(isProduction({ ...base }), true, "unmarked means assume real participants");
  assert.equal(isProduction({ ...base, WELLBEING_LOCAL_TEST: "false" }), true);
  // Deliberately awkward to set by accident: it must be exactly "true".
  assert.equal(isProduction({ ...base, WELLBEING_LOCAL_TEST: "TRUE" }), true, "case-sensitive");
  assert.equal(isProduction({ ...base, WELLBEING_LOCAL_TEST: "1" }), true, "not a truthy string");
  assert.equal(isProduction({ ...base, WELLBEING_LOCAL_TEST: "true" }), false, "the one way in");
});

test("a development build is not production", () => {
  for (const NODE_ENV of [undefined, "development", "test"]) {
    assert.equal(isProduction({ NODE_ENV }), false);
  }
});

/* ── 3 · the demo flag is exact and opt-in ───────────────────────────── */

test("the demo flag is off unless it is exactly \"true\"", () => {
  assert.equal(isDemoEnabled({}), false, "absent means off");
  for (const WELLBEING_DEMO_MODE of ["false", "TRUE", "1", "yes", ""]) {
    assert.equal(isDemoEnabled({ WELLBEING_DEMO_MODE }), false, WELLBEING_DEMO_MODE);
  }
  assert.equal(isDemoEnabled({ WELLBEING_DEMO_MODE: "true" }), true);
});

/* ── 4 · the whole gate, environment and status together ─────────────── */

test("no flag combination can serve a held instrument on the hosted deployment", () => {
  const hosted = FLAG_COMBINATIONS.filter(onVercel);
  for (const env of hosted) {
    const options = { isProduction: isProduction(env), demoEnabled: isDemoEnabled(env) };
    for (const key of HELD) {
      assert.equal(
        canServeToParticipants(key, options).allowed,
        false,
        `${key} became servable on Vercel with ${JSON.stringify(env)}`,
      );
    }
  }
});

test("a held instrument opens only off Vercel, on a marked test rig, with the demo flag", () => {
  const opens = FLAG_COMBINATIONS.filter((env) => {
    const options = { isProduction: isProduction(env), demoEnabled: isDemoEnabled(env) };
    return canServeToParticipants("who5", options).allowed;
  });

  assert.ok(opens.length > 0, "it must be possible to exercise WHO-5 somewhere, or it ships blind");
  for (const env of opens) {
    assert.equal(onVercel(env), false, "never hosted");
    assert.equal(env.WELLBEING_DEMO_MODE, "true", "the demo flag is required, exactly");
    // Either a non-production build, or a production build explicitly marked.
    const markedTestRig = env.NODE_ENV === "production" && env.WELLBEING_LOCAL_TEST === "true";
    assert.ok(
      env.NODE_ENV !== "production" || markedTestRig,
      `an unmarked production build must stay closed: ${JSON.stringify(env)}`,
    );
  }
});

test("only DISC360's own content serves in production; every held one is refused", () => {
  const hostedProduction = { isProduction: true, demoEnabled: false };
  for (const key of INSTRUMENT_KEYS) {
    const expected = INSTRUMENTS[key].status === "active";
    assert.equal(
      canServeToParticipants(key, hostedProduction).allowed,
      expected,
      `${key} is ${INSTRUMENTS[key].status}, so hosted serving must be ${expected}`,
    );
  }
  // Named explicitly, so a status change is a visible decision rather than a
  // silent consequence of editing one word in the registry. Every third-party
  // instrument is held; only DISC360's own material is active.
  assert.equal(INSTRUMENTS.disc360_wellbeing_v1.status, "active");
  assert.equal(INSTRUMENTS.ghq12.status, "licensed");
  assert.equal(INSTRUMENTS.ghq28.status, "licensed");
  assert.equal(INSTRUMENTS.who5.status, "licensed");
});
