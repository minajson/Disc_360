import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { test } from "node:test";
import {
  canServeToParticipants,
  INSTRUMENTS,
  INSTRUMENT_KEYS,
  type InstrumentKey,
} from "../../data/wellbeing-instruments.ts";
import { isDemoEnabled, isProduction } from "./environment-rules.ts";

/**
 * No route may create a participant attempt on a held instrument.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE BYPASS THIS FILE WAS WRITTEN AFTER FINDING.
 *
 * The serving gate is enforced in the application layer — there is no
 * `servable` column, so the database cannot refuse a held instrument on its
 * own. That is acceptable only while every path into an attempt actually
 * consults the gate, and one did not.
 *
 * `startWellbeingPulseAction` called `checkCampaignReadiness` — the only
 * participant-path caller of `canServeToParticipants` — inside `if (teamId)`.
 * A SOLO attempt has no team, and a solo attempt is also the only case where
 * the instrument key comes from the client. The single remaining barrier was
 * `getActiveQuestionnaire`, which tests `is_active`: a question about whether
 * CONTENT exists, not about whether it may be SERVED.
 *
 * Those two answers agree today only because held content is not loaded in
 * production. Migration 00040 loads it. On the deployment that ships 00040, a
 * signed-in participant posting `{ instrumentKey: "who5" }` with no team would
 * have opened a real attempt on a held instrument.
 *
 * So the gate is no longer reached through a branch. These tests assert that,
 * and assert the decision itself for the two held instruments by name.
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
 * The instruments that must never reach a participant in production.
 *
 * All three third-party instruments. GHQ-12 joined them when its missing GL
 * Assessment attribution wording was recognised as a release blocker rather
 * than a documentation gap — see lib/wellbeing/licensing.test.ts.
 */
const HELD: InstrumentKey[] = ["ghq12", "ghq28", "who5"];

/* ── 1 · the decision itself, for each held instrument by name ───────── */

test("WHO-5 and GHQ-28 are refused in production under every flag combination", () => {
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

test("a refusal carries a reason, so a participant is not shown a blank failure", () => {
  for (const key of HELD) {
    const decision = canServeToParticipants(key, { isProduction: true, demoEnabled: true });
    assert.equal(decision.allowed, false);
    assert.ok(
      typeof decision.reason === "string" && decision.reason.length > 0,
      `${key} must explain why it is unavailable`,
    );
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

/* ── 4 · the held set is exactly what the registry says ──────────────── */

test("the held set is derived from the registry, not maintained by hand", () => {
  const heldByStatus = INSTRUMENT_KEYS.filter((key) => INSTRUMENTS[key].status !== "active");
  assert.deepEqual(
    [...heldByStatus].sort(),
    [...HELD].sort(),
    "an instrument changed status — decide deliberately, then update this test",
  );
});
