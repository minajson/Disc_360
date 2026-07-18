import assert from "node:assert/strict";
import { test } from "node:test";
import {
  arcPath,
  blendDirection,
  clampScore,
  curvedConnector,
  polarPoint,
} from "./geometry.ts";
import { deriveDistractionFactors } from "./focus-factors.ts";

const near = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

/* ── polar system: 0° = up, clockwise ───────────────────────────── */

test("polarPoint hits the four cardinal points", () => {
  const top = polarPoint(100, 100, 50, 0);
  near(top.x, 100);
  near(top.y, 50);
  const right = polarPoint(100, 100, 50, 90);
  near(right.x, 150);
  near(right.y, 100);
  const bottom = polarPoint(100, 100, 50, 180);
  near(bottom.x, 100);
  near(bottom.y, 150);
  const left = polarPoint(100, 100, 50, 270);
  near(left.x, 50);
  near(left.y, 100);
});

test("arcPath runs clockwise from start to end with the correct flags", () => {
  const path = arcPath(100, 100, 50, 0, 90);
  assert.match(path, /^M 100(\.0+)? 50(\.0+)? A 50 50 0 0 1 150(\.0+)? 100(\.0+)?$/);
  // Beyond 180° the large-arc flag flips.
  assert.match(arcPath(100, 100, 50, 0, 270), / A 50 50 0 1 1 /);
});

/* ── blend direction (the compass needle) ───────────────────────── */

test("a single weight points at its own quadrant with full magnitude", () => {
  const blend = blendDirection([{ angleDeg: -45, weight: 100 }]);
  near(blend.angleDeg, -45, 1e-6);
  near(blend.magnitude, 100, 1e-6);
});

test("four equal weights at the quadrant centres cancel to balance", () => {
  const blend = blendDirection(
    [-45, 45, 135, -135].map((angleDeg) => ({ angleDeg, weight: 70 })),
  );
  near(blend.magnitude, 0, 1e-6);
});

test("two equal adjacent weights bisect", () => {
  const blend = blendDirection([
    { angleDeg: -45, weight: 80 },
    { angleDeg: 45, weight: 80 },
  ]);
  near(blend.angleDeg, 0, 1e-6);
  assert.ok(blend.magnitude > 50 && blend.magnitude < 100);
});

test("blend of nothing is safely zero", () => {
  near(blendDirection([]).magnitude, 0);
});

/* ── curved connector ───────────────────────────────────────────── */

test("curvedConnector is a quadratic curve, not a straight line", () => {
  const path = curvedConnector({ x: 0, y: 0 }, { x: 100, y: 0 });
  assert.match(path, /^M 0(\.0+)? 0(\.0+)? Q /);
  // Control point bows off the straight midline (y ≠ 0).
  const control = path.split("Q ")[1]!.trim().split(" ");
  assert.ok(Math.abs(parseFloat(control[1]!)) > 1, "control point is off-axis");
});

test("curvedConnector side flips the bow", () => {
  const up = curvedConnector({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.2, 1);
  const down = curvedConnector({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.2, -1);
  const controlY = (p: string) => parseFloat(p.split("Q ")[1]!.trim().split(" ")[1]!);
  assert.ok(controlY(up) * controlY(down) < 0, "opposite sides");
});

test("clampScore bounds to 0–100", () => {
  assert.equal(clampScore(-5), 0);
  assert.equal(clampScore(105), 100);
  assert.equal(clampScore(55), 55);
});

/* ── distraction factors ────────────────────────────────────────── */

const SCORES = { automaticity: 70, distraction: 85, mentalLoad: 40, recovery: 60 };

test("factors are sorted strongest-first and capped at four", () => {
  const factors = deriveDistractionFactors({
    scores: SCORES,
    primaryLoop: "social",
    notificationPattern: "immediate",
  });
  assert.equal(factors.length, 4);
  for (let i = 1; i < factors.length; i++) {
    assert.ok(factors[i - 1]!.strength >= factors[i]!.strength, "descending");
  }
});

test("factor labels come from the shared display maps", () => {
  const factors = deriveDistractionFactors({
    scores: SCORES,
    primaryLoop: "messages",
    notificationPattern: "batches",
  });
  const labels = factors.map((f) => f.label);
  assert.ok(labels.includes("Messages & email"));
  assert.ok(labels.includes("Batches at breaks"));
  assert.ok(labels.includes("Mental load"));
  assert.ok(labels.includes("Autopilot checking"));
});

test("notification strength mirrors the scorer's weighting order", () => {
  const strengthFor = (pattern: "immediate" | "finishes" | "batches" | "off") =>
    deriveDistractionFactors({
      scores: { ...SCORES, distraction: 0, mentalLoad: 0, automaticity: 0 },
      primaryLoop: "stays",
      notificationPattern: pattern,
    }).find((f) => f.label !== "Stays on task" && f.label !== "Mental load" && f.label !== "Autopilot checking")!.strength;
  assert.ok(strengthFor("immediate") > strengthFor("finishes"));
  assert.ok(strengthFor("finishes") > strengthFor("batches"));
  assert.ok(strengthFor("batches") > strengthFor("off"));
});
