import "server-only";
import { requireOnboarded } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { insightMap } from "@/data/insight-maps";
import {
  aggregateByGroup,
  behaviourClusters,
  completionAnalytics,
  dimensionHeatMap,
  executiveSummary,
  highBandDistribution,
  trendByMonth,
  type AnalyticsProfile,
  type AnalyticsTeam,
  type BehaviourCluster,
  type CompletionAnalytics,
  type GroupAggregate,
  type HeatMap,
  type HighBandSlice,
  type TrendPoint,
} from "@/lib/insights/analytics";
import {
  DIMENSION_KEY,
  DIMENSIONS,
  type ArchetypeCode,
  type Dimension,
  type DiscScores,
} from "@/lib/types";

/**
 * Organisation-wide executive analytics.
 *
 * Authorization first, then the service role — cross-team reporting is
 * deliberately impossible under RLS, so the scope is resolved from
 * memberships the viewer actually holds (or platform scope for a super admin)
 * and every query is constrained to that explicit id list. The service role is
 * never handed a caller-supplied team id.
 *
 * Anonymization: this module aggregates only. No individual name, email or
 * response ever leaves it — group labels are departments and team names, and
 * the smallest unit of output is a count. That means a team whose
 * `results_named` is false loses nothing here, because nothing identifying is
 * present to begin with.
 */

export type AnalyticsScope = "workspace" | "platform";

export interface ExecutiveAnalytics {
  scope: AnalyticsScope;
  /** Human description of what is being counted. */
  scopeLabel: string;
  organizations: string[];
  teams: AnalyticsTeam[];
  profileCount: number;
  averages: DiscScores;
  completion: CompletionAnalytics;
  departments: GroupAggregate[];
  businessUnits: GroupAggregate[];
  teamGroups: GroupAggregate[];
  departmentHeatMap: HeatMap;
  teamHeatMap: HeatMap;
  clusters: BehaviourCluster[];
  highBands: HighBandSlice[];
  trend: TrendPoint[];
  summary: string[];
}

interface TeamRow {
  id: string;
  name: string;
  department: string | null;
  organization_id: string;
  archived_at: string | null;
}

/**
 * Teams this viewer may see analytics for.
 *
 * · platform admin — every live team.
 * · everyone else — teams they administer directly, plus every team in an
 *   organization where they hold organization_admin or coach. This mirrors
 *   is_team_admin() exactly, so the analytics scope can never exceed the set
 *   of dashboards the person could already open one at a time.
 */
async function resolveScope(): Promise<{
  scope: AnalyticsScope;
  teamIds: string[];
  teams: TeamRow[];
}> {
  const { user, profile } = await requireOnboarded();
  const admin = createSupabaseAdminClient();

  if (profile.is_super_admin) {
    const { data } = await admin
      .from("teams")
      .select("id, name, department, organization_id, archived_at")
      .is("archived_at", null)
      .order("name");
    const teams = (data ?? []) as TeamRow[];
    return { scope: "platform", teamIds: teams.map((team) => team.id), teams };
  }

  const [{ data: adminMemberships }, { data: orgMemberships }] = await Promise.all([
    admin
      .from("team_members")
      .select("team_id")
      .eq("profile_id", user.id)
      .eq("role", "team_admin"),
    admin
      .from("organization_members")
      .select("organization_id")
      .eq("profile_id", user.id)
      .in("role", ["organization_admin", "coach"]),
  ]);

  const directIds = new Set((adminMemberships ?? []).map((row) => row.team_id));
  const orgIds = [...new Set((orgMemberships ?? []).map((row) => row.organization_id))];

  const { data: orgTeams } = orgIds.length
    ? await admin
        .from("teams")
        .select("id, name, department, organization_id, archived_at")
        .in("organization_id", orgIds)
        .is("archived_at", null)
    : { data: [] as TeamRow[] };

  for (const team of (orgTeams ?? []) as TeamRow[]) directIds.add(team.id);

  const ids = [...directIds];
  if (ids.length === 0) return { scope: "workspace", teamIds: [], teams: [] };

  const { data } = await admin
    .from("teams")
    .select("id, name, department, organization_id, archived_at")
    .in("id", ids)
    .is("archived_at", null)
    .order("name");

  const teams = (data ?? []) as TeamRow[];
  return { scope: "workspace", teamIds: teams.map((team) => team.id), teams };
}

const EMPTY_SCORES: DiscScores = { d: 0, i: 0, s: 0, c: 0 };

function meanScores(profiles: readonly { scores: DiscScores }[]): DiscScores {
  if (profiles.length === 0) return EMPTY_SCORES;
  const totals: DiscScores = { d: 0, i: 0, s: 0, c: 0 };
  for (const profile of profiles) {
    for (const dim of DIMENSIONS) {
      totals[DIMENSION_KEY[dim]] += profile.scores[DIMENSION_KEY[dim]];
    }
  }
  return {
    d: Math.round(totals.d / profiles.length),
    i: Math.round(totals.i / profiles.length),
    s: Math.round(totals.s / profiles.length),
    c: Math.round(totals.c / profiles.length),
  };
}

/**
 * Builds the executive analytics payload for the viewer's scope.
 *
 * `now` is injected so the trend window is reproducible in tests and in
 * server rendering; callers pass the request time.
 */
export async function getExecutiveAnalytics(
  now: Date = new Date(),
): Promise<ExecutiveAnalytics> {
  const { scope, teamIds, teams } = await resolveScope();

  const empty: ExecutiveAnalytics = {
    scope,
    scopeLabel: scope === "platform" ? "All teams on the platform" : "Teams you administer",
    organizations: [],
    teams: [],
    profileCount: 0,
    averages: EMPTY_SCORES,
    completion: completionAnalytics([]),
    departments: [],
    businessUnits: [],
    teamGroups: [],
    departmentHeatMap: dimensionHeatMap([]),
    teamHeatMap: dimensionHeatMap([]),
    clusters: [],
    highBands: highBandDistribution([]),
    trend: trendByMonth([], now),
    summary: executiveSummary({ teams: [], profiles: [], groups: [] }),
  };

  if (teamIds.length === 0) return empty;

  const admin = createSupabaseAdminClient();
  const orgIds = [...new Set(teams.map((team) => team.organization_id))];

  const [{ data: organizations }, { data: members }, { data: results }] =
    await Promise.all([
      admin.from("organizations").select("id, name").in("id", orgIds),
      admin
        .from("team_members")
        .select("id, team_id, profile_id, department")
        .in("team_id", teamIds),
      admin
        .from("assessment_results")
        .select(
          "profile_id, team_id, score_d, score_i, score_s, score_c, archetype_code, primary_dimension, created_at",
        )
        .in("team_id", teamIds)
        .order("created_at", { ascending: false }),
    ]);

  const orgNameById = new Map(
    (organizations ?? []).map((row) => [row.id as string, row.name as string]),
  );
  const teamById = new Map(teams.map((team) => [team.id, team]));

  // Latest result per (team, member) — the same team-isolation rule the team
  // surfaces use: a member's result from another team never counts here.
  const latest = new Map<string, NonNullable<typeof results>[number]>();
  for (const row of results ?? []) {
    const key = `${row.team_id}:${row.profile_id}`;
    if (!latest.has(key)) latest.set(key, row);
  }

  const profiles: AnalyticsProfile[] = [];
  const completedByTeam = new Map<string, number>();
  const memberCountByTeam = new Map<string, number>();
  const profilesByTeam = new Map<string, AnalyticsProfile[]>();

  for (const member of members ?? []) {
    memberCountByTeam.set(
      member.team_id,
      (memberCountByTeam.get(member.team_id) ?? 0) + 1,
    );
    if (!member.profile_id) continue;
    const result = latest.get(`${member.team_id}:${member.profile_id}`);
    if (!result) continue;

    const team = teamById.get(member.team_id);
    if (!team) continue;

    const code = result.archetype_code as ArchetypeCode;
    const profile: AnalyticsProfile = {
      // Department is the person's own, falling back to the team's — an
      // organisation that only tags departments at team level still gets a
      // meaningful department comparison.
      group: member.department ?? team.department ?? "Unassigned",
      teamId: team.id,
      teamName: team.name,
      scores: {
        d: result.score_d,
        i: result.score_i,
        s: result.score_s,
        c: result.score_c,
      },
      primary: result.primary_dimension as Dimension,
      archetypeCode: code,
      archetypeName: insightMap[code].name,
      completedAt: result.created_at,
    };
    profiles.push(profile);
    completedByTeam.set(team.id, (completedByTeam.get(team.id) ?? 0) + 1);
    const bucket = profilesByTeam.get(team.id);
    if (bucket) bucket.push(profile);
    else profilesByTeam.set(team.id, [profile]);
  }

  const analyticsTeams: AnalyticsTeam[] = teams.map((team) => ({
    teamId: team.id,
    teamName: team.name,
    department: team.department,
    organizationName: orgNameById.get(team.organization_id) ?? "—",
    memberCount: memberCountByTeam.get(team.id) ?? 0,
    completedCount: completedByTeam.get(team.id) ?? 0,
    averages: meanScores(profilesByTeam.get(team.id) ?? []),
  }));

  const departments = aggregateByGroup(profiles);
  const teamGroups = aggregateByGroup(
    profiles.map((profile) => ({ ...profile, group: profile.teamName })),
  );
  const businessUnits = aggregateByGroup(
    profiles.map((profile) => ({
      ...profile,
      group: orgNameById.get(teamById.get(profile.teamId)?.organization_id ?? "") ?? "—",
    })),
  );

  return {
    scope,
    scopeLabel:
      scope === "platform"
        ? `All ${analyticsTeams.length} live team${analyticsTeams.length === 1 ? "" : "s"} on the platform`
        : `${analyticsTeams.length} team${analyticsTeams.length === 1 ? "" : "s"} you administer`,
    organizations: [...orgNameById.values()].sort(),
    teams: analyticsTeams,
    profileCount: profiles.length,
    averages: meanScores(profiles),
    completion: completionAnalytics(analyticsTeams),
    departments,
    businessUnits,
    teamGroups,
    departmentHeatMap: dimensionHeatMap(departments),
    teamHeatMap: dimensionHeatMap(teamGroups),
    clusters: behaviourClusters(profiles),
    highBands: highBandDistribution(profiles),
    trend: trendByMonth(profiles, now),
    summary: executiveSummary({ teams: analyticsTeams, profiles, groups: departments }),
  };
}
