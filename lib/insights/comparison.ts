import {
  DIMENSION_KEY,
  DIMENSIONS,
  type Dimension,
  type DiscScores,
} from "../types/index.ts";
import { dimensionMeta } from "../../data/dimension-meta.ts";

/**
 * Comparison-set mathematics — pure, deterministic, unit-tested.
 *
 * The two-member comparison (components/teams/presentation-tabs.tsx,
 * "Compare two members") is untouched and stays the reference experience for
 * one-to-one coaching. This module is what lets the SAME card template serve
 * a department of ninety: it decides how many people belong on one screen,
 * how a large roster is cut into readable sets, and what a facilitator should
 * say about whichever set is on the projector.
 *
 * No I/O, no dates, no randomness — every function is a projection of the
 * roster it is handed, so the presentation layer never computes anything.
 */

/**
 * Cards a facilitator can read at once on a conference-room screen.
 *
 * Ten is a legibility limit, not a data limit. Past ten the cards would have
 * to shrink below the point where a radar and an archetype name are readable
 * from the back of a room — so instead of shrinking the design, the roster is
 * cut into sets of ten and the facilitator changes sets.
 */
export const MAX_CARDS_PER_VIEW = 10;

/** Score at or above which a dimension counts as a pronounced strength. */
export const HIGH_BAND = 60;

export interface ComparisonMember {
  /** Stable identity within one roster render — never a database id. */
  id: string;
  label: string;
  department: string | null;
  roleTitle: string | null;
  scores: DiscScores;
  archetypeName: string;
  primary: Dimension;
}

export interface ComparisonSet {
  id: string;
  label: string;
  /** Human sublabel, e.g. "10 members · positions 11–20". */
  detail: string;
  members: ComparisonMember[];
}

/* ── layout ─────────────────────────────────────────────────────────── */

export type ComparisonMode = "duo" | "grid" | "rail";

export interface ComparisonLayout {
  mode: ComparisonMode;
  /** Widest column count the grid should reach on a large screen. */
  columns: number;
  /** True when the set must scroll horizontally instead of wrapping. */
  scrolls: boolean;
}

/**
 * How many comparison cards sit side by side.
 *
 * · 2 — the one-to-one layout: two wide columns, exactly as the existing
 *   two-member comparison renders.
 * · 3–8 — every member visible simultaneously, wrapping into a grid that
 *   never goes below four columns' worth of card width.
 * · 9–10 — a horizontal rail. Cards keep their full size and the facilitator
 *   scrolls, because shrinking ten cards into a viewport makes all ten
 *   unreadable at projector distance.
 */
export function comparisonLayout(count: number): ComparisonLayout {
  if (count <= 2) return { mode: "duo", columns: 2, scrolls: false };
  if (count <= 4) return { mode: "grid", columns: count, scrolls: false };
  if (count <= 8) return { mode: "grid", columns: 4, scrolls: false };
  return { mode: "rail", columns: 5, scrolls: true };
}

/* ── set building ───────────────────────────────────────────────────── */

export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) return items.length ? [items] : [];
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Cuts a roster into batches of at most `size`. A roster that already fits
 * returns a single set, so 2–10 members never see batch chrome at all.
 */
export function buildBatches(
  members: ComparisonMember[],
  size: number = MAX_CARDS_PER_VIEW,
  labelPrefix = "Batch",
): ComparisonSet[] {
  if (members.length === 0) return [];
  const groups = chunk(members, size);
  if (groups.length === 1) {
    return [
      {
        id: "batch-1",
        label: "All members",
        detail: plural(members.length, "member"),
        members: groups[0]!,
      },
    ];
  }
  return groups.map((group, index) => {
    const from = index * size + 1;
    const to = from + group.length - 1;
    return {
      id: `batch-${index + 1}`,
      label: `${labelPrefix} ${index + 1}`,
      detail: `${plural(group.length, "member")} · positions ${from}–${to}`,
      members: group,
    };
  });
}

/**
 * Department cohorts, largest first, each batched if it exceeds one screen.
 * Members with no department land in a trailing "Unassigned" cohort rather
 * than disappearing.
 */
export function buildCohorts(
  members: ComparisonMember[],
  size: number = MAX_CARDS_PER_VIEW,
): ComparisonSet[] {
  const byDepartment = new Map<string, ComparisonMember[]>();
  for (const member of members) {
    const key = member.department ?? "";
    const bucket = byDepartment.get(key);
    if (bucket) bucket.push(member);
    else byDepartment.set(key, [member]);
  }

  const named = [...byDepartment.entries()]
    .filter(([key]) => key !== "")
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const unassigned = byDepartment.get("") ?? [];

  const sets: ComparisonSet[] = [];
  for (const [department, group] of named) {
    for (const [index, page] of chunk(group, size).entries()) {
      const suffix = group.length > size ? ` · part ${index + 1}` : "";
      sets.push({
        id: `dept:${department}:${index + 1}`,
        label: department,
        detail: `${plural(page.length, "member")}${suffix}`,
        members: page,
      });
    }
  }
  for (const [index, page] of chunk(unassigned, size).entries()) {
    sets.push({
      id: `dept:unassigned:${index + 1}`,
      label: "Unassigned",
      detail: plural(page.length, "member"),
      members: page,
    });
  }
  return sets;
}

/** Free-text roster filter across name, department and archetype. */
export function filterMembers(
  members: ComparisonMember[],
  query: string,
): ComparisonMember[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return members;
  return members.filter((member) =>
    [member.label, member.department ?? "", member.archetypeName]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}

/**
 * Selection toggle with a hard ceiling. Selecting past the ceiling is a
 * no-op rather than a silent eviction — the tray shows "10 / 10 selected"
 * and the facilitator decides what to drop.
 */
export function toggleSelection(
  selected: readonly string[],
  id: string,
  max: number = MAX_CARDS_PER_VIEW,
): string[] {
  if (selected.includes(id)) return selected.filter((value) => value !== id);
  if (selected.length >= max) return [...selected];
  return [...selected, id];
}

/* ── set statistics ─────────────────────────────────────────────────── */

export function groupAverage(members: ComparisonMember[]): DiscScores {
  if (members.length === 0) return { d: 0, i: 0, s: 0, c: 0 };
  const totals: DiscScores = { d: 0, i: 0, s: 0, c: 0 };
  for (const member of members) {
    for (const dim of DIMENSIONS) {
      totals[DIMENSION_KEY[dim]] += member.scores[DIMENSION_KEY[dim]];
    }
  }
  return {
    d: Math.round(totals.d / members.length),
    i: Math.round(totals.i / members.length),
    s: Math.round(totals.s / members.length),
    c: Math.round(totals.c / members.length),
  };
}

export function groupSpread(scores: DiscScores): number {
  const values = DIMENSIONS.map((dim) => scores[DIMENSION_KEY[dim]]);
  return Math.max(...values) - Math.min(...values);
}

export interface DimensionDivergence {
  dimension: Dimension;
  low: number;
  high: number;
  range: number;
  /** Members holding the extremes, for direct labelling. */
  lowestLabel: string;
  highestLabel: string;
}

/**
 * Per-dimension range across the set — the number a facilitator actually
 * points at. A 45-point Dominant range in one room is the conversation.
 */
export function dimensionDivergence(
  members: ComparisonMember[],
): DimensionDivergence[] {
  if (members.length === 0) return [];
  return DIMENSIONS.map((dimension) => {
    const key = DIMENSION_KEY[dimension];
    let lowest = members[0]!;
    let highest = members[0]!;
    for (const member of members) {
      if (member.scores[key] < lowest.scores[key]) lowest = member;
      if (member.scores[key] > highest.scores[key]) highest = member;
    }
    return {
      dimension,
      low: lowest.scores[key],
      high: highest.scores[key],
      range: highest.scores[key] - lowest.scores[key],
      lowestLabel: lowest.label,
      highestLabel: highest.label,
    };
  }).sort((a, b) => b.range - a.range);
}

export interface MemberDistance {
  aId: string;
  bId: string;
  aLabel: string;
  bLabel: string;
  /** Mean absolute per-dimension difference, 0–100. */
  distance: number;
}

/** Mean absolute difference across the four dimensions. */
export function pairDistance(
  a: ComparisonMember,
  b: ComparisonMember,
): number {
  const total = DIMENSIONS.reduce(
    (sum, dim) =>
      sum + Math.abs(a.scores[DIMENSION_KEY[dim]] - b.scores[DIMENSION_KEY[dim]]),
    0,
  );
  return Math.round(total / DIMENSIONS.length);
}

/** All pairs in the set, most divergent first. */
export function pairDistances(members: ComparisonMember[]): MemberDistance[] {
  const out: MemberDistance[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i]!;
      const b = members[j]!;
      out.push({
        aId: a.id,
        bId: b.id,
        aLabel: a.label,
        bLabel: b.label,
        distance: pairDistance(a, b),
      });
    }
  }
  return out.sort((x, y) => y.distance - x.distance);
}

export function styleCounts(
  members: ComparisonMember[],
): Record<Dimension, number> {
  const counts: Record<Dimension, number> = { D: 0, I: 0, S: 0, C: 0 };
  for (const member of members) counts[member.primary] += 1;
  return counts;
}

/** Members scoring at or above the high band on each dimension. */
export function highBandCounts(
  members: ComparisonMember[],
): Record<Dimension, number> {
  const counts: Record<Dimension, number> = { D: 0, I: 0, S: 0, C: 0 };
  for (const member of members) {
    for (const dim of DIMENSIONS) {
      if (member.scores[DIMENSION_KEY[dim]] >= HIGH_BAND) counts[dim] += 1;
    }
  }
  return counts;
}

/* ── generated read-out ─────────────────────────────────────────────── */

export interface ComparisonReadout {
  /** One-line headline for the set currently on screen. */
  headline: string;
  /** Three to five facilitator talking points. */
  points: string[];
}

/**
 * What to say about the set on screen. Rule-generated from the same numbers
 * the cards display, so the narration can never contradict the visuals.
 */
export function comparisonReadout(
  members: ComparisonMember[],
  setLabel: string,
): ComparisonReadout {
  if (members.length === 0) {
    return {
      headline: "No completed profiles in this set yet.",
      points: [],
    };
  }
  if (members.length === 1) {
    const only = members[0]!;
    return {
      headline: `${only.label} is the only completed profile in ${setLabel}.`,
      points: [
        `Reads as ${only.archetypeName}, led by ${dimensionMeta[only.primary].label}.`,
        "Add a second profile to this set to compare behaviour side by side.",
      ],
    };
  }

  const averages = groupAverage(members);
  const spread = groupSpread(averages);
  const divergences = dimensionDivergence(members);
  const widest = divergences[0]!;
  const tightest = divergences[divergences.length - 1]!;
  const counts = styleCounts(members);
  const represented = DIMENSIONS.filter((dim) => counts[dim] > 0);
  const missing = DIMENSIONS.filter((dim) => counts[dim] === 0);
  const distances = pairDistances(members);
  const furthest = distances[0]!;
  const closest = distances[distances.length - 1]!;
  const dominantStyle = [...DIMENSIONS].sort((a, b) => counts[b] - counts[a])[0]!;

  const headline =
    spread <= 12
      ? `${setLabel}: an evenly balanced set — no single style sets the tone.`
      : `${setLabel}: ${dimensionMeta[dominantStyle].label} sets the tone, carried by ${plural(counts[dominantStyle], "member")}.`;

  const points: string[] = [
    `${plural(represented.length, "style")} represented across ${plural(members.length, "member")}; group averages span ${spread} points.`,
    `Widest divergence is ${dimensionMeta[widest.dimension].label} — ${widest.range} points between ${widest.lowestLabel} (${widest.low}) and ${widest.highestLabel} (${widest.high}). Expect that gap to show up as pace, not preference.`,
    `${furthest.aLabel} and ${furthest.bLabel} are the furthest apart in this set (${furthest.distance}-point average difference) — brief them separately before joint decisions.`,
    `${closest.aLabel} and ${closest.bLabel} read most alike (${closest.distance} points apart) — pairing them doubles a strength and doubles a blind spot.`,
    `${dimensionMeta[tightest.dimension].label} is the set's shared baseline — only ${tightest.range} points separate the highest and lowest.`,
  ];

  if (missing.length > 0) {
    points.push(
      `No one in this set leads with ${missing.map((dim) => dimensionMeta[dim].label).join(" or ")} — name who carries that perspective before the set decides anything.`,
    );
  }

  return { headline, points };
}
