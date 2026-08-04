import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MEANINGFUL_MOVEMENT,
  SUBSTANTIAL_MOVEMENT,
  VARIATION_NOTE,
  compareRecords,
  compareTeamPeriods,
  contextLabel,
  currentResult,
  defaultView,
  movementSize,
  newestFirst,
  oldestFirst,
  periodsInSeries,
  priorResults,
  trendSeries,
  type HistoryRecord,
  type TeamPeriod,
} from "./timeline.ts";
import type { ArchetypeCode, Dimension, DiscScores } from "../types/index.ts";

function record(
  id: string,
  completedAt: string,
  scores: DiscScores,
  overrides: Partial<HistoryRecord> = {},
): HistoryRecord {
  return {
    id,
    kind: "disc",
    completedAt,
    scores,
    archetypeCode: "D" as ArchetypeCode,
    archetypeName: "The Commander",
    primary: "D" as Dimension,
    secondary: null,
    teamId: null,
    teamSeriesId: null,
    teamNameAtCompletion: null,
    departmentAtCompletion: null,
    roleAtCompletion: null,
    organizationNameAtCompletion: null,
    retakeReason: null,
    retakeNote: null,
    assessmentVersion: 2,
    scoringVersion: "1.0.0",
    attemptNumber: 1,
    ...overrides,
  };
}

const july = record("a", "2026-07-19T10:00:00.000Z", { d: 42, i: 38, s: 56, c: 64 }, {
  primary: "C",
  secondary: "S",
  archetypeCode: "CS" as ArchetypeCode,
  teamId: "team-erp",
  teamNameAtCompletion: "Applications & ERP Team",
  departmentAtCompletion: "ERP",
  roleAtCompletion: "Systems Analyst",
  retakeReason: "first_attempt",
});

const march = record("b", "2027-03-12T10:00:00.000Z", { d: 50, i: 41, s: 62, c: 58 }, {
  primary: "S",
  secondary: "C",
  archetypeCode: "SC" as ArchetypeCode,
  teamId: "team-lead",
  teamNameAtCompletion: "Enterprise Leadership Programme",
  departmentAtCompletion: "IDT",
  roleAtCompletion: "Team Lead",
  retakeReason: "leadership_programme",
  attemptNumber: 2,
});

/* ── movement thresholds (test 15) ──────────────────────────────────── */

test("movement below the threshold is not called a change", () => {
  for (const delta of [0, 1, -3, MEANINGFUL_MOVEMENT - 1, -(MEANINGFUL_MOVEMENT - 1)]) {
    assert.equal(movementSize(delta), "none", `delta ${delta}`);
  }
});

test("movement is graded, not binary", () => {
  assert.equal(movementSize(MEANINGFUL_MOVEMENT), "slight");
  assert.equal(movementSize(-MEANINGFUL_MOVEMENT), "slight");
  assert.equal(movementSize(MEANINGFUL_MOVEMENT * 2), "moderate");
  assert.equal(movementSize(SUBSTANTIAL_MOVEMENT), "substantial");
  assert.equal(movementSize(-45), "substantial");
});

test("the variation caveat is a single shared constant", () => {
  assert.match(VARIATION_NOTE, /context, role expectations or normal response variation/);
});

/* ── ordering and current resolution (tests 8, 12) ──────────────────── */

test("records order newest first and oldest first consistently", () => {
  const ordered = newestFirst([july, march]);
  assert.deepEqual(ordered.map((r) => r.id), ["b", "a"]);
  assert.deepEqual(oldestFirst([july, march]).map((r) => r.id), ["a", "b"]);
});

test("identical timestamps still produce a total order", () => {
  const x = record("x", "2026-01-01T00:00:00.000Z", { d: 50, i: 50, s: 50, c: 50 });
  const y = record("y", "2026-01-01T00:00:00.000Z", { d: 50, i: 50, s: 50, c: 50 });
  assert.deepEqual(newestFirst([y, x]).map((r) => r.id), ["x", "y"]);
  assert.deepEqual(newestFirst([x, y]).map((r) => r.id), ["x", "y"]);
});

test("current profile with no context is the participant's overall latest", () => {
  assert.equal(currentResult([july, march], { kind: "disc" })?.id, "b");
});

test("current profile for a team never borrows another team's result", () => {
  // The defect this guards: a member who assessed for the ERP team showing as
  // completed on the Leadership team's dashboard.
  assert.equal(currentResult([july, march], { kind: "disc", teamId: "team-erp" })?.id, "a");
  assert.equal(currentResult([july, march], { kind: "disc", teamId: "team-lead" })?.id, "b");
  assert.equal(currentResult([july, march], { kind: "disc", teamId: "team-new" }), null);
});

test("a brand-new team inherits nothing", () => {
  assert.equal(currentResult([july, march], { kind: "disc", teamId: "team-fresh" }), null);
  assert.deepEqual(priorResults([july, march], { kind: "disc", teamId: "team-fresh" }), []);
});

test("individual context selects only attempts with no team", () => {
  const solo = record("solo", "2026-05-01T00:00:00.000Z", { d: 60, i: 40, s: 40, c: 40 });
  assert.equal(currentResult([july, march, solo], { kind: "disc", teamId: null })?.id, "solo");
});

test("assessment kinds never cross", () => {
  const focus = record("f", "2027-06-01T00:00:00.000Z", { d: 0, i: 0, s: 0, c: 0 }, {
    kind: "focus",
  });
  assert.equal(currentResult([july, march, focus], { kind: "disc" })?.id, "b");
  assert.equal(currentResult([july, march, focus], { kind: "focus" })?.id, "f");
});

test("prior results exclude the current one and keep the rest", () => {
  const priors = priorResults([july, march], { kind: "disc" });
  assert.deepEqual(priors.map((r) => r.id), ["a"]);
  assert.deepEqual(priorResults([july], { kind: "disc" }), []);
  assert.deepEqual(priorResults([], { kind: "disc" }), []);
});

/* ── context snapshots (test 20) ────────────────────────────────────── */

test("context reads from the snapshot, not from today's fields", () => {
  assert.equal(contextLabel(july), "Applications & ERP Team · ERP · Systems Analyst");
  assert.equal(contextLabel(march), "Enterprise Leadership Programme · IDT · Team Lead");
});

test("an unrecorded snapshot degrades honestly instead of inventing context", () => {
  const bare = record("c", "2025-01-01T00:00:00.000Z", { d: 50, i: 50, s: 50, c: 50 });
  assert.equal(contextLabel(bare), "Individual assessment");
  const teamNoSnapshot = record("d", "2025-01-01T00:00:00.000Z", { d: 50, i: 50, s: 50, c: 50 }, {
    teamId: "team-x",
  });
  assert.equal(contextLabel(teamNoSnapshot), "Team assessment");
});

/* ── comparison ─────────────────────────────────────────────────────── */

test("comparison reports every dimension and flags only real movement", () => {
  const comparison = compareRecords(july, march);
  assert.equal(comparison.deltas.length, 4);
  assert.deepEqual(
    comparison.deltas.map((entry) => entry.delta),
    [8, 3, 6, -6],
  );
  // Only Dominant cleared the 8-point threshold.
  assert.deepEqual(comparison.notable.map((entry) => entry.dimension), ["D"]);
  assert.equal(comparison.primaryChanged, true);
  assert.equal(comparison.archetypeChanged, true);
});

test("comparison language is contextual, never a personality claim", () => {
  const summary = compareRecords(july, march).summary;
  assert.match(summary, /expressed behavioural pattern changed in this context/);
  assert.match(summary, /not a fixed trait/);
  assert.doesNotMatch(summary, /personality (permanently )?changed/i);
  assert.doesNotMatch(summary, /\b(because|caused|due to|proves)\b/i);
});

test("no notable movement is stated as consistency, not as change", () => {
  const later = record("c", "2026-09-19T10:00:00.000Z", { d: 44, i: 40, s: 55, c: 62 }, {
    primary: "C",
    secondary: "S",
    archetypeCode: "CS" as ArchetypeCode,
  });
  const comparison = compareRecords(july, later);
  assert.equal(comparison.notable.length, 0);
  assert.match(comparison.summary, /no dimension moved by 8 points or more/);
  assert.match(comparison.summary, /reads as consistent/);
});

test("elapsed time is reported in days or months as appropriate", () => {
  assert.match(compareRecords(july, march).summary, /months apart/);
  const soon = record("c", "2026-07-24T10:00:00.000Z", { d: 42, i: 38, s: 56, c: 64 });
  assert.match(compareRecords(july, soon).summary, /5 days apart/);
});

/* ── trend series (test 14) ─────────────────────────────────────────── */

test("trend series is chronological and only the requested kind", () => {
  const focus = record("f", "2026-08-01T00:00:00.000Z", { d: 0, i: 0, s: 0, c: 0 }, {
    kind: "focus",
  });
  const series = trendSeries([march, july, focus], "disc");
  assert.deepEqual(series.map((p) => p.id), ["a", "b"]);
  assert.equal(series[0]!.label, "Jul 2026");
  assert.equal(series[1]!.label, "Mar 2027");
  assert.equal(series[0]!.context, "Applications & ERP Team · ERP · Systems Analyst");
});

test("an unparseable date does not crash the series", () => {
  const broken = record("z", "not-a-date", { d: 50, i: 50, s: 50, c: 50 });
  assert.equal(trendSeries([broken], "disc")[0]!.label, "Unknown date");
});

test("the default view shows the latest three and counts the rest", () => {
  const many = Array.from({ length: 7 }, (_, index) =>
    record(`r${index}`, `2026-0${index + 1}-01T00:00:00.000Z`, { d: 50, i: 50, s: 50, c: 50 }),
  );
  const view = defaultView(many);
  assert.equal(view.visible.length, 3);
  assert.equal(view.hiddenCount, 4);
  assert.deepEqual(view.visible.map((r) => r.id), ["r6", "r5", "r4"]);
  assert.equal(defaultView([july]).hiddenCount, 0);
});

/* ── team lineage (test 13, 18) ─────────────────────────────────────── */

const period = (
  teamId: string,
  teamName: string,
  completedAt: string,
  averages: DiscScores,
  overrides: Partial<TeamPeriod> = {},
): TeamPeriod => ({
  teamId,
  teamName,
  teamSeriesId: null,
  completedAt,
  memberCount: 10,
  completedCount: 8,
  averages,
  composition: { D: 2, I: 2, S: 2, C: 2 },
  departments: ["ERP"],
  ...overrides,
});

test("lineage is explicit — a shared name never merges two teams", () => {
  const a = period("t1", "Applications & ERP Team", "2026-07-01T00:00:00.000Z", { d: 45, i: 40, s: 55, c: 60 });
  // Same name, different team, no series link: a name heuristic would merge
  // these and silently invent a trend across unrelated groups.
  const b = period("t2", "Applications & ERP Team", "2027-03-01T00:00:00.000Z", { d: 50, i: 42, s: 58, c: 55 });
  assert.deepEqual(periodsInSeries([a, b], null, "t1").map((p) => p.teamId), ["t1"]);
  assert.deepEqual(periodsInSeries([a, b], null, "t2").map((p) => p.teamId), ["t2"]);
});

test("an explicit series groups renamed teams, oldest first", () => {
  const a = period("t1", "ERP Team", "2026-07-01T00:00:00.000Z", { d: 45, i: 40, s: 55, c: 60 }, {
    teamSeriesId: "series-1",
  });
  const b = period("t2", "Applications & ERP", "2027-03-01T00:00:00.000Z", { d: 50, i: 42, s: 58, c: 55 }, {
    teamSeriesId: "series-1",
  });
  const c = period("t3", "Unrelated Team", "2027-01-01T00:00:00.000Z", { d: 50, i: 50, s: 50, c: 50 }, {
    teamSeriesId: "series-2",
  });
  assert.deepEqual(
    periodsInSeries([b, c, a], "series-1", "t2").map((p) => p.teamId),
    ["t1", "t2"],
  );
});

test("a standalone team's history is just its own period", () => {
  const a = period("t1", "Solo Team", "2026-07-01T00:00:00.000Z", { d: 45, i: 40, s: 55, c: 60 });
  assert.equal(periodsInSeries([a], null, "t1").length, 1);
  assert.equal(periodsInSeries([a], null, "other").length, 0);
});

test("team period comparison reports movement, completion and headcount", () => {
  const a = period("t1", "ERP Team", "2026-07-01T00:00:00.000Z", { d: 40, i: 40, s: 55, c: 60 }, {
    memberCount: 10,
    completedCount: 5,
  });
  const b = period("t2", "Applications & ERP", "2027-03-01T00:00:00.000Z", { d: 55, i: 42, s: 58, c: 52 }, {
    memberCount: 14,
    completedCount: 14,
  });
  const comparison = compareTeamPeriods(a, b);
  assert.deepEqual(comparison.notable.map((entry) => entry.dimension), ["D", "C"]);
  assert.equal(comparison.completionDelta, 50);
  assert.equal(comparison.headcountDelta, 4);
  assert.match(comparison.summary, /Dominant up 15/);
  assert.match(comparison.summary, /rose by 4/);
  assert.match(comparison.summary, /rose 50 points/);
  // Never asserts a cause.
  assert.match(comparison.summary, /may reflect who took part/);
  assert.doesNotMatch(comparison.summary, /\b(because|caused by|proves)\b/i);
});

test("an unchanged team period says so plainly", () => {
  const a = period("t1", "ERP", "2026-07-01T00:00:00.000Z", { d: 50, i: 50, s: 50, c: 50 });
  const b = period("t2", "ERP", "2027-03-01T00:00:00.000Z", { d: 52, i: 49, s: 51, c: 50 });
  const comparison = compareTeamPeriods(a, b);
  assert.equal(comparison.notable.length, 0);
  assert.match(comparison.summary, /no dimension average moved by 8 points or more/);
  assert.match(comparison.summary, /held steady/);
  assert.match(comparison.summary, /is unchanged/);
});
