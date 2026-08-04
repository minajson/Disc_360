import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_CARDS_PER_VIEW,
  buildBatches,
  buildCohorts,
  chunk,
  comparisonLayout,
  comparisonReadout,
  dimensionDivergence,
  filterMembers,
  groupAverage,
  groupSpread,
  highBandCounts,
  pairDistance,
  pairDistances,
  slideWindow,
  styleCounts,
  toggleSelection,
  type ComparisonMember,
} from "./comparison.ts";
import type { Dimension, DiscScores } from "../types/index.ts";

function member(
  id: string,
  label: string,
  scores: DiscScores,
  primary: Dimension,
  department: string | null = null,
): ComparisonMember {
  return {
    id,
    label,
    department,
    roleTitle: null,
    scores,
    archetypeName: "The Commander",
    primary,
  };
}

const roster = (count: number): ComparisonMember[] =>
  Array.from({ length: count }, (_, index) =>
    member(
      `m${index}`,
      `Member ${index + 1}`,
      { d: 50, i: 50, s: 50, c: 50 },
      "D",
    ),
  );

/* ── layout ─────────────────────────────────────────────────────────── */

test("two members keep the one-to-one duo layout", () => {
  assert.deepEqual(comparisonLayout(2), { mode: "duo", columns: 2, scrolls: false });
  assert.deepEqual(comparisonLayout(1), { mode: "duo", columns: 2, scrolls: false });
});

test("three to eight members are all shown simultaneously in a grid", () => {
  for (let count = 3; count <= 8; count++) {
    const layout = comparisonLayout(count);
    assert.equal(layout.mode, "grid", `count ${count}`);
    assert.equal(layout.scrolls, false, `count ${count}`);
  }
  assert.equal(comparisonLayout(3).columns, 3);
  assert.equal(comparisonLayout(4).columns, 4);
  assert.equal(comparisonLayout(8).columns, 4);
});

test("nine and ten members scroll on a rail instead of shrinking", () => {
  for (const count of [9, 10]) {
    const layout = comparisonLayout(count);
    assert.equal(layout.mode, "rail");
    assert.equal(layout.scrolls, true);
  }
});

/* ── batching ───────────────────────────────────────────────────────── */

test("chunk splits evenly and keeps the remainder", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 3), []);
  assert.deepEqual(chunk([1, 2], 0), [[1, 2]]);
});

test("a roster that fits one screen produces a single unlabelled set", () => {
  const sets = buildBatches(roster(8));
  assert.equal(sets.length, 1);
  assert.equal(sets[0]!.label, "All members");
  assert.equal(sets[0]!.members.length, 8);
});

test("twenty members become two batches of ten with position ranges", () => {
  const sets = buildBatches(roster(20));
  assert.equal(sets.length, 2);
  assert.equal(sets[0]!.label, "Batch 1");
  assert.equal(sets[0]!.detail, "10 members · positions 1–10");
  assert.equal(sets[1]!.detail, "10 members · positions 11–20");
  assert.equal(sets[1]!.members[0]!.label, "Member 11");
});

test("a hundred members batch into ten full screens, none oversized", () => {
  const sets = buildBatches(roster(100));
  assert.equal(sets.length, 10);
  assert.ok(sets.every((set) => set.members.length <= MAX_CARDS_PER_VIEW));
  assert.equal(sets.flatMap((set) => set.members).length, 100);
});

test("a hundred and four members keep the tail batch", () => {
  const sets = buildBatches(roster(104));
  assert.equal(sets.length, 11);
  assert.equal(sets[10]!.members.length, 4);
  assert.equal(sets[10]!.detail, "4 members · positions 101–104");
});

test("empty rosters produce no sets", () => {
  assert.deepEqual(buildBatches([]), []);
  assert.deepEqual(buildCohorts([]), []);
});

/* ── cohorts ────────────────────────────────────────────────────────── */

test("cohorts group by department, largest first, unassigned last", () => {
  const members = [
    member("a", "A", { d: 60, i: 40, s: 40, c: 40 }, "D", "Operations"),
    member("b", "B", { d: 40, i: 60, s: 40, c: 40 }, "I", "Leadership"),
    member("c", "C", { d: 40, i: 40, s: 60, c: 40 }, "S", "Operations"),
    member("d", "D", { d: 40, i: 40, s: 40, c: 60 }, "C", null),
  ];
  const sets = buildCohorts(members);
  assert.deepEqual(
    sets.map((set) => set.label),
    ["Operations", "Leadership", "Unassigned"],
  );
  assert.equal(sets[0]!.members.length, 2);
  assert.equal(sets[2]!.members.length, 1);
});

test("a department larger than one screen splits into parts", () => {
  const members = roster(23).map((entry) => ({ ...entry, department: "Sales" }));
  const sets = buildCohorts(members);
  assert.equal(sets.length, 3);
  assert.ok(sets.every((set) => set.label === "Sales"));
  assert.equal(sets[0]!.detail, "10 members · part 1");
  assert.equal(sets[2]!.detail, "3 members · part 3");
});

/* ── tray behaviour ─────────────────────────────────────────────────── */

test("search matches name, department and archetype", () => {
  const members = [
    member("a", "Mina Allison", { d: 60, i: 40, s: 40, c: 40 }, "D", "Sales"),
    member("b", "Prince", { d: 40, i: 60, s: 40, c: 40 }, "I", "Operations"),
  ];
  assert.equal(filterMembers(members, "mina").length, 1);
  assert.equal(filterMembers(members, "operations")[0]!.label, "Prince");
  assert.equal(filterMembers(members, "commander").length, 2);
  assert.equal(filterMembers(members, "   ").length, 2);
  assert.equal(filterMembers(members, "zzz").length, 0);
});

test("selection toggles on and off and refuses to exceed the ceiling", () => {
  assert.deepEqual(toggleSelection([], "a"), ["a"]);
  assert.deepEqual(toggleSelection(["a", "b"], "a"), ["b"]);
  const full = Array.from({ length: MAX_CARDS_PER_VIEW }, (_, i) => `m${i}`);
  assert.deepEqual(toggleSelection(full, "extra"), full);
  // De-selecting still works at the ceiling.
  assert.equal(toggleSelection(full, "m0").length, MAX_CARDS_PER_VIEW - 1);
});

/* ── statistics ─────────────────────────────────────────────────────── */

test("group average rounds per dimension and empty sets are zeroed", () => {
  const members = [
    member("a", "A", { d: 70, i: 30, s: 50, c: 41 }, "D"),
    member("b", "B", { d: 60, i: 40, s: 50, c: 40 }, "D"),
  ];
  assert.deepEqual(groupAverage(members), { d: 65, i: 35, s: 50, c: 41 });
  assert.deepEqual(groupAverage([]), { d: 0, i: 0, s: 0, c: 0 });
});

test("group spread is the distance between the highest and lowest average", () => {
  assert.equal(groupSpread({ d: 70, i: 30, s: 50, c: 40 }), 40);
  assert.equal(groupSpread({ d: 50, i: 50, s: 50, c: 50 }), 0);
});

test("divergence is ranked widest first and names both extremes", () => {
  const members = [
    member("a", "Ada", { d: 80, i: 50, s: 50, c: 50 }, "D"),
    member("b", "Ben", { d: 20, i: 55, s: 50, c: 50 }, "I"),
  ];
  const divergences = dimensionDivergence(members);
  assert.equal(divergences[0]!.dimension, "D");
  assert.equal(divergences[0]!.range, 60);
  assert.equal(divergences[0]!.lowestLabel, "Ben");
  assert.equal(divergences[0]!.highestLabel, "Ada");
  assert.equal(divergences[3]!.range, 0);
  assert.deepEqual(dimensionDivergence([]), []);
});

test("pair distance is the mean absolute per-dimension gap", () => {
  const a = member("a", "A", { d: 80, i: 20, s: 50, c: 50 }, "D");
  const b = member("b", "B", { d: 40, i: 60, s: 50, c: 50 }, "I");
  assert.equal(pairDistance(a, b), 20);
  assert.equal(pairDistance(a, a), 0);
});

test("pair distances cover every pair, most divergent first", () => {
  const members = [
    member("a", "A", { d: 90, i: 10, s: 10, c: 10 }, "D"),
    member("b", "B", { d: 10, i: 90, s: 10, c: 10 }, "I"),
    member("c", "C", { d: 85, i: 15, s: 10, c: 10 }, "D"),
  ];
  const distances = pairDistances(members);
  assert.equal(distances.length, 3);
  assert.ok(distances[0]!.distance >= distances[1]!.distance);
  assert.ok(distances[1]!.distance >= distances[2]!.distance);
  assert.deepEqual(
    [distances[2]!.aLabel, distances[2]!.bLabel].sort(),
    ["A", "C"],
  );
});

test("style and high-band counts tally independently", () => {
  const members = [
    member("a", "A", { d: 75, i: 65, s: 20, c: 20 }, "D"),
    member("b", "B", { d: 30, i: 61, s: 30, c: 30 }, "I"),
  ];
  assert.deepEqual(styleCounts(members), { D: 1, I: 1, S: 0, C: 0 });
  assert.deepEqual(highBandCounts(members), { D: 1, I: 2, S: 0, C: 0 });
});

/* ── readout ────────────────────────────────────────────────────────── */

test("readout degrades gracefully for empty and single-member sets", () => {
  assert.equal(comparisonReadout([], "Batch 1").points.length, 0);
  const single = comparisonReadout(
    [member("a", "Ada", { d: 70, i: 30, s: 40, c: 40 }, "D")],
    "Leadership",
  );
  assert.match(single.headline, /Ada/);
  assert.equal(single.points.length, 2);
});

test("readout names the widest divergence and the furthest pair", () => {
  const members = [
    member("a", "Ada", { d: 85, i: 40, s: 30, c: 45 }, "D"),
    member("b", "Ben", { d: 25, i: 45, s: 70, c: 50 }, "S"),
    member("c", "Cass", { d: 55, i: 42, s: 50, c: 48 }, "D"),
  ];
  const readout = comparisonReadout(members, "Batch 1");
  assert.match(readout.headline, /Batch 1/);
  assert.ok(readout.points.length >= 5);
  assert.ok(readout.points.some((point) => point.includes("Dominant")));
  assert.ok(readout.points.some((point) => point.includes("Ada") && point.includes("Ben")));
  // Influence and Analytical lead nobody here.
  assert.ok(
    readout.points.some(
      (point) => point.includes("No one in this set leads") && point.includes("Influence"),
    ),
  );
});

test("an evenly balanced set is headlined as balanced", () => {
  const members = [
    member("a", "A", { d: 55, i: 50, s: 48, c: 47 }, "D"),
    member("b", "B", { d: 47, i: 52, s: 50, c: 51 }, "I"),
    member("c", "C", { d: 48, i: 49, s: 55, c: 50 }, "S"),
    member("d", "D", { d: 50, i: 48, s: 47, c: 55 }, "C"),
  ];
  const readout = comparisonReadout(members, "All members");
  assert.match(readout.headline, /evenly balanced/);
});

/* ── presentation pagination ────────────────────────────────────────── */

test("a projected set shows three cards per slide, never shrunken ten", () => {
  const window = slideWindow(10, 0);
  assert.equal(window.slideCount, 4);
  assert.equal(window.from, 1);
  assert.equal(window.to, 3);
  assert.equal(window.label, "Members 1–3 of 10");
});

test("the final slide holds the remainder without overflowing", () => {
  const last = slideWindow(10, 3);
  assert.equal(last.from, 10);
  assert.equal(last.to, 10);
  assert.equal(last.label, "Member 10 of 10");
});

test("slide indexes wrap in both directions", () => {
  assert.equal(slideWindow(10, 4).index, 0);
  assert.equal(slideWindow(10, -1).index, 3);
  assert.equal(slideWindow(10, 7).index, 3);
});

test("small and empty sets stay well formed", () => {
  assert.equal(slideWindow(2, 0).label, "Members 1–2 of 2");
  assert.equal(slideWindow(2, 0).slideCount, 1);
  assert.equal(slideWindow(1, 0).label, "Member 1 of 1");
  assert.equal(slideWindow(0, 0).label, "No members");
  assert.equal(slideWindow(0, 0).slideCount, 1);
});

test("every member appears on exactly one slide", () => {
  for (const total of [1, 3, 5, 8, 10, 23, 100]) {
    const seen = new Set<number>();
    const { slideCount } = slideWindow(total, 0);
    for (let index = 0; index < slideCount; index++) {
      const w = slideWindow(total, index);
      for (let n = w.from; n <= w.to; n++) {
        assert.ok(!seen.has(n), `member ${n} duplicated at total ${total}`);
        seen.add(n);
      }
    }
    assert.equal(seen.size, total, `total ${total}`);
  }
});
