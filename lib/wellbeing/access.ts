import "server-only";
import { requireOnboarded, type AuthContext } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";

/**
 * Wellbeing access control — a privilege family of its own.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT `requireTeamAdmin`.
 *
 * Migration 00019 made `is_team_admin()` return true platform-wide for any
 * super administrator. That is correct for facilitation — a platform admin
 * supports any facilitator's session — and wrong for health data. If wellbeing
 * analytics reused the team-admin guard, every platform administrator would
 * silently become a reader of every organisation's wellbeing reporting.
 *
 * So wellbeing roles are granted explicitly, per organisation, in
 * `wellbeing_role_grants`, and `has_wellbeing_role()` contains no
 * `or is_super_admin()` fallback.
 *
 * WHAT NO ROLE HERE CAN DO.
 *
 * Neither role reads an individual wellbeing session, response or result.
 * That capability does not exist anywhere in the schema: the RLS policies on
 * those three tables are `profile_id = auth.uid()` with no disjunction, and
 * the aggregate paths in this module read only through functions that apply
 * cohort suppression first. A wellbeing analyst sees group figures. Nobody
 * sees John Smith = 7/12.
 * ─────────────────────────────────────────────────────────────────────
 */

export type WellbeingRole = "wellbeing_governance" | "wellbeing_analyst";

export interface WellbeingAccess extends AuthContext {
  organizationId: string;
  role: WellbeingRole;
}

export class WellbeingAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WellbeingAccessError";
  }
}

/** Does this caller hold `role` in `organizationId`? */
export async function hasWellbeingRole(
  context: AuthContext,
  organizationId: string,
  role: WellbeingRole,
): Promise<boolean> {
  const { data, error } = await context.supabase.rpc("has_wellbeing_role", {
    org: organizationId,
    required: role,
  });
  // An RPC failure is an infrastructure problem, not a grant. Denying is the
  // only safe reading of "we could not tell".
  if (error) return false;
  return data === true;
}

/**
 * Aggregate analytics scope. Governance implies analyst: a role that sets the
 * confidentiality floor must be able to see what that floor produces.
 */
export async function requireWellbeingAnalyst(organizationId: string): Promise<WellbeingAccess> {
  const context = await requireOnboarded();
  if (await hasWellbeingRole(context, organizationId, "wellbeing_analyst")) {
    return { ...context, organizationId, role: "wellbeing_analyst" };
  }
  if (await hasWellbeingRole(context, organizationId, "wellbeing_governance")) {
    return { ...context, organizationId, role: "wellbeing_governance" };
  }
  throw new WellbeingAccessError("No Wellbeing Pulse analytics access for this organisation");
}

/** Threshold, confidentiality floor, questionnaire version and taxonomy. */
export async function requireWellbeingGovernance(
  organizationId: string,
): Promise<WellbeingAccess> {
  const context = await requireOnboarded();
  if (await hasWellbeingRole(context, organizationId, "wellbeing_governance")) {
    return { ...context, organizationId, role: "wellbeing_governance" };
  }
  throw new WellbeingAccessError("No Wellbeing Pulse governance access for this organisation");
}

export interface WellbeingScopeEntry {
  organizationId: string;
  organizationName: string;
  role: WellbeingRole;
}

/**
 * Every organisation this caller may analyse, resolved from grants they
 * actually hold.
 *
 * Read through the caller's own client, so `wellbeing_role_grants_select`
 * scopes it to their own rows. A service-role read here would have to be
 * filtered in application code, and a filter is exactly the kind of thing that
 * gets refactored away.
 */
export async function resolveWellbeingScope(): Promise<{
  context: AuthContext;
  scope: WellbeingScopeEntry[];
}> {
  const context = await requireOnboarded();
  const { data } = await context.supabase
    .from("wellbeing_role_grants")
    .select("organization_id, role, organizations (name)")
    .eq("profile_id", context.user.id)
    .is("revoked_at", null);

  const scope: WellbeingScopeEntry[] = (data ?? []).map((row) => {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    return {
      organizationId: row.organization_id as string,
      organizationName: (org as { name: string } | null)?.name ?? "Organisation",
      role: row.role as WellbeingRole,
    };
  });

  return { context, scope };
}

/**
 * Grants a wellbeing role.
 *
 * There is no INSERT policy on `wellbeing_role_grants`, so this is the only
 * way a grant can be created — service role, after an explicit platform-admin
 * check, with an audit row. A person cannot grant themselves a role through
 * the API because the API has no path to write the table.
 *
 * Note what a platform admin gains by granting themselves `wellbeing_analyst`:
 * aggregate reporting, subject to cohort suppression. Not one individual row.
 * That is the separation — the ceiling on the role, not the gate in front of it.
 */
export async function grantWellbeingRole(input: {
  actor: AuthContext;
  profileId: string;
  organizationId: string;
  role: WellbeingRole;
  note?: string;
}): Promise<{ ok: boolean; message: string }> {
  if (!input.actor.profile.is_super_admin) {
    return { ok: false, message: "Only a platform administrator can grant a wellbeing role." };
  }

  // Service role: wellbeing_role_grants has no INSERT policy by design.
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("wellbeing_role_grants").insert({
    profile_id: input.profileId,
    organization_id: input.organizationId,
    role: input.role,
    granted_by: input.actor.user.id,
    note: input.note ?? "",
  });
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "That role is already held." : "Could not grant the role.",
    };
  }

  await admin.from("audit_logs").insert({
    actor_id: input.actor.user.id,
    action: "wellbeing.role_granted",
    entity_type: "wellbeing_role_grant",
    entity_id: input.profileId,
    metadata: { organization_id: input.organizationId, role: input.role },
  });

  return { ok: true, message: "Wellbeing role granted." };
}

/** Revokes a role, with the same platform-admin check and audit trail. */
export async function revokeWellbeingRole(input: {
  actor: AuthContext;
  grantId: string;
}): Promise<{ ok: boolean; message: string }> {
  if (!input.actor.profile.is_super_admin) {
    return { ok: false, message: "Only a platform administrator can revoke a wellbeing role." };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("wellbeing_role_grants")
    .update({ revoked_at: new Date().toISOString(), revoked_by: input.actor.user.id })
    .eq("id", input.grantId)
    .is("revoked_at", null);
  if (error) return { ok: false, message: "Could not revoke the role." };

  await admin.from("audit_logs").insert({
    actor_id: input.actor.user.id,
    action: "wellbeing.role_revoked",
    entity_type: "wellbeing_role_grant",
    entity_id: input.grantId,
    metadata: {},
  });

  return { ok: true, message: "Wellbeing role revoked." };
}
