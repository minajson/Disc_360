import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * The four pending migrations, reviewed as code rather than by eye.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS IS A TEST.
 *
 * These four will be applied to a database holding real DISC results, real
 * Focus results and real wellbeing responses, by hand, in one sitting. The
 * review question for each is the same — can this destroy or silently rewrite
 * something already there — and the answer has to survive somebody editing a
 * migration after it was reviewed and before it was run.
 *
 * So the review is executable. Each rule below is one thing that must be true
 * of a migration for it to be safe to run against production.
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../../", import.meta.url);
const read = (name: string) => readFileSync(new URL(`supabase/migrations/${name}`, ROOT), "utf8");

/** SQL with comment lines stripped — the prose explains what must not happen. */
const sql = (name: string) =>
  read(name)
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

const PENDING = [
  "00032_wellbeing_campaign_type.sql",
  "00033_wellbeing_campaign_scope.sql",
  "00034_wellbeing_waves.sql",
  "00035_wellbeing_sub_units.sql",
  "00036_wellbeing_join_context.sql",
];

test("every pending migration is present and non-empty", () => {
  for (const name of PENDING) assert.ok(read(name).length > 400, `${name} looks empty`);
});

test("no pending migration drops a table or deletes a row", () => {
  for (const name of PENDING) {
    const source = sql(name);
    for (const destructive of [
      /drop\s+table/i,
      /truncate/i,
      /delete\s+from/i,
      /drop\s+column/i,
      /drop\s+schema/i,
    ]) {
      assert.ok(
        !destructive.test(source),
        `${name} contains a destructive statement matching ${destructive}`,
      );
    }
  }
});

test("no pending migration touches DISC or Focus data", () => {
  for (const name of PENDING) {
    const source = sql(name);
    for (const table of [
      "assessment_results",
      "assessment_responses",
      "focus_results",
      "focus_responses",
      "combined_results",
    ]) {
      // Reading `assessment_sessions` to decide whether a team holds DISC work
      // is the one legitimate cross-product reference, and it is a SELECT.
      const writes = new RegExp(`(insert into|update)\\s+public\\.${table}\\b`, "i");
      assert.ok(!writes.test(source), `${name} writes to ${table}`);
    }
    assert.ok(
      !/update\s+public\.assessment_sessions|delete\s+from\s+public\.assessment_sessions/i.test(source),
      `${name} must not modify DISC sessions`,
    );
  }
});

test("no pending migration rewrites an existing wellbeing RESULT", () => {
  // The one exception is 00034's wave backfill, which sets a column that did
  // not exist a moment earlier. It must touch nothing else.
  for (const name of PENDING) {
    const source = sql(name);
    const updates = [...source.matchAll(/update\s+public\.wellbeing_results[\s\S]*?;/gi)].map(
      (match) => match[0],
    );
    for (const statement of updates) {
      assert.match(
        statement,
        /set wave_id = /,
        `${name} updates wellbeing_results for something other than the new wave column`,
      );
      assert.match(
        statement,
        /wave_id is null/,
        "and only where the new column is still unset, so a re-run is a no-op",
      );
    }
  }
});

test("every new table declares RLS and explicit policies", () => {
  for (const name of ["00034_wellbeing_waves.sql", "00035_wellbeing_sub_units.sql"]) {
    const source = sql(name);
    const tables = [...source.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]!);
    assert.ok(tables.length > 0, `${name} declares no table`);
    for (const table of tables) {
      assert.match(
        source,
        new RegExp(`alter table public\\.${table}\\s+enable row level security`),
        `${table} ships without RLS`,
      );
      assert.match(
        source,
        new RegExp(`create policy \\w+ on public\\.${table}\\s+for select`),
        `${table} has no SELECT policy`,
      );
    }
  }
});

test("no pending migration widens an existing policy", () => {
  for (const name of PENDING) {
    const source = sql(name);
    // Replacing or dropping an existing policy is how a boundary quietly
    // moves. New policies on new tables are fine; touching old ones is not.
    assert.ok(!/drop policy/i.test(source), `${name} drops a policy`);
    assert.ok(
      !/alter policy/i.test(source),
      `${name} alters an existing policy`,
    );
  }
});

test("every new lookup path is indexed", () => {
  for (const name of ["00034_wellbeing_waves.sql", "00035_wellbeing_sub_units.sql"]) {
    const source = sql(name);
    assert.match(source, /create (unique )?index/, `${name} adds no index`);
  }
  // The two columns joined on in every wave query.
  assert.match(sql("00034_wellbeing_waves.sql"), /wellbeing_results_wave_idx/);
  assert.match(sql("00035_wellbeing_sub_units.sql"), /wellbeing_results_sub_unit_idx/);
});

test("a function replaced rather than added keeps its permissions explicit", () => {
  // 00033 and 00034 both recreate wellbeing_participant_counts. A recreated
  // SECURITY DEFINER function loses its grants, so each must re-issue them —
  // otherwise the analytics layer silently loses access at the moment of
  // deployment.
  for (const name of ["00033_wellbeing_campaign_scope.sql", "00034_wellbeing_waves.sql"]) {
    const source = sql(name);
    if (!/drop function if exists public\.wellbeing_participant_counts/.test(source)) continue;
    assert.match(source, /revoke all on function public\.wellbeing_participant_counts/);
    assert.match(
      source,
      /grant execute on function public\.wellbeing_participant_counts[^;]*to service_role/,
    );
  }
});

test("the backfill fails loudly rather than leaving orphans", () => {
  const source = sql("00034_wellbeing_waves.sql");
  assert.match(
    source,
    /raise exception[\s\S]{0,80}with no wave/,
    "a partial wave backfill must abort the migration, not ship half-attached history",
  );
});

test("the public join RPC is the only thing granted to anon", () => {
  for (const name of PENDING) {
    const source = sql(name);
    const anonGrants = [...source.matchAll(/grant [^;]*to [^;]*anon[^;]*;/gi)].map((m) => m[0]);
    for (const grant of anonGrants) {
      assert.match(
        grant,
        /wellbeing_join_context/,
        `${name} grants anon access to something other than the public invitation lookup: ${grant}`,
      );
    }
  }
});
