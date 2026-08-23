import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Business isolation, asserted at the source level.
 *
 * The requirement is not "wellbeing scores are currently not combined with
 * DISC" — it is that they CANNOT be. So these tests read the code rather than
 * exercise it: a runtime test proves today's call graph, and the risk here is
 * a future author writing the one function that adds a GHQ total to a
 * behavioural score for an apparently good reason.
 */

const ROOT = new URL("../../", import.meta.url).pathname;

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function walk(dir: string, predicate: (path: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    const full = join(ROOT, rel);
    if (statSync(full).isDirectory()) {
      out.push(...walk(rel, predicate));
    } else if (predicate(rel)) {
      out.push(rel);
    }
  }
  return out;
}

/* ── the wellbeing engine imports nothing from DISC or Focus ────────── */

test("the wellbeing scoring engine imports no DISC or Focus module", () => {
  const source = read("lib/scoring/wellbeing.ts");
  const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]!);
  assert.deepEqual(
    imports,
    ["../../data/wellbeing-items.ts"],
    "the engine's only dependency is its own questionnaire structure",
  );
});

test("no DISC or Focus scoring module imports the wellbeing engine", () => {
  for (const file of [
    "lib/scoring/compute-result.ts",
    "lib/scoring/pipeline.ts",
    "lib/scoring/archetype.ts",
    "lib/scoring/intensity.ts",
    "lib/scoring/focus.ts",
  ]) {
    const source = read(file);
    assert.ok(!source.includes("wellbeing"), `${file} must not reference wellbeing`);
    assert.ok(!source.includes("ghq"), `${file} must not reference GHQ`);
  }
});

test("the combined DISC + Focus insight layer is untouched by wellbeing", () => {
  for (const file of [
    "lib/insights/combined.ts",
    "lib/insights/combined-team.ts",
    "lib/insights/team.ts",
    "lib/insights/executive.ts",
    "lib/insights/analytics.ts",
    "lib/insights/facilitator.ts",
  ]) {
    const source = read(file).toLowerCase();
    assert.ok(!source.includes("wellbeing"), `${file} must not read wellbeing data`);
    assert.ok(!source.includes("ghq"), `${file} must not read GHQ data`);
  }
});

/* ── no composite exists anywhere ───────────────────────────────────── */

test("no module computes a composite across instruments", () => {
  const sources = [
    ...walk("lib/wellbeing", (path) => path.endsWith(".ts") && !path.endsWith(".test.ts")),
    "lib/scoring/wellbeing.ts",
    "lib/actions/wellbeing.ts",
    "lib/reports/model.ts",
  ];

  // Identifiers that would only exist if the instruments had been merged.
  const forbidden = [
    /overallScore/i,
    /combinedScore/i,
    /wellbeingIndex/i,
    /totalEmployeeScore/i,
    /score_d\b/,
    /score_i\b/,
    /archetype_code/,
    /automaticity/,
    /mental_load/,
  ];

  for (const path of sources) {
    const source = read(path);
    for (const pattern of forbidden) {
      // model.ts legitimately builds DISC and Focus reports; only its
      // wellbeing builder is in scope.
      const scoped =
        path === "lib/reports/model.ts"
          ? source.slice(source.indexOf("export function buildWellbeingReport"))
          : source;
      assert.ok(
        !pattern.test(scoped),
        `${path} matches ${pattern} — instruments must stay separate`,
      );
    }
  }
});

test("the wellbeing report carries no DISC, Focus or organisational figure", () => {
  const source = read("lib/reports/model.ts");
  const builder = source.slice(source.indexOf("export function buildWellbeingReport"));
  for (const forbidden of [
    "insightMap",
    "dimensionMeta",
    "FOCUS_PATTERNS",
    "combinedInsights",
    "median",
    "cohort",
    "organisationMedian",
  ]) {
    assert.ok(
      !builder.includes(forbidden),
      `the wellbeing report must not reference ${forbidden}`,
    );
  }
});

/* ── the analytics layer never ranks people ─────────────────────────── */

test("no wellbeing module sorts or ranks by score", () => {
  for (const path of walk("lib/wellbeing", (p) => p.endsWith(".ts") && !p.endsWith(".test.ts"))) {
    const source = read(path);
    assert.ok(
      !/sort\([^)]*total_score/.test(source) && !/sort\([^)]*totalScore/.test(source),
      `${path} must not order anything by wellbeing score`,
    );
  }
});

/* ── individual rows are unreachable from management surfaces ───────── */

test("no wellbeing module joins a result to a profile or a name", () => {
  for (const path of walk("lib/wellbeing", (p) => p.endsWith(".ts") && !p.endsWith(".test.ts"))) {
    const source = read(path);
    if (path === "lib/wellbeing/queries.ts" || path === "lib/wellbeing/report.ts") continue;
    assert.ok(
      !/wellbeing_results[\s\S]{0,300}profiles\s*\(/.test(source),
      `${path} must not join wellbeing results to profiles`,
    );
  }
});

test("the migration grants no cross-participant read on individual tables", () => {
  const migration = read("supabase/migrations/00023_wellbeing_pulse.sql");
  // Isolate each own-row policy and assert it carries no disjunction.
  for (const table of ["wellbeing_sessions", "wellbeing_responses", "wellbeing_results"]) {
    const section = migration.slice(
      migration.indexOf(`alter table public.${table} enable row level security;`),
    );
    const policies = section.slice(0, section.indexOf("alter table public.", 10) + 1);
    assert.ok(
      !policies.includes("is_super_admin"),
      `${table} policies must not admit a platform administrator`,
    );
    assert.ok(
      !policies.includes("is_team_admin"),
      `${table} policies must not admit a team administrator`,
    );
    assert.ok(
      !policies.includes("has_wellbeing_role"),
      `${table} policies must not admit a wellbeing role`,
    );
  }
});

test("has_wellbeing_role has no platform-administrator fallback", () => {
  const migration = read("supabase/migrations/00023_wellbeing_pulse.sql");
  const start = migration.indexOf("create or replace function public.has_wellbeing_role");
  const body = migration.slice(start, migration.indexOf("$$;", start));
  assert.ok(
    !body.includes("is_super_admin"),
    "a platform administrator must not inherit wellbeing access",
  );
});

test("wellbeing_results has no UPDATE or DELETE policy — history is immutable", () => {
  const migration = read("supabase/migrations/00023_wellbeing_pulse.sql");
  assert.ok(!/create policy \w+ on public\.wellbeing_results\s+for update/.test(migration));
  assert.ok(!/create policy \w+ on public\.wellbeing_results\s+for delete/.test(migration));
});
