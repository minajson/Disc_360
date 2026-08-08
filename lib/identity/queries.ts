import "server-only";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import type {
  IdentitySummary,
  ReconciliationBlocker,
  ReconciliationPreflight,
} from "@/lib/identity/model";

/**
 * Platform-admin reads over the identity graph.
 *
 * Service role throughout — justified, and narrowly: every function here is
 * called only after `requireSuperAdmin()`, and the SQL functions they call
 * re-check the actor's platform scope independently. Two locks on the same
 * door, so a future caller that forgets the guard still fails.
 *
 * Nothing in this module is reachable by a participant or a team facilitator.
 */

/* The SQL side returns snake_case jsonb; these adapt it once, here. */

interface RawIdentity {
  profile_id: string;
  full_name: string;
  preferred_name: string;
  email: string;
  created_at: string;
  deactivated_at: string | null;
  is_super_admin: boolean;
  disc_results: number;
  focus_results: number;
  combined_sessions: number;
  disc_sessions: number;
  focus_sessions: number;
  report_exports: number;
  team_memberships: number;
  teams: { id: string; name: string; role: string }[];
  aliases: {
    email: string;
    status: string;
    provider: string;
    source: string;
    first_seen_at: string;
    retired_at: string | null;
  }[];
}

function adaptIdentity(raw: RawIdentity): IdentitySummary {
  return {
    profileId: raw.profile_id,
    fullName: raw.full_name,
    preferredName: raw.preferred_name,
    email: raw.email,
    createdAt: raw.created_at,
    deactivatedAt: raw.deactivated_at,
    isSuperAdmin: raw.is_super_admin,
    discResults: raw.disc_results,
    focusResults: raw.focus_results,
    combinedSessions: raw.combined_sessions,
    discSessions: raw.disc_sessions,
    focusSessions: raw.focus_sessions,
    reportExports: raw.report_exports,
    teamMemberships: raw.team_memberships,
    teams: raw.teams ?? [],
    aliases: (raw.aliases ?? []).map((alias) => ({
      email: alias.email,
      status: alias.status === "active" ? "active" : "retired",
      provider: alias.provider,
      source: alias.source,
      firstSeenAt: alias.first_seen_at,
      retiredAt: alias.retired_at,
    })),
  };
}

export async function getIdentitySummary(profileId: string): Promise<IdentitySummary | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("identity_summary", { p_profile: profileId });
  if (error || !data) return null;
  return adaptIdentity(data as unknown as RawIdentity);
}

export async function getReconciliationPreflight(
  actorId: string,
  canonicalId: string,
  retiringId: string,
): Promise<ReconciliationPreflight | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_preflight_identity_reconciliation", {
    p_actor: actorId,
    p_canonical: canonicalId,
    p_retiring: retiringId,
  });
  if (error || !data) return null;

  const raw = data as unknown as {
    blockers: string[];
    canonical: RawIdentity;
    retiring: RawIdentity;
    shared_teams: {
      team_id: string;
      team_name: string;
      canonical_role: string;
      retiring_role: string;
    }[];
    shared_organizations: string[];
    attempts_to_abandon: { disc: number; focus: number; combined: number };
    singletons: {
      canonical_has_coach_profile: boolean;
      retiring_has_coach_profile: boolean;
    };
    projected: {
      disc_results: number;
      focus_results: number;
      combined_sessions: number;
      team_memberships: number;
    };
  };

  return {
    blockers: (raw.blockers ?? []) as ReconciliationBlocker[],
    canonical: adaptIdentity(raw.canonical),
    retiring: adaptIdentity(raw.retiring),
    sharedTeams: (raw.shared_teams ?? []).map((team) => ({
      teamId: team.team_id,
      teamName: team.team_name,
      canonicalRole: team.canonical_role,
      retiringRole: team.retiring_role,
    })),
    sharedOrganizations: raw.shared_organizations ?? [],
    attemptsToAbandon: raw.attempts_to_abandon,
    singletons: {
      canonicalHasCoachProfile: raw.singletons.canonical_has_coach_profile,
      retiringHasCoachProfile: raw.singletons.retiring_has_coach_profile,
    },
    projected: {
      discResults: raw.projected.disc_results,
      focusResults: raw.projected.focus_results,
      combinedSessions: raw.projected.combined_sessions,
      teamMemberships: raw.projected.team_memberships,
    },
  };
}

export interface IdentityHistoryEntry {
  id: string;
  action: string;
  status: string;
  oldEmail: string | null;
  newEmail: string | null;
  conflictsResolved: Record<string, unknown>;
  note: string | null;
  performedByName: string | null;
  createdAt: string;
  completedAt: string | null;
  retiredProfileId: string | null;
}

export async function getIdentityHistory(profileId: string): Promise<IdentityHistoryEntry[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("identity_reconciliations")
    .select(
      "id, action, status, old_email, new_email, conflicts_resolved, note, created_at, completed_at, retired_profile_id, profiles!identity_reconciliations_performed_by_fkey (full_name)",
    )
    .eq("canonical_profile_id", profileId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => {
    const actor = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      action: row.action,
      status: row.status,
      oldEmail: row.old_email,
      newEmail: row.new_email,
      conflictsResolved: (row.conflicts_resolved ?? {}) as Record<string, unknown>,
      note: row.note,
      performedByName: actor?.full_name ?? null,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      retiredProfileId: row.retired_profile_id,
    };
  });
}

export interface IdentitySearchHit {
  profileId: string;
  fullName: string;
  email: string;
  deactivatedAt: string | null;
  /** Set when the query matched an address this person no longer uses. */
  matchedPreviousEmail: string | null;
}

/**
 * Admin search across name, current address and every retired alias.
 *
 * A hit on a previous address returns the canonical person, badged — never a
 * dead profile and never a second row for the same human.
 */
export async function searchIdentities(
  query: string,
  limit = 20,
): Promise<IdentitySearchHit[]> {
  const term = query.trim();
  if (!term) return [];
  const admin = createSupabaseAdminClient();
  const pattern = `%${term.replace(/[%_]/g, (char) => `\\${char}`)}%`;

  const [{ data: direct }, { data: aliasHits }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, preferred_name, email, deactivated_at")
      .or(`email.ilike.${pattern},full_name.ilike.${pattern},preferred_name.ilike.${pattern}`)
      .limit(limit),
    admin
      .from("participant_identity_aliases")
      .select(
        "email, status, profiles!participant_identity_aliases_profile_id_fkey (id, full_name, email, deactivated_at)",
      )
      .ilike("email", pattern)
      .eq("status", "retired")
      .limit(limit),
  ]);

  const hits = new Map<string, IdentitySearchHit>();
  for (const row of direct ?? []) {
    hits.set(row.id, {
      profileId: row.id,
      fullName: row.full_name,
      email: row.email,
      deactivatedAt: row.deactivated_at,
      matchedPreviousEmail: null,
    });
  }
  for (const row of aliasHits ?? []) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (!profile || hits.has(profile.id)) continue;
    hits.set(profile.id, {
      profileId: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      deactivatedAt: profile.deactivated_at,
      matchedPreviousEmail: row.email,
    });
  }
  return [...hits.values()].slice(0, limit);
}

/** The profile that currently signs in with this address, if any. */
export async function findProfileByEmail(email: string): Promise<IdentitySearchHit | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("participant_identity_aliases")
    .select(
      "email, profiles!participant_identity_aliases_profile_id_fkey (id, full_name, email, deactivated_at)",
    )
    .eq("status", "active")
    .ilike("email", email.trim())
    .maybeSingle();
  const profile = Array.isArray(data?.profiles) ? data?.profiles[0] : data?.profiles;
  if (!profile) return null;
  return {
    profileId: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    deactivatedAt: profile.deactivated_at,
    matchedPreviousEmail: null,
  };
}
