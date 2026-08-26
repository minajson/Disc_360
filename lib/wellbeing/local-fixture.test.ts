import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildLocalFixture,
  localFixtureAllowed,
  localFixtureHeadcount,
  localFixtureParticipantCounts,
  LocalFixtureUnavailableError,
  LOCAL_FIXTURE_BANNER,
  LOCAL_FIXTURE_INVITED,
  LOCAL_FIXTURE_WAVES,
} from "./local-fixture.ts";
import { INSTRUMENT_KEYS, INSTRUMENTS } from "../../data/wellbeing-instruments.ts";
import { DEFAULT_MIN_COHORT, suppressPartition } from "./suppression.ts";

/**
 * The local development fixture describes a customer-shaped workforce —
 * Nigerian office locations, field and office work, real function names. That
 * is legitimate for local development and review, and illegitimate anywhere
 * else, so these tests hold the boundary at every place it could be lost.
 */

const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");

/** The values that may exist ONLY inside the fixture. */
const FIXTURE_ONLY_VALUES = ["Abuja", "Lagos", "Port Harcourt", "Warri"];

/* ── 1 · it cannot run in production ─────────────────────────────────── */

test("the fixture refuses to build in production", () => {
  assert.equal(localFixtureAllowed({ isProduction: true }), false);
  assert.throws(
    () => buildLocalFixture("disc360_wellbeing_v1", { isProduction: true }),
    LocalFixtureUnavailableError,
    "it must throw rather than fall back — a fallback publishes synthetic figures silently",
  );
});

test("the fixture builds outside production", () => {
  assert.equal(localFixtureAllowed({ isProduction: false }), true);
  assert.ok(buildLocalFixture("disc360_wellbeing_v1", { isProduction: false }).length > 0);
});

test("no flag, role or parameter widens the gate", () => {
  const source = read("lib/wellbeing/local-fixture.ts");
  const gate = source.slice(
    source.indexOf("export function localFixtureAllowed"),
    source.indexOf("/* ── the synthetic workforce"),
  );
  assert.match(gate, /return !env\.isProduction;/);
  assert.ok(
    !/WELLBEING_DEMO_MODE|is_super_admin|wellbeing_role/.test(gate),
    "the environment is the only condition",
  );
});

/* ── 2 · it can never become production data ─────────────────────────── */

test("the fixture writes nothing, anywhere", () => {
  const source = read("lib/wellbeing/local-fixture.ts")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
    })
    .join("\n");
  for (const forbidden of ["insert", ".from(", "supabase", "createSupabaseAdminClient"]) {
    assert.ok(
      !source.toLowerCase().includes(forbidden.toLowerCase()),
      `the fixture must not be able to reach the database — found "${forbidden}"`,
    );
  }
});

/**
 * Where a customer-specific value may and may not appear.
 *
 * `Africa/Lagos` is an IANA timezone identifier, not an organisational
 * location, and it is in the seed for a legitimate reason. Matching it here
 * would make the rule impossible to satisfy without misconfiguring a
 * timezone, so it is excluded explicitly rather than by loosening the match.
 */
function customerValuesIn(source: string): string[] {
  const cleaned = source.replaceAll("Africa/Lagos", "");
  return FIXTURE_ONLY_VALUES.filter((value) => cleaned.includes(value));
}

test("no migration carries a fixture-only value", () => {
  const migrations = readdirSync(new URL("supabase/migrations/", ROOT)).filter((n) =>
    n.endsWith(".sql"),
  );
  assert.ok(migrations.length > 0, "no migrations found — this test would be vacuous");
  for (const name of migrations) {
    assert.deepEqual(
      customerValuesIn(read(`supabase/migrations/${name}`)),
      [],
      `${name} must not carry customer-specific values — a migration ships everywhere`,
    );
  }
});

test("the production seed carries no fixture-only value", () => {
  assert.deepEqual(
    customerValuesIn(read("supabase/seed.sql")),
    [],
    "seed.sql is applied by `supabase db reset` and must describe no real customer",
  );
});

test("no shipped module carries a fixture-only value", () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(new URL(dir, ROOT), { withFileTypes: true })) {
      const path = `${dir}${entry.name}`;
      if (entry.isDirectory()) {
        if (["node_modules", ".next", ".git", ".next-test", "e2e"].includes(entry.name)) continue;
        walk(`${path}/`);
        continue;
      }
      // Only what SHIPS. A `.test.ts` file is itself a local development
      // fixture — including data/wellbeing-content.test.ts, which exists
      // precisely to name these values and assert no catalogue contains them.
      if (!/\.tsx?$/.test(entry.name) || entry.name.endsWith(".test.ts")) continue;
      if (path.startsWith("lib/wellbeing/local-fixture")) continue;
      if (customerValuesIn(read(path)).length > 0) offenders.push(path);
    }
  };
  for (const dir of ["lib/", "app/", "components/", "data/"]) walk(dir);

  assert.deepEqual(
    offenders,
    [],
    "customer-specific values leaked outside the local development fixture",
  );
});

test("the only SQL scripts naming these values refuse a non-local database", () => {
  // scripts/ holds local harnesses, not shipped artefacts. They may use these
  // values as test data — but only because seed-safety.test.ts independently
  // proves each of them aborts against anything but a local host. That link is
  // asserted here so the exemption cannot outlive the guard that justifies it.
  for (const name of readdirSync(new URL("scripts/", ROOT)).filter((n) => n.endsWith(".sql"))) {
    const source = read(`scripts/${name}`);
    if (customerValuesIn(source).length === 0) continue;
    assert.match(source, /^\\set ON_ERROR_STOP on$/m, `scripts/${name} must fail closed`);
    assert.match(source, /inet_server_addr\(\)/, `scripts/${name} must refuse a non-local host`);
  }
});

test("the fixture is labelled as development data wherever it is shown", () => {
  assert.equal(LOCAL_FIXTURE_BANNER, "LOCAL DEVELOPMENT FIXTURE");
  const swtch = read("components/wellbeing/analytics/SourceSwitch.tsx");
  assert.match(swtch, /fixture: \{ label: LOCAL_FIXTURE_BANNER/);
  assert.match(swtch, /fixtureOffered/, "the option renders only where the server permits it");
});

/* ── 3 · it demonstrates the product's real behaviour ────────────────── */

test("the fixture has four waves, three of them historical", () => {
  assert.ok(LOCAL_FIXTURE_WAVES.length >= 4, "trends need more than a before and an after");
  assert.deepEqual(
    LOCAL_FIXTURE_WAVES.map((wave) => wave.number),
    [1, 2, 3, 4],
    "wave numbers are the identity and must be consecutive from one",
  );
  assert.equal(
    new Set(LOCAL_FIXTURE_WAVES.map((wave) => wave.id)).size,
    LOCAL_FIXTURE_WAVES.length,
    "every wave needs its own id",
  );
});

test("two fixture waves deliberately share a calendar quarter", () => {
  // The case the old calendar-quarter wave rule destroyed: a baseline and a
  // post-intervention pulse either side of something the organisation did,
  // both landing in Q3. They must be two waves, and the fixture has to
  // contain the case or no view can be checked against it.
  const quarters = LOCAL_FIXTURE_WAVES.map((wave) => {
    const date = new Date(wave.at);
    return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
  });
  assert.ok(
    new Set(quarters).size < LOCAL_FIXTURE_WAVES.length,
    "the fixture must contain two waves in one quarter, or the regression is untestable",
  );
  const shared = quarters.filter((q, i) => quarters.indexOf(q) !== i);
  assert.equal(shared.length, 1, "exactly one such collision keeps the demonstration readable");
});

test("participation differs between waves and never reaches everyone", () => {
  const rows = buildLocalFixture("disc360_wellbeing_v1", { isProduction: false });
  const perWave = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = perWave.get(row.completed_at) ?? new Set<string>();
    set.add(row.person);
    perWave.set(row.completed_at, set);
  }
  const sizes = [...perWave.values()].map((set) => set.size);
  assert.equal(sizes.length, LOCAL_FIXTURE_WAVES.length);
  assert.ok(new Set(sizes).size > 1, "every wave the same size demonstrates nothing about participation");
  for (const size of sizes) {
    assert.ok(size < localFixtureHeadcount(), "a wave where everyone answers is not a realistic wave");
  }

  const participants = localFixtureParticipantCounts(rows).overall;
  assert.ok(
    participants < LOCAL_FIXTURE_INVITED,
    "the roster must exceed the answering population, or participation is always 100%",
  );
});

test("the department comparison publishes some cohorts and withholds others", () => {
  const rows = buildLocalFixture("disc360_wellbeing_v1", { isProduction: false });
  const counts = localFixtureParticipantCounts(rows).byScope.get("department")!;
  const result = suppressPartition(
    [...counts.entries()].map(([key, completed]) => ({ key, label: key, completed, stats: {} })),
    { minCohort: DEFAULT_MIN_COHORT },
  );
  assert.ok(result.publishedCount >= 3, "management must have something to compare");
  assert.ok(result.suppressedCount >= 2, "and must see confidentiality actually applied");
});

test("the office comparison forces complementary suppression", () => {
  const rows = buildLocalFixture("disc360_wellbeing_v1", { isProduction: false });
  const counts = localFixtureParticipantCounts(rows).byScope.get("office_location")!;
  assert.deepEqual(
    [...counts.keys()].sort(),
    ["Abuja", "Lagos", "Port Harcourt", "Warri"],
    "all four offices must appear",
  );
  const below = [...counts.values()].filter((n) => n < DEFAULT_MIN_COHORT).length;
  assert.equal(below, 1, "exactly one office below the floor is what makes the second rule engage");

  const result = suppressPartition(
    [...counts.entries()].map(([key, completed]) => ({ key, label: key, completed, stats: {} })),
    { minCohort: DEFAULT_MIN_COHORT },
  );
  assert.equal(result.suppressedCount, 2, "one below the floor, one withheld so it cannot be subtracted");
  assert.ok(
    result.cohorts.some((cohort) => cohort.reason === "complementary"),
    "and the second must be withheld for that reason",
  );
});

test("both work locations are publishable, so Field vs Office is demonstrable", () => {
  const rows = buildLocalFixture("disc360_wellbeing_v1", { isProduction: false });
  const counts = localFixtureParticipantCounts(rows).byScope.get("work_location")!;
  assert.deepEqual([...counts.keys()].sort(), ["field_based", "office_based"]);
  for (const [key, value] of counts) {
    assert.ok(value >= DEFAULT_MIN_COHORT, `${key} must be above the floor`);
  }
});

test("field-based responses carry no office location", () => {
  const rows = buildLocalFixture("disc360_wellbeing_v1", { isProduction: false });
  for (const row of rows) {
    if (row.work_location_at_completion !== "field_based") continue;
    assert.equal(
      row.office_location_at_completion,
      null,
      "the participant form does not ask a field-based person for an office",
    );
  }
});

test("departments genuinely differ, so the comparison is not four identical bars", () => {
  const rows = buildLocalFixture("disc360_wellbeing_v1", { isProduction: false });
  const byDepartment = new Map<string, number[]>();
  for (const row of rows) {
    const key = row.department_at_completion!;
    byDepartment.set(key, [...(byDepartment.get(key) ?? []), row.index_score!]);
  }
  const means = [...byDepartment.values()].map(
    (scores) => scores.reduce((a, b) => a + b, 0) / scores.length,
  );
  assert.ok(Math.max(...means) - Math.min(...means) >= 5, "cohorts must be distinguishable");
});

test("every instrument's fixture figures sit inside that instrument's own scale", () => {
  for (const key of INSTRUMENT_KEYS) {
    const instrument = INSTRUMENTS[key];
    for (const row of buildLocalFixture(key, { isProduction: false })) {
      const reported = instrument.primaryScoreMax === 100 ? row.index_score! : row.total_score;
      assert.ok(
        reported >= instrument.primaryScoreMin && reported <= instrument.primaryScoreMax,
        `${key} produced ${reported}, outside ${instrument.primaryScoreMin}–${instrument.primaryScoreMax}`,
      );
      assert.equal(row.item_positions.length, instrument.itemCount);
    }
  }
});

test("dimensions appear only where the instrument legitimately has them", () => {
  for (const key of INSTRUMENT_KEYS) {
    const row = buildLocalFixture(key, { isProduction: false })[0]!;
    const expected = key === "disc360_wellbeing_v1" ? 6 : key === "ghq28" ? 4 : 0;
    assert.equal(
      row.wellbeing_result_dimensions?.length ?? 0,
      expected,
      `${key} must not invent a factor structure it does not have`,
    );
  }
});

test("a distress instrument's fixture does not describe a workforce in crisis", () => {
  for (const key of ["ghq12", "ghq28"] as const) {
    const instrument = INSTRUMENTS[key];
    const rows = buildLocalFixture(key, { isProduction: false });
    const above = rows.filter((row) => row.at_or_above_threshold === true).length;
    assert.ok(
      above / rows.length < 0.5,
      `${instrument.name}: ${Math.round((above / rows.length) * 100)}% above the cut-off is not a general population`,
    );
  }
});

test("the fixture carries no identifier a real participant would have", () => {
  const keys = new Set(
    buildLocalFixture("disc360_wellbeing_v1", { isProduction: false }).flatMap((row) =>
      Object.keys(row),
    ),
  );
  for (const forbidden of ["profile_id", "session_id", "contact_email", "full_name", "email"]) {
    assert.ok(!keys.has(forbidden), `a fixture row must not carry ${forbidden}`);
  }
});

test("the fixture is deterministic — two builds are identical", () => {
  assert.deepEqual(
    buildLocalFixture("who5", { isProduction: false }),
    buildLocalFixture("who5", { isProduction: false }),
  );
});
