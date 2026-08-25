import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * A guard on the one edit that would turn group reporting into individual
 * reporting.
 *
 * lib/wellbeing/analytics.ts reads results with the service role, because
 * individual wellbeing rows are unreadable under RLS by design. What keeps
 * that bypass safe is that the SELECT list contains no identifying column —
 * so this test reads the module as text and asserts exactly that.
 *
 * Deliberately a source-level assertion rather than a runtime one: the danger
 * is a future author adding `profile_id` to the column list for a reasonable
 * reason, and no amount of runtime testing of the current shape catches that.
 */

const SOURCE = readFileSync(new URL("./analytics.ts", import.meta.url), "utf8");

/**
 * Pulled from the module rather than duplicated, so they cannot drift.
 *
 * Nested selects (`table (a, b)`) are flattened to the joined table plus its
 * own columns, so a nested join cannot smuggle an identifying column past the
 * check by hiding inside parentheses.
 */
function extractColumns(): string[] {
  const match = SOURCE.match(/WELLBEING_ANALYTICS_COLUMNS\s*=\s*\n?\s*"([^"]+)"/);
  assert.ok(match, "WELLBEING_ANALYTICS_COLUMNS must be a single string literal");
  return match![1]!
    .replace(/[()]/g, ",")
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);
}

test("the analytics column list is exactly what group reporting needs", () => {
  assert.deepEqual(extractColumns().sort(), [
    "at_or_above_threshold",
    "completed_at",
    "department_at_completion",
    "dimension_key",
    "index_score",
    "index_score",
    "instrument_key",
    "item_positions",
    "office_location_at_completion",
    "team_id",
    "threshold_at_completion",
    "total_score",
    "wellbeing_result_dimensions",
    "work_location_at_completion",
  ]);
});

test("no identifying column is ever selected by analytics", () => {
  const columns = extractColumns();
  for (const forbidden of [
    "profile_id",
    "session_id",
    "id",
    "contact_email",
    "job_title_at_completion",
  ]) {
    assert.ok(
      !columns.includes(forbidden),
      `${forbidden} must never be read by aggregate analytics`,
    );
  }
});

test("the Likert 0–36 measure is not exposed to management analytics", () => {
  assert.ok(
    !extractColumns().includes("likert_score"),
    "the secondary continuous measure is stored for research, not shown by default",
  );
});

test("analytics never selects a wellbeing_responses row", () => {
  assert.ok(
    !/from\(["']wellbeing_responses["']\)/.test(SOURCE),
    "item-level analytics reads the stored positions on the result, never the response table",
  );
});

test("every analytics read is pinned to the authorised organisation", () => {
  // Each service-role query on wellbeing_results must carry the org filter.
  const reads = SOURCE.split('from("wellbeing_results")').slice(1);
  assert.ok(reads.length > 0, "the module reads wellbeing_results");
  for (const read of reads) {
    const head = read.slice(0, 600);
    assert.match(
      head,
      /\.eq\("organization_id", organizationId\)/,
      "a wellbeing_results read is not pinned to the authorised organisation",
    );
    assert.match(
      head,
      /\.eq\("instrument_key", instrumentKey\)/,
      "a wellbeing_results read is not pinned to exactly one instrument",
    );
  }
});

test("authorization runs before the service role is created", () => {
  const guardIndex = SOURCE.indexOf("requireWellbeingAnalyst(organizationId)");
  const resolveIndex = SOURCE.indexOf("async function resolveContext");
  assert.ok(guardIndex > resolveIndex, "the guard lives inside resolveContext");
  // Every exported entry point resolves context first.
  for (const entry of [
    "getWellbeingWorkspace",
    "getWellbeingComparison",
    "getWellbeingSignals",
    "getWellbeingDimensionProfile",
  ]) {
    const body = SOURCE.slice(SOURCE.indexOf(`export async function ${entry}`));
    const contextCall = body.indexOf("await resolveContext(organizationId");
    const adminCall = body.indexOf("createSupabaseAdminClient()");
    assert.ok(contextCall >= 0, `${entry} must resolve context`);
    assert.ok(
      adminCall === -1 || contextCall < adminCall,
      `${entry} must authorize before creating the service-role client`,
    );
  }
});

test("suppression is applied in every cohort-producing path", () => {
  for (const entry of ["getWellbeingComparison", "getWellbeingSignals"]) {
    const body = SOURCE.slice(
      SOURCE.indexOf(`export async function ${entry}`),
      SOURCE.indexOf(`export async function ${entry}`) + 3000,
    );
    assert.match(body, /suppressPartition\(/, `${entry} must apply partition suppression`);
    assert.match(body, /minCohort: context\.minCohort/, `${entry} must use the governed floor`);
  }
  const workspace = SOURCE.slice(SOURCE.indexOf("export async function getWellbeingWorkspace"));
  assert.match(workspace, /checkSlice\(/, "the overview must check its own cohort size");
});


/* ── suppression counts people, not rows ────────────────────────────── */

test("cohort suppression is decided on distinct PARTICIPANTS", () => {
  // Longitudinal data makes rows and people diverge: four people across four
  // waves are sixteen rows and still four people. The floor protects people.
  assert.match(SOURCE, /readParticipantCounts\(/, "a participant counter exists");
  assert.match(
    SOURCE,
    /checkSlice\(counts\.overall, context\.minCohort\)/,
    "the overview gate uses the participant count",
  );
  assert.match(
    SOURCE,
    /completed: scopeCounts\.get\(key\) \?\? 0/,
    "each cohort's suppression input is its participant count",
  );
  assert.ok(
    !/completed: scores\.length/.test(SOURCE) && !/completed: positions\.length/.test(SOURCE),
    "no cohort may be gated on, or labelled with, how many results it holds",
  );
});

test("the participant counter returns integers only — no identifiers", () => {
  const migration = readFileSync(
    new URL("../../supabase/migrations/00030_wellbeing_participant_counts.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /returns table \(scope text, cohort text, participants int\)/);
  assert.match(migration, /count\(distinct r\.profile_id\)/, "it counts people");
  assert.ok(
    !/select\s+r\.profile_id\s*(,|from)/i.test(migration),
    "it must never return a profile id",
  );
  assert.match(migration, /security definer/i);
  assert.match(migration, /revoke all on function/i, "and is not callable by just anyone");
});

/* ── the organisation is named, not described ────────────────────────── */

test("the organisation name is read with the service role, after authorisation", () => {
  const context = SOURCE.slice(SOURCE.indexOf("async function resolveContext"));
  const nameRead = context.slice(0, context.indexOf("return {"));
  // A wellbeing role is deliberately NOT organisation membership, so RLS on
  // `organizations` refuses most legitimate analysts and every heading and
  // exported report fell back to the literal word "Organisation".
  assert.ok(
    !/access\.supabase\s*\n?\s*\.from\("organizations"\)/.test(nameRead),
    "reading the name through the caller's client empties it for most analysts",
  );
  assert.match(nameRead, /createSupabaseAdminClient\(\)/, "read it with the service role");
  // And only AFTER the guard has authorised this caller for this organisation.
  assert.ok(
    context.indexOf("requireWellbeingAnalyst") < context.indexOf('from("organizations")'),
    "authorisation must precede the read",
  );
});
