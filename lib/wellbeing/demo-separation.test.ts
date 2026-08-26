import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildDemoPopulation,
  demoParticipantCounts,
  DEMO_INVITED,
  ILLUSTRATIVE_DATA_BANNER,
} from "./demo-population.ts";
import { INSTRUMENT_KEYS, INSTRUMENTS } from "../../data/wellbeing-instruments.ts";
import { suppressPartition, DEFAULT_MIN_COHORT } from "./suppression.ts";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

/**
 * Source with comments stripped.
 *
 * The modules under test EXPLAIN in prose what they must never do — "must not
 * seed rows into wellbeing_results" — so screening the raw file would flag the
 * very comment documenting the rule. Only executable lines are evidence.
 */
function code(path: string): string {
  return read(path)
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

/* ── live and demo can never mix ─────────────────────────────────────── */

test("the demo population is generated, never read from a participant table", () => {
  const source = code("lib/wellbeing/demo-population.ts");
  for (const forbidden of [
    "createSupabaseAdminClient",
    "wellbeing_results",
    "wellbeing_sessions",
    "supabase",
  ]) {
    assert.ok(
      !source.includes(forbidden),
      `the demo population must not touch the database — found ${forbidden}`,
    );
  }
  // A table read specifically, rather than the bare word "from" — `Array.from`
  // is legitimate and matching it produced a false failure.
  assert.ok(
    !/\b\w+\.from\(\s*["'`]/.test(source),
    "the demo population must not read a table",
  );
});

test("nothing writes the demo population anywhere", () => {
  const source = code("lib/wellbeing/demo-population.ts");
  for (const forbidden of ["insert", "upsert", "update(", "delete("]) {
    assert.ok(!source.includes(forbidden), `synthetic figures must never be stored — found ${forbidden}`);
  }
});

test("the loader returns one source or the other, never both", () => {
  const analytics = read("lib/wellbeing/analytics.ts");
  const loader = analytics.slice(
    analytics.indexOf("async function loadAnalyticsRows"),
    analytics.indexOf("export async function getWellbeingWorkspace"),
  );
  assert.match(loader, /if \(source === "demo"\)/, "the demo branch returns early");
  // The demo branch must return before any read of a participant table.
  const demoBranch = loader.slice(0, loader.indexOf("readOrganizationResults"));
  assert.match(demoBranch, /return \{/, "the demo branch returns before the live read");
  assert.ok(
    !/\.concat\(|\[\.\.\.rows, \.\.\./.test(loader),
    "live and demo rows must never be combined",
  );
});

test("live is the default — a missing or unknown source never shows demo data", () => {
  const analytics = read("lib/wellbeing/analytics.ts");
  assert.match(analytics, /source: AnalyticsSource = "live"/, "entry points default to live");
  const parser = analytics.slice(
    analytics.indexOf("export function parseAnalyticsSource"),
    analytics.indexOf("export function localFixtureOffered"),
  );
  assert.match(parser, /if \(value === "demo"\) return "demo";/, "demo is matched exactly");
  assert.match(parser, /return "live";\n\}/, "everything else falls through to live");
  // The fixture is customer-shaped, so recognising it is conditional on the
  // environment rather than on the string alone.
  assert.match(
    parser,
    /value === "fixture" && localFixtureAllowed\(/,
    "the fixture is only recognised where the environment permits it",
  );
});

/* ── the demo carries its label ──────────────────────────────────────── */

test("demo surfaces are labelled ILLUSTRATIVE DEMO DATA", () => {
  assert.equal(ILLUSTRATIVE_DATA_BANNER, "ILLUSTRATIVE DEMO DATA");
  const swtch = read("components/wellbeing/analytics/SourceSwitch.tsx");
  assert.match(swtch, /ILLUSTRATIVE_DATA_BANNER/);
  // The banner is keyed off the source rather than rendered unconditionally,
  // and "live" is deliberately absent from the table — a live figure must
  // never sit under a synthetic-data banner, and vice versa.
  assert.match(swtch, /demo: \{ label: ILLUSTRATIVE_DATA_BANNER/);
  assert.ok(!/live: \{ label:/.test(swtch), "live carries no synthetic-data banner");
  assert.match(swtch, /\{banner && \(/, "the banner renders only when the source has one");
});

/* ── the demo is honest about the product's real behaviour ───────────── */

test("every instrument's demo figures sit inside that instrument's own scale", () => {
  for (const key of INSTRUMENT_KEYS) {
    const instrument = INSTRUMENTS[key];
    const rows = buildDemoPopulation(key);
    assert.ok(rows.length > 0, `${key} produced no demo rows`);
    for (const row of rows) {
      const reported = instrument.primaryScoreMax === 100 ? (row.index_score ?? -1) : row.total_score;
      assert.ok(
        reported >= instrument.primaryScoreMin && reported <= instrument.primaryScoreMax,
        `${key} demo score ${reported} is outside ${instrument.primaryScoreMin}–${instrument.primaryScoreMax}`,
      );
      assert.equal(row.instrument_key, key, "a demo row must name its own instrument");
    }
  }
});

test("only instruments that legitimately have a threshold carry one", () => {
  for (const key of INSTRUMENT_KEYS) {
    const rows = buildDemoPopulation(key);
    const hasThreshold = INSTRUMENTS[key].hasThreshold;
    for (const row of rows) {
      if (hasThreshold) {
        assert.notEqual(row.threshold_at_completion, null, `${key} should carry a threshold`);
      } else {
        assert.equal(
          row.threshold_at_completion,
          null,
          `${key} has no validated cut-off and must not show one`,
        );
      }
    }
  }
});

test("dimensions appear only where the instrument legitimately has them", () => {
  for (const key of INSTRUMENT_KEYS) {
    const rows = buildDemoPopulation(key);
    const dims = rows[0]!.wellbeing_result_dimensions;
    if (key === "disc360_wellbeing_v1") {
      assert.equal(dims?.length, 6, "six workplace dimensions");
    } else if (key === "ghq28") {
      assert.equal(dims?.length, 4, "four published subscales, no more and no fewer");
      for (const dim of dims!) {
        // Namespaced to the instrument, matching the registry. An unprefixed
        // key joins to nothing and empties the profile silently.
        assert.match(dim.dimension_key, /^ghq28_/, "subscale keys are instrument-namespaced");
      }
      for (const dim of dims!) {
        // Each subscale is seven items, so it cannot exceed seven, and it
        // carries no threshold of its own anywhere in the product.
        assert.ok(dim.index_score >= 0 && dim.index_score <= 7, "a subscale is scored 0–7");
      }
    } else {
      assert.equal(dims, null, `${key} must not invent dimensions`);
    }
  }
});

test("the demo counts distinct PEOPLE, not rows", () => {
  const rows = buildDemoPopulation("disc360_wellbeing_v1");
  const counts = demoParticipantCounts(rows);
  // Four waves each, so rows are four times the people.
  assert.equal(rows.length, counts.overall * 4, "each person contributes exactly four waves");
  assert.ok(counts.overall < DEMO_INVITED, "participation must be below 100%");
  const departments = counts.byScope.get("department")!;
  assert.equal(departments.get("Legal"), 4, "Legal is deliberately below the floor");
  assert.equal(departments.get("Operations"), 14);
});

test("the demo genuinely demonstrates suppression rather than describing it", () => {
  const rows = buildDemoPopulation("disc360_wellbeing_v1");
  const counts = demoParticipantCounts(rows);
  const departments = counts.byScope.get("department")!;

  const result = suppressPartition(
    [...departments.entries()].map(([key, people]) => ({
      key,
      label: key,
      completed: people,
      stats: { completed: people },
    })),
    { minCohort: DEFAULT_MIN_COHORT },
  );

  const withheld = result.cohorts.filter((cohort) => cohort.suppressed).map((cohort) => cohort.label);
  assert.ok(withheld.includes("Legal"), "the four-person cohort is withheld");
  assert.ok(
    withheld.length >= 2,
    "complementary suppression must withhold a second cohort so the first cannot be recovered",
  );
  assert.ok(
    result.publishedCount > 0,
    "and enough cohorts still publish for the comparison to be worth showing",
  );
});

test("the demo describes no real customer's structure", () => {
  const rows = buildDemoPopulation("disc360_wellbeing_v1");
  const labels = new Set(
    rows.flatMap((row) => [
      row.department_at_completion ?? "",
      row.office_location_at_completion ?? "",
    ]),
  );
  for (const term of ["Shell", "Ogoni", "Nigeria", "Abuja", "Lagos", "Port Harcourt", "Warri"]) {
    for (const label of labels) {
      assert.ok(
        !label.toLowerCase().includes(term.toLowerCase()),
        `the illustrative population must be neutral — found "${label}"`,
      );
    }
  }
});

test("the demo population carries no identifier of any kind", () => {
  const rows = buildDemoPopulation("disc360_wellbeing_v1");
  const keys = new Set(rows.flatMap((row) => Object.keys(row)));
  for (const forbidden of ["profile_id", "session_id", "contact_email", "full_name", "email"]) {
    assert.ok(!keys.has(forbidden), `a demo row must not carry ${forbidden}`);
  }
});

test("the demo is deterministic — two builds are identical", () => {
  assert.deepEqual(
    buildDemoPopulation("disc360_wellbeing_v1"),
    buildDemoPopulation("disc360_wellbeing_v1"),
  );
});

/* ── participants and responses are different numbers ────────────────── */

test("the overview reports PEOPLE, not responses, against the roster", () => {
  const analytics = code("lib/wellbeing/analytics.ts");
  const workspace = analytics.slice(analytics.indexOf("export async function getWellbeingWorkspace"));
  // Participation must be computed from distinct participants. Dividing
  // responses by a headcount roster produced a rate above 100% the moment a
  // second wave ran — which is not a participation rate, it is a unit error.
  assert.match(workspace, /const participants = counts\.overall;/);
  assert.match(workspace, /participants \/ invited/, "participation is people over roster");
  assert.ok(
    !/overview\.completed \/ invited/.test(workspace),
    "responses must never be divided by a headcount",
  );
});

test("the overview labels responses as responses", () => {
  const page = code("app/(wellbeing)/wellbeing/analytics/page.tsx");
  assert.match(page, /label: "Participants"/, "the headline count is people");
  assert.match(page, /workspace\.participants/);
  assert.match(page, /response/, "the response total is still shown, named for what it is");
});

/* ── the demo carries answerable rows, not empty ones ────────────────── */

test("every demo row carries one response position per item of its instrument", () => {
  for (const key of INSTRUMENT_KEYS) {
    const rows = buildDemoPopulation(key);
    const expected = INSTRUMENTS[key].itemCount;
    for (const row of rows) {
      // An empty array is not "no data" to the item engine — it is a row of
      // the wrong length, and it raises. This was a real crash on the Signals
      // tab before the demo rows were sized to their instrument.
      assert.equal(
        row.item_positions.length,
        expected,
        `${key} rows must carry ${expected} item positions`,
      );
      for (const position of row.item_positions) {
        assert.ok(
          Number.isInteger(position) && position >= 0 && position <= 3,
          `${key} item position ${position} is outside every instrument's response range`,
        );
      }
    }
  }
});

/* ── the demo must not misrepresent its instrument ───────────────────── */

test("no instrument's demo piles responses onto an extreme of its scale", () => {
  for (const key of INSTRUMENT_KEYS) {
    const instrument = INSTRUMENTS[key];
    const rows = buildDemoPopulation(key);
    const reported = rows.map((row) =>
      instrument.primaryScoreMax === 100 ? (row.index_score ?? 0) : row.total_score,
    );
    const atFloor = reported.filter((v) => v === instrument.primaryScoreMin).length;
    const atCeiling = reported.filter((v) => v === instrument.primaryScoreMax).length;
    // Clamping is what produced a GHQ-12 demo with 94 of 236 responses at the
    // maximum — a demonstration that misrepresents the instrument.
    assert.ok(
      atFloor / reported.length < 0.15,
      `${key}: ${atFloor}/${reported.length} responses clamped to the floor`,
    );
    assert.ok(
      atCeiling / reported.length < 0.15,
      `${key}: ${atCeiling}/${reported.length} responses clamped to the ceiling`,
    );
  }
});

test("a distress instrument's demo keeps most responses below the cut-off", () => {
  for (const key of ["ghq12", "ghq28"] as const) {
    const instrument = INSTRUMENTS[key];
    const threshold = instrument.defaultThreshold ?? 4;
    const rows = buildDemoPopulation(key);
    const above = rows.filter((row) => row.total_score >= threshold).length;
    const share = (above / rows.length) * 100;
    // A demonstration reporting most of a workforce at or above a screening
    // cut-off misrepresents what these instruments typically show, and trains
    // a management audience to read the product as an alarm.
    assert.ok(
      share < 50,
      `${key} demo reports ${share.toFixed(1)}% at or above threshold ${threshold}`,
    );
  }
});

test("a distress instrument's demo does not describe a workforce in crisis", () => {
  for (const key of ["ghq12", "ghq28"] as const) {
    const instrument = INSTRUMENTS[key];
    const rows = buildDemoPopulation(key);
    const sorted = rows.map((row) => row.total_score).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    // A higher score means more reported distress. An illustrative population
    // sitting above the midpoint of a screening scale would teach management
    // to read the product as an alarm.
    assert.ok(
      median < instrument.primaryScoreMax / 2,
      `${key} demo median ${median} sits above the middle of a 0–${instrument.primaryScoreMax} distress scale`,
    );
  }
});
