import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LAGGING_COMPLETION,
  aggregateByGroup,
  behaviourClusters,
  completionAnalytics,
  dimensionHeatMap,
  executiveSummary,
  highBandDistribution,
  trendByMonth,
  type AnalyticsProfile,
  type AnalyticsTeam,
} from "./analytics.ts";
import type { ArchetypeCode, Dimension, DiscScores } from "../types/index.ts";

function analyticsProfile(
  group: string,
  scores: DiscScores,
  primary: Dimension,
  completedAt = "2026-03-15T10:00:00.000Z",
  archetypeCode: ArchetypeCode = "D",
  archetypeName = "The Commander",
): AnalyticsProfile {
  return {
    group,
    teamId: "team-1",
    teamName: "Atlas",
    scores,
    primary,
    archetypeCode,
    archetypeName,
    completedAt,
  };
}

function analyticsTeam(
  teamId: string,
  teamName: string,
  memberCount: number,
  completedCount: number,
): AnalyticsTeam {
  return {
    teamId,
    teamName,
    department: null,
    organizationName: "Meridian Group",
    memberCount,
    completedCount,
    averages: { d: 50, i: 50, s: 50, c: 50 },
  };
}

/* ── completion ─────────────────────────────────────────────────────── */

test("completion totals across teams and flags the laggards", () => {
  const teams = [
    analyticsTeam("a", "Atlas", 10, 9),
    analyticsTeam("b", "Beacon", 10, 4),
    analyticsTeam("c", "Cedar", 20, 2),
  ];
  const analytics = completionAnalytics(teams);
  assert.equal(analytics.memberCount, 40);
  assert.equal(analytics.completedCount, 15);
  assert.equal(analytics.rate, 38);
  assert.equal(analytics.teamsTracked, 3);
  assert.deepEqual(
    analytics.laggingTeams.map((team) => team.teamName),
    ["Cedar", "Beacon"],
  );
  assert.ok(analytics.laggingTeams.every((team) => team.rate < LAGGING_COMPLETION));
});

test("completion of an empty scope is zero, not NaN", () => {
  const analytics = completionAnalytics([]);
  assert.equal(analytics.rate, 0);
  assert.equal(analytics.memberCount, 0);
  assert.deepEqual(analytics.laggingTeams, []);
});

test("a team with no invited members cannot divide by zero", () => {
  const analytics = completionAnalytics([analyticsTeam("a", "Empty", 0, 0)]);
  assert.equal(analytics.rate, 0);
  assert.deepEqual(analytics.laggingTeams, []);
});

/* ── grouping ───────────────────────────────────────────────────────── */

test("groups aggregate averages, composition and lead, largest first", () => {
  const profiles = [
    analyticsProfile("Sales", { d: 80, i: 60, s: 30, c: 30 }, "D"),
    analyticsProfile("Sales", { d: 70, i: 50, s: 40, c: 40 }, "D"),
    analyticsProfile("Finance", { d: 30, i: 30, s: 50, c: 80 }, "C"),
  ];
  const groups = aggregateByGroup(profiles);
  assert.deepEqual(groups.map((group) => group.group), ["Sales", "Finance"]);
  assert.equal(groups[0]!.count, 2);
  assert.deepEqual(groups[0]!.averages, { d: 75, i: 55, s: 35, c: 35 });
  assert.equal(groups[0]!.lead, "D");
  assert.equal(groups[0]!.spread, 40);
  assert.deepEqual(groups[1]!.composition, { D: 0, I: 0, S: 0, C: 1 });
});

test("equal-sized groups fall back to alphabetical order", () => {
  const profiles = [
    analyticsProfile("Zeta", { d: 50, i: 50, s: 50, c: 50 }, "D"),
    analyticsProfile("Alpha", { d: 50, i: 50, s: 50, c: 50 }, "D"),
  ];
  assert.deepEqual(
    aggregateByGroup(profiles).map((group) => group.group),
    ["Alpha", "Zeta"],
  );
});

test("no profiles means no groups", () => {
  assert.deepEqual(aggregateByGroup([]), []);
});

/* ── heat map ───────────────────────────────────────────────────────── */

test("heat map scales intensity against its own range", () => {
  const groups = aggregateByGroup([
    analyticsProfile("Sales", { d: 80, i: 50, s: 40, c: 20 }, "D"),
    analyticsProfile("Finance", { d: 20, i: 50, s: 60, c: 80 }, "C"),
  ]);
  const heat = dimensionHeatMap(groups);
  assert.equal(heat.min, 20);
  assert.equal(heat.max, 80);
  assert.equal(heat.cells.length, 8);
  const hottest = heat.cells.find(
    (cell) => cell.group === "Sales" && cell.dimension === "D",
  )!;
  assert.equal(hottest.intensity, 1);
  const coldest = heat.cells.find(
    (cell) => cell.group === "Sales" && cell.dimension === "C",
  )!;
  assert.equal(coldest.intensity, 0);
});

test("a flat matrix renders mid-tone instead of dividing by zero", () => {
  const groups = aggregateByGroup([
    analyticsProfile("Sales", { d: 50, i: 50, s: 50, c: 50 }, "D"),
    analyticsProfile("Finance", { d: 50, i: 50, s: 50, c: 50 }, "D"),
  ]);
  const heat = dimensionHeatMap(groups);
  assert.ok(heat.cells.every((cell) => cell.intensity === 0.5));
});

test("an empty heat map is well formed", () => {
  assert.deepEqual(dimensionHeatMap([]), { groups: [], cells: [], min: 0, max: 0 });
});

/* ── clusters and bands ─────────────────────────────────────────────── */

test("behaviour clusters rank by size and share exactly 100", () => {
  const profiles = [
    analyticsProfile("A", { d: 80, i: 40, s: 30, c: 30 }, "D", undefined, "D", "The Commander"),
    analyticsProfile("A", { d: 78, i: 42, s: 30, c: 30 }, "D", undefined, "D", "The Commander"),
    analyticsProfile("A", { d: 40, i: 80, s: 30, c: 30 }, "I", undefined, "I", "The Catalyst"),
  ];
  const clusters = behaviourClusters(profiles);
  assert.equal(clusters[0]!.code, "D");
  assert.equal(clusters[0]!.count, 2);
  assert.equal(clusters.reduce((sum, cluster) => sum + cluster.share, 0), 100);
  assert.equal(clusters[1]!.name, "The Catalyst");
});

test("high-band distribution is independent per dimension", () => {
  const profiles = [
    analyticsProfile("A", { d: 80, i: 70, s: 20, c: 20 }, "D"),
    analyticsProfile("A", { d: 30, i: 65, s: 20, c: 20 }, "I"),
  ];
  const bands = highBandDistribution(profiles);
  assert.deepEqual(bands.map((band) => band.count), [1, 2, 0, 0]);
  assert.deepEqual(bands.map((band) => band.percentage), [50, 100, 0, 0]);
  // Deliberately sums past 100 — these are not shares of one whole.
  assert.ok(bands.reduce((sum, band) => sum + band.percentage, 0) > 100);
});

test("high-band distribution of an empty population is all zero", () => {
  assert.ok(highBandDistribution([]).every((band) => band.percentage === 0));
});

/* ── trend ──────────────────────────────────────────────────────────── */

const NOW = new Date("2026-03-20T00:00:00.000Z");

test("trend returns one bucket per month ending at now", () => {
  const points = trendByMonth([], NOW, 6);
  assert.equal(points.length, 6);
  assert.equal(points[5]!.key, "2026-03");
  assert.equal(points[5]!.label, "Mar");
  assert.equal(points[0]!.key, "2025-10");
});

test("trend keeps empty months rather than skipping them", () => {
  const points = trendByMonth(
    [analyticsProfile("A", { d: 60, i: 40, s: 40, c: 40 }, "D", "2026-03-02T00:00:00.000Z")],
    NOW,
    3,
  );
  assert.deepEqual(points.map((point) => point.count), [0, 0, 1]);
  assert.deepEqual(points[0]!.averages, { d: 0, i: 0, s: 0, c: 0 });
  assert.deepEqual(points[2]!.averages, { d: 60, i: 40, s: 40, c: 40 });
});

test("trend averages within a month and ignores out-of-window completions", () => {
  const points = trendByMonth(
    [
      analyticsProfile("A", { d: 80, i: 40, s: 40, c: 40 }, "D", "2026-02-02T00:00:00.000Z"),
      analyticsProfile("A", { d: 60, i: 50, s: 40, c: 40 }, "D", "2026-02-20T00:00:00.000Z"),
      analyticsProfile("A", { d: 10, i: 10, s: 10, c: 10 }, "D", "2019-01-01T00:00:00.000Z"),
    ],
    NOW,
    3,
  );
  const february = points.find((point) => point.key === "2026-02")!;
  assert.equal(february.count, 2);
  assert.equal(february.averages.d, 70);
  assert.equal(points.reduce((sum, point) => sum + point.count, 0), 2);
});

test("an unparseable completion timestamp is skipped, not crashed on", () => {
  const points = trendByMonth(
    [analyticsProfile("A", { d: 60, i: 40, s: 40, c: 40 }, "D", "not-a-date")],
    NOW,
    3,
  );
  assert.equal(points.reduce((sum, point) => sum + point.count, 0), 0);
});

test("a year window crosses the year boundary correctly", () => {
  const points = trendByMonth([], new Date("2026-01-10T00:00:00.000Z"), 12);
  assert.equal(points[0]!.key, "2025-02");
  assert.equal(points[11]!.key, "2026-01");
});

/* ── executive summary ──────────────────────────────────────────────── */

test("an empty scope explains itself instead of rendering nothing", () => {
  const lines = executiveSummary({ teams: [], profiles: [], groups: [] });
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /No completed profiles/);
});

test("summary names completion, centre of gravity, bench and cluster", () => {
  const profiles = [
    analyticsProfile("Sales", { d: 80, i: 65, s: 30, c: 25 }, "D"),
    analyticsProfile("Sales", { d: 75, i: 60, s: 35, c: 30 }, "D"),
    analyticsProfile("Finance", { d: 30, i: 30, s: 55, c: 78 }, "C", undefined, "C", "The Architect"),
  ];
  const teams = [analyticsTeam("a", "Atlas", 6, 3)];
  const lines = executiveSummary({
    teams,
    profiles,
    groups: aggregateByGroup(profiles),
  });
  assert.ok(lines.length >= 5);
  assert.match(lines[0]!, /3 completed profiles/);
  assert.match(lines[0]!, /50% completion of 6 invited/);
  assert.match(lines[1]!, /Dominant/);
  assert.match(lines[3]!, /largest behaviour cluster/i);
  assert.ok(lines.some((line) => line.includes("below 60% completion")));
});

test("a single group omits the group-comparison line", () => {
  const profiles = [analyticsProfile("Sales", { d: 80, i: 40, s: 30, c: 30 }, "D")];
  const lines = executiveSummary({
    teams: [analyticsTeam("a", "Atlas", 1, 1)],
    profiles,
    groups: aggregateByGroup(profiles),
  });
  assert.ok(!lines.some((line) => line.includes("most style-concentrated")));
});
