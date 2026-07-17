import "server-only";
import { requireOnboarded } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";

/**
 * Cross-team data for the facilitator experience (dashboard, Participants,
 * Present).
 *
 * `getTeamRoster` deliberately guards a single team with `requireTeamAdmin`,
 * which redirects — useless for an aggregate over every team a person
 * administers. Here the scoping is the inverse: we first ask which teams the
 * caller holds `team_admin` on *through their own RLS-bound client*, then use
 * the service role only to count within exactly those teams. No team the
 * caller does not administer can enter the result, and no raw answer or
 * individual response is ever read.
 */

export interface FacilitatorTeam {
  id: string;
  name: string;
  teamCode: string;
  inviteToken: string;
  clientOrganization: string | null;
  sessionName: string | null;
  deadlineAt: string | null;
  joinEnabled: boolean;
  /** Roster size — everyone invited or self-joined. */
  participants: number;
  /** Roster entries that have claimed an account. */
  joined: number;
  completed: number;
  reportsSent: number;
  completionRate: number;
}

export interface FacilitatorSummary {
  teams: FacilitatorTeam[];
  totals: {
    teams: number;
    participants: number;
    completed: number;
    reportsSent: number;
  };
  /** Soonest upcoming deadline across live teams, if any. */
  nextPresentation: { teamId: string; teamName: string; deadlineAt: string } | null;
}

interface TeamJoinRow {
  role: string;
  teams: {
    id: string;
    name: string;
    team_code: string;
    invite_token: string;
    client_organization: string | null;
    session_name: string | null;
    deadline_at: string | null;
    join_enabled: boolean;
    archived_at: string | null;
  } | null;
}

/** Teams the signed-in user administers, with completion metrics. */
export async function getFacilitatorTeams(): Promise<FacilitatorTeam[]> {
  const { supabase, user } = await requireOnboarded();

  const { data: memberships } = await supabase
    .from("team_members")
    .select(
      "role, teams (id, name, team_code, invite_token, client_organization, session_name, deadline_at, join_enabled, archived_at)",
    )
    .eq("profile_id", user.id)
    .eq("role", "team_admin");

  const teams = ((memberships ?? []) as unknown as TeamJoinRow[])
    .map((row) => row.teams)
    .filter((team): team is NonNullable<TeamJoinRow["teams"]> =>
      Boolean(team && !team.archived_at),
    );

  if (teams.length === 0) return [];

  const admin = createSupabaseAdminClient();

  return Promise.all(
    teams.map(async (team) => {
      const { data: members } = await admin
        .from("team_members")
        .select("profile_id, email")
        .eq("team_id", team.id);

      const roster = members ?? [];
      const profileIds = roster
        .map((member) => member.profile_id)
        .filter((id): id is string => Boolean(id));
      const emails = roster.map((member) => member.email);

      const [{ data: results }, { data: reportLogs }] = await Promise.all([
        profileIds.length
          ? admin
              .from("assessment_results")
              .select("profile_id")
              .in("profile_id", profileIds)
          : Promise.resolve({ data: [] as { profile_id: string }[] }),
        emails.length
          ? admin
              .from("notification_logs")
              .select("email")
              .eq("template", "report_ready")
              .in("status", ["sent", "logged"])
              .in("email", emails)
          : Promise.resolve({ data: [] as { email: string }[] }),
      ]);

      const completed = new Set((results ?? []).map((row) => row.profile_id)).size;
      const reportsSent = new Set((reportLogs ?? []).map((row) => row.email)).size;

      return {
        id: team.id,
        name: team.name,
        teamCode: team.team_code,
        inviteToken: team.invite_token,
        clientOrganization: team.client_organization,
        sessionName: team.session_name,
        deadlineAt: team.deadline_at,
        joinEnabled: team.join_enabled,
        participants: roster.length,
        joined: profileIds.length,
        completed,
        reportsSent,
        completionRate:
          roster.length > 0 ? Math.round((completed / roster.length) * 100) : 0,
      } satisfies FacilitatorTeam;
    }),
  );
}

/** Facilitator landing metrics: the teams plus the roll-up above them. */
export async function getFacilitatorSummary(): Promise<FacilitatorSummary> {
  const teams = await getFacilitatorTeams();

  const totals = teams.reduce(
    (sum, team) => ({
      teams: sum.teams + 1,
      participants: sum.participants + team.participants,
      completed: sum.completed + team.completed,
      reportsSent: sum.reportsSent + team.reportsSent,
    }),
    { teams: 0, participants: 0, completed: 0, reportsSent: 0 },
  );

  const upcoming = teams
    .filter((team) => team.deadlineAt)
    .map((team) => ({
      teamId: team.id,
      teamName: team.name,
      deadlineAt: team.deadlineAt as string,
    }))
    .sort((a, b) => a.deadlineAt.localeCompare(b.deadlineAt));

  return { teams, totals, nextPresentation: upcoming[0] ?? null };
}
