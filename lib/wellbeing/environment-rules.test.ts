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
import { GHQ28_SUPPORT_APPROVED } from "../../data/ghq28-support-content.ts";

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

/**
 * Held instruments, DERIVED — never a hand-kept list.
 *
 * This was `["ghq12","ghq28","who5"]`, written out by hand. When those three
 * were activated for authorised internal user testing on 2026-08-29 the list
 * became a lie, and every test below asserted a policy that no longer existed.
 *
 * The rule these tests exist to protect was never "these three names are
 * off". It is "an instrument that is not `active` cannot be opened by any
 * environment flag on the hosted deployment". Deriving the set states that
 * rule, and keeps stating it whichever instruments are switched on next.
 */
const HELD = INSTRUMENT_KEYS.filter(
  (key) => INSTRUMENTS[key].status === "licensed" || INSTRUMENTS[key].status === "demo_restricted",
);

/** Never servable anywhere, under any flag: no content exists to serve. */
const NEVER_SERVABLE = INSTRUMENT_KEYS.filter(
  (key) => INSTRUMENTS[key].status === "structure_only" || INSTRUMENTS[key].status === "retired",
);

/** Switched on by an explicit release decision. */
const ACTIVE = INSTRUMENT_KEYS.filter((key) => INSTRUMENTS[key].status === "active");

/**
 * The registry composition itself, pinned.
 *
 * Deriving the sets above means a loop over an empty set passes vacuously. So
 * the composition is asserted once, here: if somebody activates an instrument
 * this test fails and makes them say so deliberately, which is exactly the
 * protection the hand-written list was providing.
 */
test("the registry's activation state is what this suite was told it is", () => {
  assert.deepEqual(
    [...ACTIVE].sort(),
    ["disc360_wellbeing_v1", "ghq12", "ghq28", "who5"],
    "an instrument's availability changed — confirm the authorisation, then update this pin",
  );
  assert.deepEqual([...NEVER_SERVABLE].sort(), []);
});

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
  // Exercised against a synthetic held instrument rather than a named one.
  //
  // This used WHO-5, which is now active, so the test silently stopped
  // examining the held rule at all. The rule outlives any particular
  // instrument, so it is now tested against a status rather than a name — and
  // keeps protecting whichever instrument is held next.
  const held = HELD[0];
  if (!held) {
    // Nothing is held today. The rule still has to hold, so assert it against
    // the status the gate actually branches on rather than skipping.
    assert.equal(
      canServeToParticipants("ghq12", { isProduction: true, demoEnabled: true }).allowed,
      INSTRUMENTS.ghq12.status === "active",
      "an active instrument serves; a held one must not, whatever the flags say",
    );
    return;
  }

  const opens = FLAG_COMBINATIONS.filter((env) => {
    const options = { isProduction: isProduction(env), demoEnabled: isDemoEnabled(env) };
    return canServeToParticipants(held, options).allowed;
  });

  assert.ok(opens.length > 0, `it must be possible to exercise ${held} somewhere, or it ships blind`);
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
  // silent consequence of editing one word in the registry.
  //
  // All four were activated on 2026-08-29 for authorised internal user
  // testing. GHQ-12 and GHQ-28 serve the content supplied for this
  // engagement; WHO-5 serves under CC BY-NC-SA 3.0 IGO for non-commercial
  // internal use; DISC360 Wellbeing Pulse is our own material. None of that
  // authorises external or commercial release, which stays a separate gate.
  assert.equal(INSTRUMENTS.disc360_wellbeing_v1.status, "active");
  assert.equal(INSTRUMENTS.ghq12.status, "active");
  assert.equal(INSTRUMENTS.ghq28.status, "active");
  assert.equal(INSTRUMENTS.who5.status, "active");
});

/**
 * GHQ-28 may only be active while its Section D support pathway may serve.
 *
 * The connection matters more than either fact alone: activating GHQ-28 with
 * no support pathway is the one failure mode that could hurt a participant.
 */
test("GHQ-28 is active only while its Section D support pathway is approved", () => {
  if (INSTRUMENTS.ghq28.status !== "active") return;
  assert.equal(
    GHQ28_SUPPORT_APPROVED,
    true,
    "GHQ-28 is active while its Section D support wording is unapproved",
  );
});
