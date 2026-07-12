import "server-only";
import type { AuthContext } from "@/lib/auth/guards";

export interface TeamEntitlement {
  /** Whether the user may open the create-team form right now. */
  allowed: boolean;
  /** Unused entitlement to consume on creation (null for super admins). */
  entitlementId: string | null;
  isSuperAdmin: boolean;
}

/**
 * Team creation entitlement:
 * - super_admin: always allowed, nothing consumed
 * - anyone else: requires an unused active 'team' entitlement (the $8 plan)
 */
export async function getTeamEntitlement(
  context: AuthContext,
): Promise<TeamEntitlement> {
  if (context.profile.is_super_admin) {
    return { allowed: true, entitlementId: null, isSuperAdmin: true };
  }

  const { data: entitlement } = await context.supabase
    .from("entitlements")
    .select("id")
    .eq("purchaser_id", context.user.id)
    .eq("product", "team")
    .eq("status", "active")
    .is("team_id", null)
    .order("purchased_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    allowed: Boolean(entitlement),
    entitlementId: entitlement?.id ?? null,
    isSuperAdmin: false,
  };
}

/** Marks an entitlement consumed by a newly created team (owner-scoped RLS). */
export async function consumeEntitlement(
  context: AuthContext,
  entitlementId: string,
  teamId: string,
): Promise<void> {
  // Service role: entitlement writes are server-controlled; ownership and
  // unused-status are re-checked in the update predicate.
  const { createSupabaseAdminClient } = await import("@/lib/db/admin");
  const admin = createSupabaseAdminClient();
  await admin
    .from("entitlements")
    .update({ status: "consumed", team_id: teamId })
    .eq("id", entitlementId)
    .eq("purchaser_id", context.user.id)
    .eq("status", "active");
}
