import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const MIGRATION = read("supabase/migrations/00031_wellbeing_pilot_capacity.sql");
const PILOT = read("lib/wellbeing/pilot.ts");

/* ── the capacity is enforced where the row is written ───────────────── */

test("capacity is a database trigger, not a disabled button", () => {
  assert.match(
    MIGRATION,
    /create trigger wellbeing_pilot_capacity\s+before insert on public\.wellbeing_sessions/,
    "a replayed request, a second tab or a script all reach the insert directly",
  );
});

test("the trigger locks the campaign before counting, so joins cannot race", () => {
  const fn = MIGRATION.slice(MIGRATION.indexOf("function public.enforce_wellbeing_pilot_capacity"));
  const lock = fn.indexOf("for update");
  const count = fn.indexOf("count(distinct s.profile_id)");
  assert.ok(lock > 0, "the campaign row must be locked");
  assert.ok(
    lock < count,
    "the lock must be taken BEFORE the count, or two simultaneous joins both read the old total",
  );
});

test("capacity counts distinct PEOPLE — not sessions, attempts or results", () => {
  assert.match(MIGRATION, /count\(distinct s\.profile_id\)/);
  assert.ok(
    !/count\(\*\)\s+into\s+v_joined/i.test(MIGRATION),
    "counting rows would let one person's retake consume someone else's place",
  );
});

test("a participant who already holds a place is never refused", () => {
  const fn = MIGRATION.slice(MIGRATION.indexOf("function public.enforce_wellbeing_pilot_capacity"));
  const exempt = fn.indexOf("s.profile_id = new.profile_id");
  const raise = fn.indexOf("raise exception");
  assert.ok(exempt > 0 && exempt < raise, "the returning-participant exemption must precede the refusal");
});

test("a solo attempt belongs to no campaign and is never capped", () => {
  const fn = MIGRATION.slice(MIGRATION.indexOf("function public.enforce_wellbeing_pilot_capacity"));
  assert.match(fn, /if new\.team_id is null then\s+return new;/);
});

test("NULL capacity means unrestricted, and is the default for every campaign", () => {
  assert.match(MIGRATION, /add column wellbeing_pilot_capacity int/);
  assert.ok(
    !/wellbeing_pilot_capacity int[^;]*not null/i.test(MIGRATION),
    "an existing campaign must not acquire a cap by migrating",
  );
  const fn = MIGRATION.slice(MIGRATION.indexOf("function public.enforce_wellbeing_pilot_capacity"));
  assert.match(fn, /if v_capacity is null then\s+return new;/);
});

/* ── §4 · the number 10 is governance, never a scoring input ─────────── */

const SCORING_AND_ANALYTICS = [
  "lib/scoring/disc360-wellbeing.ts",
  "lib/scoring/ghq28.ts",
  "lib/scoring/who5.ts",
  "lib/wellbeing/analytics.ts",
  "lib/wellbeing/aggregate.ts",
  "lib/wellbeing/suppression.ts",
  "lib/wellbeing/report.ts",
  "lib/reports/model.ts",
  "data/wellbeing-instruments.ts",
  "data/disc360-wellbeing-items.ts",
];

test("no scoring, analytics, history or report module knows the pilot capacity exists", () => {
  for (const path of SCORING_AND_ANALYTICS) {
    const source = read(path);
    for (const term of ["pilot_capacity", "pilotCapacity", "readPilotStatus", "PilotStatus"]) {
      assert.ok(
        !source.includes(term),
        `${path} references ${term} — an admission control must never become an input to a figure`,
      );
    }
  }
});

test("lifting the cap changes admission only — no stored result is touched", () => {
  // The migration adds a column, an index, a trigger and a read-only counter.
  // If it ever rewrote a result, setting capacity to NULL could not be safe.
  assert.ok(
    !/update\s+public\.wellbeing_results/i.test(MIGRATION),
    "the capacity migration must not rewrite results",
  );
  assert.ok(
    !/delete\s+from\s+public\.wellbeing_(results|sessions|responses)/i.test(MIGRATION),
    "the capacity migration must not delete participant data",
  );
});

/* ── §6 · capacity and licensing are two independent controls ────────── */

test("capacity does not mention any instrument, so it cannot open one", () => {
  for (const key of ["ghq12", "ghq28", "who5", "disc360_wellbeing_v1"]) {
    assert.ok(
      !MIGRATION.includes(key),
      `the capacity control must be instrument-agnostic — found ${key}`,
    );
  }
  assert.ok(
    !/content_status|is_active|licence|license/i.test(MIGRATION),
    "capacity must not touch the licensing gate",
  );
});

test("the join action checks the licensing gate before it ever reaches capacity", () => {
  const action = read("lib/actions/wellbeing.ts");
  const begin = action.slice(action.indexOf("export async function beginWellbeingPulse"));
  const licence = begin.indexOf("getActiveQuestionnaire");
  const capacity = begin.indexOf("isPilotCapacityError");
  assert.ok(licence > 0 && capacity > 0, "both controls must be present");
  assert.ok(
    licence < capacity,
    "a structure-only instrument must be refused on content, never admitted because a place was free",
  );
});

/* ── the participant-facing surface ──────────────────────────────────── */

test("a full pilot reads as a courteous message, not a database error", () => {
  assert.match(PILOT, /This pilot has reached its participant capacity\./);
});

test("the refusal is matched on a stable marker, not on prose", () => {
  assert.match(PILOT, /PILOT_CAPACITY_REACHED/);
  assert.match(MIGRATION, /hint = 'PILOT_CAPACITY_REACHED'/);
});

test("the status function returns integers only — never an identity", () => {
  assert.match(
    MIGRATION,
    /returns table \(capacity int, joined int, completed int, in_progress int\)/,
  );
  assert.ok(
    !/select\s+s\.profile_id\s*(,|from)/i.test(
      MIGRATION.slice(MIGRATION.indexOf("function public.wellbeing_pilot_status")),
    ),
    "the dashboard needs counts, not people",
  );
  assert.match(MIGRATION, /revoke all on function public\.wellbeing_pilot_status/);
});

test("the pilot panel is given counts and a link, and nothing else", () => {
  const panel = read("components/wellbeing/PilotPanel.tsx");
  // Screen the PROPS, not the prose — the comment above them says "no score",
  // and a substring match on the whole file would flag that as a violation.
  const props = panel.slice(panel.indexOf("}: {"), panel.indexOf("}) {"));
  for (const term of ["profileId", "profile_id", "email", "score", "name:"]) {
    assert.ok(!props.includes(term), `the panel must not receive ${term}`);
  }
  // What it may receive: counts, two strings that name the campaign and the
  // instrument, and the link.
  for (const allowed of ["capacity", "joined", "completed", "inProgress", "remaining", "joinUrl"]) {
    assert.ok(props.includes(allowed), `the panel needs ${allowed}`);
  }
});
