import {
  DIMENSION_KEY,
  DIMENSIONS,
  type ArchetypeCode,
  type Dimension,
  type DiscScores,
} from "../types/index.ts";
import { dimensionMeta } from "../../data/dimension-meta.ts";
import { HIGH_BAND, rankDimensions, sharesOf100 } from "./board.ts";

/**
 * Organisation-wide analytics mathematics — pure, deterministic, unit-tested.
 *
 * Everything an executive dashboard renders is computed here from rows the
 * server has already authorized and (where the team asks for it) anonymized.
 * No I/O and no implicit clock: functions that bucket by time take `now` as a
 * parameter, so a chart is reproducible and a test is not flaky at midnight.
 */

export interface AnalyticsProfile {
  /** Group the person is counted under — department, or "Unassigned". */
  group: string;
  teamId: string;
  teamName: string;
  scores: DiscScores;
  primary: Dimension;
  archetypeCode: ArchetypeCode;
  archetypeName: string;
  /** ISO-8601 completion timestamp. */
  completedAt: string;
}

export interface AnalyticsTeam {
  teamId: string;
  teamName: string;
  department: string | null;
  organizationName: string;
  memberCount: number;
  completedCount: number;
  averages: DiscScores;
}

/* ── completion ─────────────────────────────────────────────────────── */

export interface CompletionAnalytics {
  memberCount: number;
  completedCount: number;
  rate: number;
  teamsTracked: number;
  /** Teams whose completion sits under the attention threshold. */
  laggingTeams: { teamId: string; teamName: string; rate: number }[];
}

export const LAGGING_COMPLETION = 60;

export function completionAnalytics(
  teams: readonly AnalyticsTeam[],
): CompletionAnalytics {
  const memberCount = teams.reduce((sum, team) => sum + team.memberCount, 0);
  const completedCount = teams.reduce((sum, team) => sum + team.completedCount, 0);
  const lagging = teams
    .filter((team) => team.memberCount > 0)
    .map((team) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      rate: Math.round((team.completedCount / team.memberCount) * 100),
    }))
    .filter((entry) => entry.rate < LAGGING_COMPLETION)
    .sort((a, b) => a.rate - b.rate);

  return {
    memberCount,
    completedCount,
    rate: memberCount > 0 ? Math.round((completedCount / memberCount) * 100) : 0,
    teamsTracked: teams.length,
    laggingTeams: lagging,
  };
}

/* ── grouped aggregation ────────────────────────────────────────────── */

export interface GroupAggregate {
  group: string;
  count: number;
  averages: DiscScores;
  /** Head-count of primary styles inside the group. */
  composition: Record<Dimension, number>;
  lead: Dimension;
  spread: number;
}

/**
 * Aggregates profiles by their `group` key. Groups come back largest first so
 * a dashboard's first row is the one that moves the organisation.
 */
export function aggregateByGroup(
  profiles: readonly AnalyticsProfile[],
): GroupAggregate[] {
  const buckets = new Map<string, AnalyticsProfile[]>();
  for (const profile of profiles) {
    const bucket = buckets.get(profile.group);
    if (bucket) bucket.push(profile);
    else buckets.set(profile.group, [profile]);
  }

  return [...buckets.entries()]
    .map(([group, members]) => {
      const totals: DiscScores = { d: 0, i: 0, s: 0, c: 0 };
      const composition: Record<Dimension, number> = { D: 0, I: 0, S: 0, C: 0 };
      for (const member of members) {
        composition[member.primary] += 1;
        for (const dim of DIMENSIONS) {
          totals[DIMENSION_KEY[dim]] += member.scores[DIMENSION_KEY[dim]];
        }
      }
      const averages: DiscScores = {
        d: Math.round(totals.d / members.length),
        i: Math.round(totals.i / members.length),
        s: Math.round(totals.s / members.length),
        c: Math.round(totals.c / members.length),
      };
      const values = DIMENSIONS.map((dim) => averages[DIMENSION_KEY[dim]]);
      return {
        group,
        count: members.length,
        averages,
        composition,
        lead: rankDimensions(averages)[0]!,
        spread: Math.max(...values) - Math.min(...values),
      };
    })
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));
}

/* ── heat map ───────────────────────────────────────────────────────── */

export interface HeatMapCell {
  group: string;
  dimension: Dimension;
  value: number;
  /** 0–1 position of `value` inside the matrix's own range. */
  intensity: number;
}

export interface HeatMap {
  groups: string[];
  cells: HeatMapCell[];
  min: number;
  max: number;
}

/**
 * Group × dimension heat map of average intensity.
 *
 * Intensity is scaled against the matrix's own min/max rather than 0–100:
 * organisational averages cluster in a narrow band, and a fixed 0–100 ramp
 * renders every cell the same mid-tone. When every value is identical the
 * whole grid reads as 0.5 instead of dividing by zero.
 */
export function dimensionHeatMap(groups: readonly GroupAggregate[]): HeatMap {
  if (groups.length === 0) {
    return { groups: [], cells: [], min: 0, max: 0 };
  }
  const values = groups.flatMap((group) =>
    DIMENSIONS.map((dim) => group.averages[DIMENSION_KEY[dim]]),
  );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  const cells: HeatMapCell[] = [];
  for (const group of groups) {
    for (const dimension of DIMENSIONS) {
      const value = group.averages[DIMENSION_KEY[dimension]];
      cells.push({
        group: group.group,
        dimension,
        value,
        intensity: span === 0 ? 0.5 : (value - min) / span,
      });
    }
  }
  return { groups: groups.map((group) => group.group), cells, min, max };
}

/* ── behaviour clusters ─────────────────────────────────────────────── */

export interface BehaviourCluster {
  code: ArchetypeCode;
  name: string;
  count: number;
  share: number;
  primary: Dimension;
}

/** Archetype clusters across the population, largest first. */
export function behaviourClusters(
  profiles: readonly AnalyticsProfile[],
): BehaviourCluster[] {
  const buckets = new Map<ArchetypeCode, AnalyticsProfile[]>();
  for (const profile of profiles) {
    const bucket = buckets.get(profile.archetypeCode);
    if (bucket) bucket.push(profile);
    else buckets.set(profile.archetypeCode, [profile]);
  }
  const entries = [...buckets.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );
  const shares = sharesOf100(entries.map(([, members]) => members.length));
  return entries.map(([code, members], index) => ({
    code,
    name: members[0]!.archetypeName,
    count: members.length,
    share: shares[index]!,
    primary: members[0]!.primary,
  }));
}

/* ── high-band distribution ─────────────────────────────────────────── */

export interface HighBandSlice {
  dimension: Dimension;
  count: number;
  percentage: number;
}

/**
 * "High D / High I / High S / High A" — how much of the organisation can
 * operate in each mode. Independent per dimension, so the four percentages
 * legitimately sum past 100.
 */
export function highBandDistribution(
  profiles: readonly AnalyticsProfile[],
): HighBandSlice[] {
  const total = profiles.length;
  return DIMENSIONS.map((dimension) => {
    const count = profiles.filter(
      (profile) => profile.scores[DIMENSION_KEY[dimension]] >= HIGH_BAND,
    ).length;
    return {
      dimension,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });
}

/* ── trend ──────────────────────────────────────────────────────────── */

export interface TrendPoint {
  /** Month key, YYYY-MM. */
  key: string;
  /** Short display label, e.g. "Mar". */
  label: string;
  count: number;
  averages: DiscScores;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/**
 * Completions bucketed by calendar month, ending at `now`.
 *
 * Empty months are kept rather than skipped — a gap in assessment activity is
 * a finding, and dropping it would draw a straight line across a quarter in
 * which nothing happened.
 */
export function trendByMonth(
  profiles: readonly AnalyticsProfile[],
  now: Date,
  months = 12,
): TrendPoint[] {
  const buckets = new Map<string, AnalyticsProfile[]>();
  const window: { key: string; label: string }[] = [];

  for (let offset = months - 1; offset >= 0; offset--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const key = monthKey(date.getUTCFullYear(), date.getUTCMonth());
    window.push({ key, label: MONTH_LABELS[date.getUTCMonth()]! });
    buckets.set(key, []);
  }

  for (const profile of profiles) {
    const date = new Date(profile.completedAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = monthKey(date.getUTCFullYear(), date.getUTCMonth());
    buckets.get(key)?.push(profile);
  }

  return window.map(({ key, label }) => {
    const members = buckets.get(key) ?? [];
    if (members.length === 0) {
      return { key, label, count: 0, averages: { d: 0, i: 0, s: 0, c: 0 } };
    }
    const totals: DiscScores = { d: 0, i: 0, s: 0, c: 0 };
    for (const member of members) {
      for (const dim of DIMENSIONS) {
        totals[DIMENSION_KEY[dim]] += member.scores[DIMENSION_KEY[dim]];
      }
    }
    return {
      key,
      label,
      count: members.length,
      averages: {
        d: Math.round(totals.d / members.length),
        i: Math.round(totals.i / members.length),
        s: Math.round(totals.s / members.length),
        c: Math.round(totals.c / members.length),
      },
    };
  });
}

/* ── executive summary ──────────────────────────────────────────────── */

export interface ExecutiveSummaryInput {
  teams: readonly AnalyticsTeam[];
  profiles: readonly AnalyticsProfile[];
  groups: readonly GroupAggregate[];
}

/**
 * The five or six sentences an executive reads instead of the dashboard.
 * Every line is derived from a number rendered elsewhere on the page.
 */
export function executiveSummary(input: ExecutiveSummaryInput): string[] {
  const { teams, profiles, groups } = input;
  if (profiles.length === 0) {
    return [
      "No completed profiles in scope yet. Organisation analytics populate as teams finish their assessments.",
    ];
  }

  const completion = completionAnalytics(teams);
  const totals: DiscScores = { d: 0, i: 0, s: 0, c: 0 };
  for (const profile of profiles) {
    for (const dim of DIMENSIONS) {
      totals[DIMENSION_KEY[dim]] += profile.scores[DIMENSION_KEY[dim]];
    }
  }
  const averages: DiscScores = {
    d: Math.round(totals.d / profiles.length),
    i: Math.round(totals.i / profiles.length),
    s: Math.round(totals.s / profiles.length),
    c: Math.round(totals.c / profiles.length),
  };
  const ranked = rankDimensions(averages);
  const lead = ranked[0]!;
  const weakest = ranked[3]!;
  const highBands = highBandDistribution(profiles);
  const deepest = [...highBands].sort((a, b) => b.count - a.count)[0]!;
  const clusters = behaviourClusters(profiles);
  const topCluster = clusters[0]!;

  const lines: string[] = [
    `${profiles.length} completed profile${profiles.length === 1 ? "" : "s"} across ${completion.teamsTracked} team${completion.teamsTracked === 1 ? "" : "s"}, at ${completion.rate}% completion of ${completion.memberCount} invited.`,
    `The organisation's centre of gravity is ${dimensionMeta[lead].label} (average ${averages[DIMENSION_KEY[lead]]}), with ${dimensionMeta[weakest].label} thinnest at ${averages[DIMENSION_KEY[weakest]]}.`,
    `${deepest.percentage}% of the population runs ${dimensionMeta[deepest.dimension].label} at strength — the deepest available bench regardless of which style leads each individual.`,
    `The largest behaviour cluster is ${topCluster.name} at ${topCluster.share}% of completed profiles.`,
  ];

  if (groups.length > 1) {
    const widest = [...groups].sort((a, b) => b.spread - a.spread)[0]!;
    const mostBalanced = [...groups].sort((a, b) => a.spread - b.spread)[0]!;
    lines.push(
      `${widest.group} is the most style-concentrated group (${widest.spread}-point spread, led by ${dimensionMeta[widest.lead].label}); ${mostBalanced.group} is the most evenly balanced (${mostBalanced.spread} points).`,
    );
  }

  if (completion.laggingTeams.length > 0) {
    const names = completion.laggingTeams.slice(0, 3).map((team) => `${team.teamName} (${team.rate}%)`);
    lines.push(
      `${completion.laggingTeams.length} team${completion.laggingTeams.length === 1 ? "" : "s"} sit below ${LAGGING_COMPLETION}% completion — ${names.join(", ")}${completion.laggingTeams.length > 3 ? ", and others" : ""}. Conclusions for those teams are directional only.`,
    );
  }

  return lines;
}
