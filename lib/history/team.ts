import "server-only";
import { requireTeamAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import {
  compareTeamPeriods,
  periodsInSeries,
  type TeamPeriod,
  type TeamPeriodComparison,
} from "@/lib/history/timeline";
import { DIMENSION_KEY, DIMENSIONS, type Dimension, type DiscScores } from "@/lib/types";

/**
 * Team history, scoped to one lineage.
 *
 * Authorization first (requireTeamAdmin on the team being viewed), then the
 * service role — cross-member aggregation is impossible under RLS by design.
 * Output is aggregate only: counts, averages and composition. No participant
 * name, email or individual result leaves this module, so a facilitator
 * reading team history cannot learn anything about a specific person that the
 * team's own visibility settings do not already allow elsewhere.
 *
 * Lineage is explicit. A team belongs to a period series through
 * `team_series_id`, never through a matching name — two unrelated teams can
 * share a name, and a continuing team is usually renamed precisely because
 * something changed.
 */

export interface TeamHistory {
  teamId: string;
  teamName: string;
  seriesId: string | null;
  seriesName: string | null;
  periods: TeamPeriod[];
  /** Consecutive period comparisons, oldest pair first. */
  comparisons: TeamPeriodComparison[];
  /** Teams in the same organisation that could be linked into the series. */
  linkable: { id: string; name: string; createdAt: string }[];
}

const EMPTY: DiscScores = { d: 0, i: 0, s: 0, c: 0 };

function meanScores(rows: readonly { scores: DiscScores }[]): DiscScores {
  if (rows.length === 0) return EMPTY;
  const totals: DiscScores = { d: 0, i: 0, s: 0, c: 0 };
  for (const row of rows) {
    for (const dim of DIMENSIONS) totals[DIMENSION_KEY[dim]] += row.scores[DIMENSION_KEY[dim]];
  }
  return {
    d: Math.round(totals.d / rows.length),
    i: Math.round(totals.i / rows.length),
    s: Math.round(totals.s / rows.length),
    c: Math.round(totals.c / rows.length),
  };
}

export async function getTeamHistory(teamId: string): Promise<TeamHistory | { error: string }> {
  await requireTeamAdmin(teamId);
  const admin = createSupabaseAdminClient();

  const { data: team } = await admin
    .from("teams")
    .select("id, name, organization_id, team_series_id, created_at")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return { error: "Team not found" };

  const { data: series } = team.team_series_id
    ? await admin
        .from("team_series")
        .select("id, name")
        .eq("id", team.team_series_id)
        .maybeSingle()
    : { data: null };

  // Candidate teams: the whole series when one exists, otherwise this team
  // alone. Never every team in the organisation.
  const { data: seriesTeams } = team.team_series_id
    ? await admin
        .from("teams")
        .select("id, name, team_series_id, created_at")
        .eq("team_series_id", team.team_series_id)
        .order("created_at")
    : { data: [{ ...team, team_series_id: null }] };

  const teamIds = (seriesTeams ?? []).map((row) => row.id);

  const [{ data: members }, { data: results }] = await Promise.all([
    admin.from("team_members").select("team_id, profile_id, department").in("team_id", teamIds),
    admin
      .from("assessment_results")
      .select("team_id, profile_id, score_d, score_i, score_s, score_c, primary_dimension, created_at")
      .in("team_id", teamIds)
      .order("created_at", { ascending: false }),
  ]);

  // Latest result per (team, member) — the same team-isolation rule every
  // other team surface uses.
  const latest = new Map<string, NonNullable<typeof results>[number]>();
  for (const row of results ?? []) {
    const key = `${row.team_id}:${row.profile_id}`;
    if (!latest.has(key)) latest.set(key, row);
  }

  const periods: TeamPeriod[] = (seriesTeams ?? []).map((row) => {
    const roster = (members ?? []).filter((member) => member.team_id === row.id);
    const completed = roster.flatMap((member) => {
      const result = member.profile_id ? latest.get(`${row.id}:${member.profile_id}`) : undefined;
      if (!result) return [];
      return [
        {
          scores: {
            d: result.score_d,
            i: result.score_i,
            s: result.score_s,
            c: result.score_c,
          },
          primary: result.primary_dimension as Dimension,
          department: member.department,
          completedAt: result.created_at,
        },
      ];
    });

    const composition: Record<Dimension, number> = { D: 0, I: 0, S: 0, C: 0 };
    for (const entry of completed) composition[entry.primary] += 1;

    // The period's date is its latest completion — when the picture was taken
    // — falling back to the team's creation for a period with no results yet.
    const latestCompletion = completed
      .map((entry) => entry.completedAt)
      .sort()
      .at(-1);

    return {
      teamId: row.id,
      teamName: row.name,
      teamSeriesId: row.team_series_id ?? null,
      completedAt: latestCompletion ?? row.created_at,
      memberCount: roster.length,
      completedCount: completed.length,
      averages: meanScores(completed),
      composition,
      departments: [
        ...new Set(
          roster.map((member) => member.department).filter((d): d is string => Boolean(d)),
        ),
      ].sort(),
    };
  });

  const ordered = periodsInSeries(periods, team.team_series_id ?? null, team.id);
  const comparisons: TeamPeriodComparison[] = [];
  for (let index = 1; index < ordered.length; index++) {
    comparisons.push(compareTeamPeriods(ordered[index - 1]!, ordered[index]!));
  }

  // Teams an administrator could link into this series: same organisation,
  // not already in one. Offered, never applied automatically.
  const { data: candidates } = await admin
    .from("teams")
    .select("id, name, created_at, team_series_id")
    .eq("organization_id", team.organization_id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  return {
    teamId: team.id,
    teamName: team.name,
    seriesId: team.team_series_id ?? null,
    seriesName: series?.name ?? null,
    periods: ordered,
    comparisons,
    linkable: (candidates ?? [])
      .filter((row) => row.id !== team.id && !teamIds.includes(row.id))
      .map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at })),
  };
}
