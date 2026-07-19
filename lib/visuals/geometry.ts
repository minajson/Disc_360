/**
 * Shared geometry for the DISC360 visual systems — pure math, no I/O, no
 * randomness, unit-tested. Every visualisation builds from these primitives so
 * curved arcs, orbital positions and blended directions behave identically
 * across the Behaviour Compass, Focus Lens and Fusion map.
 *
 * Angle convention: 0° points straight up (12 o'clock), positive is clockwise.
 * This matches how people read a compass, which is the metaphor in play.
 */

export interface Point {
  x: number;
  y: number;
}

const toRad = (angleDeg: number) => (angleDeg * Math.PI) / 180;

/** Point at `radius` from (cx, cy) in the 0°=up, clockwise system. */
export function polarPoint(cx: number, cy: number, radius: number, angleDeg: number): Point {
  return {
    x: cx + radius * Math.sin(toRad(angleDeg)),
    y: cy - radius * Math.cos(toRad(angleDeg)),
  };
}

/**
 * SVG path for a clockwise circular arc from `startDeg` to `endDeg` at
 * `radius`. Rendered with a stroke, this is the curved band primitive used
 * for compass segments, gauge arcs and orbital tracks.
 */
export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = polarPoint(cx, cy, radius, startDeg);
  const end = polarPoint(cx, cy, radius, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

export interface WeightedDirection {
  angleDeg: number;
  weight: number;
}

export interface BlendResult {
  /** Direction of the weighted blend, in the same 0°=up clockwise system. */
  angleDeg: number;
  /** 0–100: how directional the blend is (0 = perfectly balanced). */
  magnitude: number;
}

/**
 * Vector sum of weighted directions — the compass-needle math. Four equal
 * weights at the quadrant centres cancel to magnitude 0 (a balanced profile);
 * a single dominant weight points squarely at its own quadrant.
 */
export function blendDirection(items: WeightedDirection[]): BlendResult {
  let sumX = 0;
  let sumY = 0;
  let total = 0;
  for (const item of items) {
    sumX += item.weight * Math.sin(toRad(item.angleDeg));
    sumY += item.weight * Math.cos(toRad(item.angleDeg));
    total += item.weight;
  }
  const magnitudeRaw = Math.hypot(sumX, sumY);
  const angle = (Math.atan2(sumX, sumY) * 180) / Math.PI;
  return {
    angleDeg: angle,
    magnitude: total > 0 ? (magnitudeRaw / total) * 100 : 0,
  };
}

/**
 * A gently curved connector between two points — a quadratic Bézier whose
 * control point is offset perpendicular to the midpoint. The house replacement
 * for straight connector lines. `curvature` is the offset as a fraction of the
 * segment length; `side` flips which way the curve bows.
 */
export function curvedConnector(
  from: Point,
  to: Point,
  curvature = 0.22,
  side: 1 | -1 = 1,
): string {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const controlX = midX + (-dy / length) * length * curvature * side;
  const controlY = midY + (dx / length) * length * curvature * side;
  return `M ${from.x.toFixed(3)} ${from.y.toFixed(3)} Q ${controlX.toFixed(3)} ${controlY.toFixed(3)} ${to.x.toFixed(3)} ${to.y.toFixed(3)}`;
}

/** Clamp to 0–100 — scores arrive pre-normalized but never trust the edge. */
export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * A smooth curve through every point — Catmull-Rom converted to cubic
 * Béziers. This is how rhythms, pulses, pathways and flowing timelines are
 * drawn: one continuous organic path instead of point-to-point segments.
 * `tension` 0 = straight-ish, 1 = very loose; the house default sits between.
 */
export function smoothPath(points: Point[], tension = 0.55): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;

  const path: string[] = [`M ${points[0]!.x.toFixed(2)} ${points[0]!.y.toFixed(2)}`];
  const k = tension / 3;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) * k;
    const c1y = p1.y + (p2.y - p0.y) * k;
    const c2x = p2.x - (p3.x - p1.x) * k;
    const c2y = p2.y - (p3.y - p1.y) * k;

    path.push(
      `C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    );
  }
  return path.join(" ");
}

/**
 * Word-wrap a short label into at most two lines of ~`max` characters — the
 * shared treatment for SVG labels, which cannot soft-wrap on their own.
 */
export function wrapLabel(label: string, max = 13): string[] {
  const words = label.split(" ");
  if (label.length <= max || words.length === 1) return [label];
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    if ((line + " " + word).trim().length > max && line) {
      lines.push(line.trim());
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}
