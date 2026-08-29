import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { test } from "node:test";
import {
  canReleaseExternally,
  canServeToParticipants,
  INSTRUMENTS,
  INSTRUMENT_KEYS,
  type InstrumentKey,
} from "../../data/wellbeing-instruments.ts";
import { ghq28SupportPathwayApproved } from "../../data/ghq28-support-content.ts";
import { isDemoEnabled, isProduction } from "./environment-rules.ts";

/**
 * EVERY route into a participant attempt must consult the serving gate.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE BYPASS THIS FILE WAS WRITTEN AFTER FINDING.
 *
 * The serving gate is enforced in the application layer — there is no
 * `servable` column, so the database cannot refuse an instrument on its own.
 * That is acceptable only while every path into an attempt actually consults
 * the gate, and one did not.
 *
 * `startWellbeingPulseAction` called `checkCampaignReadiness` — the only
 * participant-path caller of `canServeToParticipants` — inside `if (teamId)`.
 * A SOLO attempt has no team, and a solo attempt is also the only case where
 * the instrument key comes from the client. The single remaining barrier was
 * `getActiveQuestionnaire`, which tests `is_active`: a question about whether
 * CONTENT exists, not about whether it may be SERVED.
 *
 * Those two answers agreed only while held content was absent from production.
 * 00040 and 00045/00046 load it. Without the fix, a signed-in participant
 * posting `{ instrumentKey: "who5" }` with no team would have opened a real
 * attempt on an instrument the gate had refused.
 *
 * That structural requirement is INDEPENDENT of which instruments are switched
 * on. It held when three were withheld, and it holds now that all four serve
 * the authorised internal test — because the gate also carries GHQ-28's
 * safeguard precondition, and will carry whatever is added next.
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");
/** Source with comments stripped — a comment about a gate is not a gate. */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");

/**
 * WHICH INSTRUMENTS THIS FILE WATCHES, AND WHY IT NO LONGER NAMES THEM.
 *
 * ─────────────────────────────────────────────────────────────────────
 * This was `const HELD = ["ghq12","ghq28","who5"]`, and every assertion below
 * looped over it. On 2026-08-29 all three were activated for authorised
 * internal user testing, and the list stopped describing anything — so the
 * tests failed while the bypass they were written to catch was still closed.
 *
 * The bypass is the point, not the names. `startWellbeingPulseAction` called
 * `checkCampaignReadiness` — the only participant-path caller of
 * `canServeToParticipants` — inside `if (teamId)`. A SOLO attempt has no team,
 * and a solo attempt is also the only case where the instrument key comes from
 * the client. The single remaining barrier was `getActiveQuestionnaire`, which
 * tests `is_active`: a question about whether CONTENT exists, not about
 * whether it may be SERVED.
 *
 * So the sets are derived from the registry, and what is asserted is the RULE:
 * whatever is not `active` cannot be opened on the hosted deployment, whatever
 * IS active must still pass every other gate, and every route into an attempt
 * must consult the gate rather than a branch.
 * ─────────────────────────────────────────────────────────────────────
 */
const HELD: InstrumentKey[] = INSTRUMENT_KEYS.filter(
  (key) => INSTRUMENTS[key].status !== "active",
);

const ACTIVE: InstrumentKey[] = INSTRUMENT_KEYS.filter(
  (key) => INSTRUMENTS[key].status === "active",
);

/* ── 1 · the decision itself, derived from the registry ─────────────── */

test("a non-active instrument is refused on Vercel under every flag combination", () => {
  for (const key of HELD) {
    for (const VERCEL of [undefined, "1"]) {
      for (const NODE_ENV of ["production", "development", undefined]) {
        for (const WELLBEING_LOCAL_TEST of [undefined, "true"]) {
          for (const WELLBEING_DEMO_MODE of [undefined, "true"]) {
            const env = { VERCEL, NODE_ENV, WELLBEING_LOCAL_TEST, WELLBEING_DEMO_MODE };
            const hosted = VERCEL === "1";
            if (!hosted) continue; // hosted production is what this asserts
            assert.equal(
              canServeToParticipants(key, {
                isProduction: isProduction(env),
                demoEnabled: isDemoEnabled(env),
              }).allowed,
              false,
              `${key} became servable on Vercel with ${JSON.stringify(env)}`,
            );
          }
        }
      }
    }
  }
});

/**
 * The hosted deployment is production NO MATTER WHAT, for active instruments
 * too.
 *
 * Deriving HELD means the loop above passes vacuously while nothing is held.
 * This asserts the other half — that `isProduction` is true for every flag
 * combination on Vercel — so the environment rule the whole gate rests on
 * stays under test whatever the registry says.
 */
test("no flag combination makes the hosted deployment look non-production", () => {
  for (const NODE_ENV of ["production", "development", undefined]) {
    for (const WELLBEING_LOCAL_TEST of [undefined, "true"]) {
      for (const WELLBEING_DEMO_MODE of [undefined, "true"]) {
        const env = { VERCEL: "1", NODE_ENV, WELLBEING_LOCAL_TEST, WELLBEING_DEMO_MODE };
        assert.equal(
          isProduction(env),
          true,
          `Vercel stopped being production with ${JSON.stringify(env)}`,
        );
      }
    }
  }
});

test("a refusal carries a reason, so a participant is not shown a blank failure", () => {
  // Every instrument, every environment — a refusal from ANY gate must explain
  // itself, including one added after this test was written.
  for (const key of INSTRUMENT_KEYS) {
    for (const isProductionFlag of [true, false]) {
      for (const demoEnabled of [true, false]) {
        const decision = canServeToParticipants(key, {
          isProduction: isProductionFlag,
          demoEnabled,
        });
        if (decision.allowed) continue;
        assert.ok(
          typeof decision.reason === "string" && decision.reason.length > 0,
          `${key} must explain why it is unavailable`,
        );
      }
    }
  }
});

/**
 * GHQ-28's safeguard gates the QUESTIONNAIRE, not only the result panel.
 *
 * This is the serving-path half of the invariant: if the Section D support
 * pathway cannot serve, no route may open a GHQ-28 attempt anywhere — not even
 * the local demo rig, because the failure being prevented is a participant
 * answering Section D and reaching a result page with nothing to show them.
 */
test("GHQ-28 opens only while its Section D support pathway may serve", () => {
  const pathway = ghq28SupportPathwayApproved();
  for (const isProductionFlag of [true, false]) {
    for (const demoEnabled of [true, false]) {
      const allowed = canServeToParticipants("ghq28", {
        isProduction: isProductionFlag,
        demoEnabled,
      }).allowed;
      if (!pathway) {
        assert.equal(allowed, false, "GHQ-28 must not open with an unapproved support pathway");
      }
    }
  }
  if (ACTIVE.includes("ghq28")) {
    assert.equal(pathway, true, "GHQ-28 is servable while its support pathway is not approved");
  }
});

/* ── 2 · attempt creation consults the gate unconditionally ──────────── */

test("attempt creation gates every attempt, not only team attempts", () => {
  const action = code("lib/actions/wellbeing.ts");

  // `beginWellbeingPulse` is where an attempt is actually created;
  // `startWellbeingPulseAction` is the form wrapper that calls it.
  const start = action.indexOf("export async function beginWellbeingPulse");
  assert.ok(start > -1, "the attempt-creating function must exist");
  const body = action.slice(start, action.indexOf("export ", start + 40));

  const gate = body.indexOf("canServeToParticipants(");
  assert.ok(gate > -1, "attempt creation must consult the serving gate");

  // The gate must not sit inside the `if (teamId)` block — that branch is the
  // defect. It must also precede the resume lookup and the insert, so neither
  // an existing nor a new attempt can proceed on a held instrument.
  const teamBranch = body.indexOf("if (teamId) {");
  const resume = body.indexOf('.from("wellbeing_sessions")');
  assert.ok(
    teamBranch === -1 || gate < teamBranch,
    "the gate must run before the team-only branch, or a solo attempt skips it",
  );
  assert.ok(gate < resume, "the gate must run before an attempt is resumed or created");

  // And it must actually refuse.
  const after = body.slice(gate, gate + 500);
  assert.match(after, /allowed/, "the decision must be read");
  assert.match(after, /return\s*\{\s*ok:\s*false/, "a refused instrument must not proceed");
});

test("the gate reads the real environment, not a caller-supplied opinion", () => {
  const action = code("lib/actions/wellbeing.ts");
  const start = action.indexOf("export async function beginWellbeingPulse");
  const body = action.slice(start, action.indexOf("export ", start + 40));
  assert.match(body, /isProduction:\s*isProductionEnvironment\(\)/);
  assert.match(body, /demoEnabled:\s*isWellbeingDemoEnabled\(\)/);
});

/* ── 3 · no OTHER route creates an attempt ───────────────────────────── */

function walk(dir: URL): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const child = new URL(`${entry}${entry.includes(".") ? "" : "/"}`, dir);
    const path = decodeURIComponent(child.pathname);
    if (statSync(path).isDirectory()) out.push(...walk(child));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

test("wellbeing_sessions is inserted from exactly one place", () => {
  const roots = [new URL("lib/", ROOT), new URL("app/", ROOT), new URL("components/", ROOT)];
  const writers: string[] = [];

  for (const root of roots) {
    for (const file of walk(root)) {
      if (file.endsWith("/lib/db/types.ts")) continue; // generated types, no queries
      const source = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/.*$/gm, " ");
      // An insert into wellbeing_sessions, in either query style.
      const chained = /from\("wellbeing_sessions"\)\s*\.insert\(/.test(source);
      const sqlish = /insert\s+into\s+public\.wellbeing_sessions/i.test(source);
      if (chained || sqlish) writers.push(file.slice(decodeURIComponent(ROOT.pathname).length));
    }
  }

  assert.deepEqual(
    writers,
    ["lib/actions/wellbeing.ts"],
    "a new attempt-creating route must consult canServeToParticipants — add it, then update this list",
  );
});

/* ── 4 · what activation is, and what it is not ─────────────────────── */

/**
 * The registry composition, pinned in ONE place.
 *
 * The sets above are derived, so an empty set passes every loop. This is the
 * assertion that makes switching an instrument on or off a deliberate act:
 * it fails here, with a message that says what to confirm, rather than
 * silently emptying the loops that were protecting it.
 */
test("the activation state is derived from the registry and pinned once", () => {
  assert.deepEqual(
    [...ACTIVE].sort(),
    ["disc360_wellbeing_v1", "ghq12", "ghq28", "who5"],
    "an instrument changed status — confirm the authorisation, then update this pin",
  );
  assert.deepEqual([...HELD].sort(), []);
});

/**
 * SERVING AND RELEASING ARE DIFFERENT ANSWERS.
 *
 * Everything above is about whether a participant in the authorised internal
 * test may open an instrument. None of it says anything about whether the
 * instrument may be sold or published — and the moment those two are read as
 * one word, "active" starts meaning "shipped".
 */
test("participant serving does not imply external or commercial release", () => {
  for (const key of ACTIVE) {
    if (INSTRUMENTS[key].releaseScope === "general_release") continue;
    assert.equal(
      canReleaseExternally(key).allowed,
      false,
      `${key} serves participants in the internal test but is not cleared for release`,
    );
  }
});
