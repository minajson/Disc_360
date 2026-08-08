import assert from "node:assert/strict";
import { test } from "node:test";
import {
  coverageReading,
  dimensionFromLabel,
  participationRate,
  reportFindings,
  teamFacingActions,
  tensionLabel,
  tensionPairs,
} from "./report.ts";
import { balanceIndex } from "./board.ts";
import { DIMENSIONS, type Dimension } from "../types/index.ts";
import type { DiscScores } from "../types/index.ts";

const AVERAGES: DiscScores = { d: 44, i: 36, s: 50, c: 72 };

test("dimension labels resolve, and non-dimension labels do not", () => {
  assert.equal(dimensionFromLabel("Dominant"), "D");
  assert.equal(dimensionFromLabel("Influence"), "I");
  assert.equal(dimensionFromLabel("Stable"), "S");
  // Analytical is the user-facing name for the internal C key.
  assert.equal(dimensionFromLabel("Analytical"), "C");
  assert.equal(dimensionFromLabel("  analytical  "), "C");
  // team.ts emits these when no high-tension pair exists.
  assert.equal(dimensionFromLabel("Aligned styles"), null);
  assert.equal(dimensionFromLabel("Missing counterweights"), null);
  assert.equal(dimensionFromLabel("Conscientiousness"), null);
});

test("coverage reads the centre, the support and the thinnest energy", () => {
  const reading = coverageReading(AVERAGES);
  assert.equal(reading.centreOfGravity, "C");
  assert.equal(reading.secondaryEnergy, "S");
  assert.equal(reading.thinnestCoverage, "I");
  assert.equal(reading.spread, 36);
});

test("the coverage spread is the same number the balance index is built on", () => {
  // Both must describe one team the same way — a report cannot say the spread
  // is 36 while the balance headline implies something else.
  for (const averages of [
    AVERAGES,
    { d: 50, i: 50, s: 50, c: 50 },
    { d: 90, i: 10, s: 40, c: 60 },
  ] as DiscScores[]) {
    assert.equal(coverageReading(averages).spread, 100 - balanceIndex(averages));
  }
});

test("participation is a whole percent and never NaN", () => {
  assert.equal(participationRate(42, 54), 78);
  assert.equal(participationRate(3, 5), 60);
  assert.equal(participationRate(5, 5), 100);
  // No invitations must not produce NaN in a headline figure.
  assert.equal(participationRate(0, 0), 0);
  assert.equal(participationRate(4, 0), 0);
});

test("every style pair has a tension label, in either argument order", () => {
  // The bug this pins: the lookup sorts the pair, so a table keyed "IC"
  // silently returns nothing for I↔C and half the labels vanish.
  const pairs: [Dimension, Dimension][] = [];
  for (const a of DIMENSIONS) {
    for (const b of DIMENSIONS) if (a !== b) pairs.push([a, b]);
  }
  for (const [a, b] of pairs) {
    const label = tensionLabel(a, b);
    assert.ok(label, `no label for ${a}↔${b}`);
    assert.equal(label, tensionLabel(b, a), `${a}↔${b} is not symmetric`);
  }
  assert.equal(tensionLabel("D", "S"), "Speed vs processing");
  assert.equal(tensionLabel("I", "C"), "Enthusiasm vs evidence");
  assert.equal(tensionLabel("C", "I"), "Enthusiasm vs evidence");
  assert.equal(tensionLabel("D", "D"), null);
});

test("tension pairs come from the team's own gaps, never a fixed pair", () => {
  const pairs = tensionPairs([
    { between: ["Dominant", "Stable"] },
    { between: ["Influence", "Analytical"] },
  ]);
  assert.deepEqual(
    pairs.map((pair) => pair.label),
    ["Speed vs processing", "Enthusiasm vs evidence"],
  );

  // A team with no high-tension pair gets the non-dimension gap, and must
  // not be given a diagram of relationships it does not have.
  assert.deepEqual(tensionPairs([{ between: ["Aligned styles", "Missing counterweights"] }]), []);
  assert.deepEqual(tensionPairs([]), []);
});

test("only team-facing actions reach the report", () => {
  const actions = [
    { audience: "team" as const, action: "Time-box analysis." },
    { audience: "coach" as const, action: "Run a listening round." },
    { audience: "team" as const, action: "Name a decision owner." },
  ];
  const kept = teamFacingActions(actions);
  assert.equal(kept.length, 2);
  assert.ok(
    kept.every((entry) => entry.audience === "team"),
    "a facilitator action reached the team report",
  );
  assert.ok(!kept.some((entry) => entry.action.includes("listening round")));
});

test("findings carry both the narrative and the risks behind the actions", () => {
  const findings = reportFindings(
    [{ title: "Center of gravity: Analytical", detail: "…" }],
    [{ title: "Low Influence coverage", detail: "…" }],
  );
  assert.deepEqual(
    findings.map((finding) => finding.title),
    ["Center of gravity: Analytical", "Low Influence coverage"],
  );
  assert.deepEqual(reportFindings([], []), []);
});
