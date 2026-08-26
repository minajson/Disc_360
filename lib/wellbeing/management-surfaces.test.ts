import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { buildLocalFixture, localFixtureParticipantCounts } from "./local-fixture.ts";
import { DEFAULT_MIN_COHORT, suppressPartition } from "./suppression.ts";

/**
 * Suppression, checked on every management surface individually.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY "IT IS APPLIED IN THE ANALYTICS LAYER" IS NOT ENOUGH.
 *
 * Suppression is applied once, server-side, before a figure becomes a return
 * value. That is the right design and it is not self-enforcing: a surface
 * leaks by taking a DIFFERENT route to the data — its own query, its own
 * aggregation, its own count — and every such route is a place the rule was
 * never applied rather than a place it was applied wrongly.
 *
 * So these tests check the routes. Every management surface must reach its
 * figures through the shared analytics functions, and none may hold a query,
 * a client or an arithmetic of its own. A surface that satisfies that cannot
 * leak a withheld cohort, because it never sees one.
 *
 * The behavioural half runs the real suppression engine over the real local
 * fixture and asserts that a withheld cohort carries no figure at all — not a
 * null-but-present median, not a count, not a share.
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");
const code = (path: string) =>
  read(path)
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
    })
    .join("\n");

/** Every surface that can display a management figure. */
const MANAGEMENT_SURFACES = [
  "app/(wellbeing)/wellbeing/admin/campaigns/[teamId]/page.tsx",
  "app/(wellbeing)/wellbeing/admin/campaigns/[teamId]/analytics/page.tsx",
  "app/(wellbeing)/wellbeing/admin/campaigns/[teamId]/compare/page.tsx",
  "app/(wellbeing)/wellbeing/admin/campaigns/[teamId]/trends/page.tsx",
  "app/(wellbeing)/wellbeing/admin/campaigns/[teamId]/reports/page.tsx",
  "app/(wellbeing)/wellbeing/analytics/page.tsx",
  "app/(wellbeing-present)/wellbeing/present/[teamId]/page.tsx",
  "lib/wellbeing/aggregate-report.ts",
  "lib/wellbeing/presentation.ts",
  "app/api/wellbeing/aggregate-report/route.ts",
];

/* ── every surface takes the same route to its figures ───────────────── */

test("no management surface queries a participant table itself", () => {
  for (const path of MANAGEMENT_SURFACES) {
    const source = code(path);
    for (const forbidden of [
      'from("wellbeing_results")',
      'from("wellbeing_result_dimensions")',
      'from("wellbeing_responses")',
      'from("wellbeing_sessions")',
      "wellbeing_participant_counts",
    ]) {
      assert.ok(
        !source.includes(forbidden),
        `${path} reaches ${forbidden} directly — suppression lives on the shared path`,
      );
    }
  }
});

test("no management surface computes an aggregate of its own", () => {
  for (const path of MANAGEMENT_SURFACES) {
    const source = code(path);
    for (const forbidden of ["aggregateScores(", "suppressPartition(", "itemSignals("]) {
      assert.ok(
        !source.includes(forbidden),
        `${path} aggregates for itself — a second implementation is a second place to forget the floor`,
      );
    }
  }
});

test("the presentation deck drops withheld cohorts before the payload exists", () => {
  const deck = code("lib/wellbeing/presentation.ts");
  assert.match(
    deck,
    /comparison\.view\.cohorts\.filter\(\s*\(cohort\) => !cohort\.suppressed && cohort\.stats,\s*\)/,
    "a withheld cohort must be filtered out on the server, not hidden in the client",
  );
  assert.match(
    deck,
    /movement\.view\.rows\.filter\(\s*\(row\) => !row\.suppressed/,
    "and the same for cohort movement",
  );
  // The client component navigates. It must not filter, fetch or recompute —
  // anything it could do to the data is something it could undo.
  const view = code("components/wellbeing/present/DeckView.tsx");
  for (const forbidden of ["fetch(", "suppressed", ".filter(", "useEffect(() => {\n    fetch"]) {
    assert.ok(!view.includes(forbidden), `the deck view must only navigate — found ${forbidden}`);
  }
});

test("the exported report carries nulls for a withheld cohort, never a figure", () => {
  const report = code("lib/wellbeing/aggregate-report.ts");
  assert.match(report, /participants: cohort\.suppressed \? null :/);
  assert.match(report, /median: cohort\.suppressed \? null :/);
  assert.match(report, /suppressed: cohort\.suppressed/);
});

test("the CSV and PDF paths are the same path", () => {
  // There is exactly one export pipeline and it calls the screen's own
  // functions. A separate export query is the classic way a document comes to
  // publish what the page withholds.
  const route = code("app/api/wellbeing/aggregate-report/route.ts");
  assert.match(route, /loadWellbeingAggregateReport\(/);
  assert.ok(
    !route.includes("createSupabaseAdminClient"),
    "the export route must issue no query of its own",
  );
});

/* ── switching filters cannot reconstruct a withheld cohort ──────────── */

test("a lone small cohort is never the only one withheld", () => {
  const rows = buildLocalFixture("disc360_wellbeing_v1", { isProduction: false });
  const counts = localFixtureParticipantCounts(rows).byScope;

  for (const [scope, cohorts] of counts) {
    const result = suppressPartition(
      [...cohorts.entries()].map(([key, completed]) => ({ key, label: key, completed, stats: {} })),
      { minCohort: DEFAULT_MIN_COHORT },
    );
    const withheld = result.cohorts.filter((cohort) => cohort.suppressed);
    assert.ok(
      withheld.length !== 1,
      `${scope}: exactly one withheld cohort is recoverable by subtracting the rest from the total`,
    );
  }
});

test("a withheld cohort carries no figure of any kind", () => {
  const rows = buildLocalFixture("ghq12", { isProduction: false });
  const counts = localFixtureParticipantCounts(rows).byScope.get("office_location")!;

  const result = suppressPartition(
    [...counts.entries()].map(([key, completed]) => ({
      key,
      label: key,
      completed,
      stats: { median: 3, mean: 3.4, p25: 2, p75: 5 },
    })),
    { minCohort: DEFAULT_MIN_COHORT },
  );

  for (const cohort of result.cohorts) {
    if (!cohort.suppressed) continue;
    assert.equal(cohort.stats, null, `${cohort.label} still carries stats`);
    assert.equal(cohort.completed, null, `${cohort.label} still carries a participant count`);
    // The label survives, deliberately: removing the row entirely would tell a
    // reader exactly which parts of the workforce are small, which is most of
    // what the suppression was protecting.
    assert.ok(cohort.label.length > 0);
    assert.ok(cohort.message, "and it says why it is absent");
  }
});

test("no filter combination publishes a group below the floor", () => {
  // The reconstruction attack is to slice the same population every available
  // way until some slice falls below the floor and is published anyway. Every
  // dimension the product offers is checked here against the real fixture.
  const rows = buildLocalFixture("disc360_wellbeing_v1", { isProduction: false });
  const byScope = localFixtureParticipantCounts(rows).byScope;

  assert.ok(byScope.size >= 4, "every comparison dimension must be exercised");
  for (const [scope, cohorts] of byScope) {
    const result = suppressPartition(
      [...cohorts.entries()].map(([key, completed]) => ({ key, label: key, completed, stats: {} })),
      { minCohort: DEFAULT_MIN_COHORT },
    );
    for (const cohort of result.cohorts) {
      if (cohort.suppressed) continue;
      assert.ok(
        (cohort.completed ?? 0) >= DEFAULT_MIN_COHORT,
        `${scope}/${cohort.label} published with ${cohort.completed} participants`,
      );
    }
  }
});

/* ── history stays versioned, and is never rescored ──────────────────── */

test("each result keeps the threshold that applied when it was completed", () => {
  const columns = read("lib/wellbeing/analytics.ts");
  assert.match(
    columns,
    /threshold_at_completion/,
    "the threshold in force at completion is stored per result",
  );
  assert.match(
    columns,
    /bucket\.thresholds\[0\] \?\? context\.threshold/,
    "and a wave is aggregated against ITS OWN threshold, not today's",
  );

  const migrations = readdirSync(new URL("supabase/migrations/", ROOT)).filter((n) =>
    n.endsWith(".sql"),
  );
  for (const name of migrations) {
    const source = read(`supabase/migrations/${name}`);
    assert.ok(
      !/update\s+public\.wellbeing_results[\s\S]{0,400}threshold_at_completion/i.test(source),
      `${name} rewrites a historical threshold — history must never be rescored`,
    );
  }
});

test("a threshold change breaks the rate series rather than smoothing over it", () => {
  const aggregate = code("lib/wellbeing/aggregate.ts");
  assert.match(aggregate, /thresholdConsistent: thresholds\.length <= 1/);
  const chart = code("components/wellbeing/analytics/AggregateTrend.tsx");
  assert.match(chart, /const drawShare = hasThreshold && trend\.thresholdConsistent;/);
  assert.match(chart, /\{drawShare && \(/, "the series is not drawn when the threshold moved");
});

/* ── the individual boundary, on the reporting surfaces ──────────────── */

test("no management surface links to an individual result or report", () => {
  for (const path of MANAGEMENT_SURFACES) {
    const source = code(path);
    assert.ok(
      !/\/wellbeing\/result\//.test(source),
      `${path} links to an individual result`,
    );
    assert.ok(
      !/api\/wellbeing\/report\//.test(source),
      `${path} links to an individual report`,
    );
  }
});

test("the individual report loader takes no participant identifier", () => {
  const report = code("lib/wellbeing/report.ts");
  assert.match(report, /export async function loadOwnWellbeingReport\(\s*resultId: string,\s*\)/);
  assert.ok(
    !/profileId|profile_id/.test(report),
    "there must be no argument a facilitator could supply to reach someone else's document",
  );
});
