import "server-only";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { requireOnboarded, type AuthContext } from "@/lib/auth/guards";
import { INSTRUMENTS, isInstrumentKey, type InstrumentKey } from "@/data/wellbeing-instruments";
import { lifecycleOf, type CampaignLifecycle } from "./campaign-lifecycle";

/**
 * The campaigns a person may see, and no others.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS MODULE EXISTS.
 *
 * The previous campaign list — on `/wellbeing/admin/pilot` — ran
 *
 *     admin.from("teams").select(…).eq("assessment_type", "wellbeing")
 *
 * with the service role and NO scope predicate at all. Every wellbeing
 * campaign on the platform, in every organisation, was listed to anybody who
 * held team-admin rights anywhere. Campaign names are chosen by customers and
 * routinely name a department, a site or a programme, so that is one
 * organisation's operational information disclosed to another's staff.
 *
 * The rule here is explicit and computed BEFORE the query:
 *
 *   · a wellbeing role in an organisation → every campaign in it
 *   · team-admin on a campaign's roster   → that campaign
 *   · platform administration             → everything, deliberately
 *
 * Nothing is fetched and then filtered in the page.
 *
 * NO FIGURE IS READ HERE. Counts of people, not scores: how many joined and
 * how many finished. A campaign list is administration.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface CampaignSummary {
  /** The roster team id — what the campaign routes are keyed by. */
  teamId: string;
  campaignId: string | null;
  name: string;
  organizationName: string;
  instrumentKey: InstrumentKey | null;
  questionnaireName: string | null;
  lifecycle: CampaignLifecycle;
  joined: number;
  completed: number;
  createdAt: string;
}

export async function listVisibleCampaigns(): Promise<{
  context: AuthContext;
  campaigns: CampaignSummary[];
  /** Organisations in which this person may create a campaign. */
  governedOrganizations: { id: string; name: string }[];
}> {
  const context = await requireOnboarded();
  const admin = createSupabaseAdminClient();

  const [{ data: grants }, { data: adminMemberships }] = await Promise.all([
    context.supabase
      .from("wellbeing_role_grants")
      .select("organization_id, role, organizations (name)")
      .eq("profile_id", context.user.id)
      .is("revoked_at", null),
    context.supabase
      .from("team_members")
      .select("team_id")
      .eq("profile_id", context.user.id)
      .eq("role", "team_admin"),
  ]);

  const roleOrgs = new Set((grants ?? []).map((row) => row.organization_id as string));
  const adminTeams = new Set((adminMemberships ?? []).map((row) => row.team_id as string));
  const platform = context.profile.is_super_admin;

  if (!platform && roleOrgs.size === 0 && adminTeams.size === 0) {
    return { context, campaigns: [], governedOrganizations: [] };
  }

  // One query, scoped by the union above. `or` with two `in` lists is a single
  // predicate the database evaluates — not a fetch-everything followed by a
  // filter this module could forget to apply.
  let query = admin
    .from("wellbeing_campaigns")
    .select(
      "id, name, status, instrument_key, team_id, created_at, organization_id, organizations (name)",
    )
    .not("team_id", "is", null)
    .order("created_at", { ascending: false });

  if (!platform) {
    const clauses: string[] = [];
    if (roleOrgs.size > 0) clauses.push(`organization_id.in.(${[...roleOrgs].join(",")})`);
    if (adminTeams.size > 0) clauses.push(`team_id.in.(${[...adminTeams].join(",")})`);
    query = query.or(clauses.join(","));
  }

  const { data: rows } = await query;
  const campaigns = rows ?? [];
  if (campaigns.length === 0) {
    return { context, campaigns: [], governedOrganizations: governed(grants) };
  }

  const teamIds = campaigns.map((row) => row.team_id as string);

  // Participation, for the whole visible set in two queries rather than two
  // per campaign. Neither selects a score.
  const [{ data: members }, { data: sessions }] = await Promise.all([
    admin.from("team_members").select("team_id, profile_id, role").in("team_id", teamIds),
    admin
      .from("wellbeing_sessions")
      .select("team_id, profile_id, status")
      .in("team_id", teamIds),
  ]);

  const startedBy = new Map<string, Set<string>>();
  const completedBy = new Map<string, Set<string>>();
  for (const session of sessions ?? []) {
    const team = session.team_id as string;
    const profile = session.profile_id as string;
    if (!startedBy.has(team)) startedBy.set(team, new Set());
    startedBy.get(team)!.add(profile);
    if (session.status === "completed") {
      if (!completedBy.has(team)) completedBy.set(team, new Set());
      completedBy.get(team)!.add(profile);
    }
  }

  const joinedBy = new Map<string, number>();
  for (const member of members ?? []) {
    const team = member.team_id as string;
    const profile = member.profile_id as string | null;
    // The facilitator on their own roster is not a participant until they
    // take part — see `loadCampaignTally` for the same rule and its reason.
    if (member.role === "team_admin" && (!profile || !startedBy.get(team)?.has(profile))) {
      continue;
    }
    joinedBy.set(team, (joinedBy.get(team) ?? 0) + 1);
  }

  return {
    context,
    governedOrganizations: governed(grants),
    campaigns: campaigns.map((row) => {
      const teamId = row.team_id as string;
      const key = row.instrument_key as string;
      const instrumentKey = isInstrumentKey(key) ? key : null;
      const organization = Array.isArray(row.organizations)
        ? row.organizations[0]
        : row.organizations;
      return {
        teamId,
        campaignId: row.id as string,
        name: row.name as string,
        organizationName: (organization as { name: string } | null)?.name ?? "Organisation",
        instrumentKey,
        questionnaireName: instrumentKey ? INSTRUMENTS[instrumentKey].name : null,
        lifecycle: lifecycleOf(row.status as string),
        joined: joinedBy.get(teamId) ?? 0,
        completed: completedBy.get(teamId)?.size ?? 0,
        createdAt: row.created_at as string,
      };
    }),
  };
}

function governed(
  grants: { organization_id: string; role: string; organizations: unknown }[] | null,
): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const grant of grants ?? []) {
    if (grant.role !== "wellbeing_governance") continue;
    const organization = Array.isArray(grant.organizations)
      ? grant.organizations[0]
      : grant.organizations;
    seen.set(
      grant.organization_id,
      (organization as { name: string } | null)?.name ?? "Organisation",
    );
  }
  return [...seen].map(([id, name]) => ({ id, name }));
}
