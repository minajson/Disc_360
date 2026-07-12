"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { sendReportReady } from "@/lib/email/notifications";
import { insightMap } from "@/data/insight-maps";
import type { ArchetypeCode } from "@/lib/types";

/**
 * Platform-admin actions. Every function begins with requireSuperAdmin();
 * the service role is justified throughout — cross-tenant administration is
 * this module's purpose. Every mutation is audit-logged.
 */

async function audit(actorId: string, action: string, entityType: string, entityId: string) {
  const admin = createSupabaseAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
  });
}

export async function toggleSuperAdmin(userId: string): Promise<void> {
  if (!z.uuid().safeParse(userId).success) return;
  const { user } = await requireSuperAdmin();
  if (userId === user.id) return; // never demote yourself by accident
  const admin = createSupabaseAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return;
  await admin
    .from("profiles")
    .update({ is_super_admin: !target.is_super_admin })
    .eq("id", userId);
  await audit(user.id, target.is_super_admin ? "admin.role_revoked" : "admin.role_granted", "profile", userId);
  revalidatePath("/admin/users");
}

export async function grantTeamEntitlement(userId: string): Promise<void> {
  if (!z.uuid().safeParse(userId).success) return;
  const { user } = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();
  await admin.from("entitlements").insert({
    purchaser_id: userId,
    product: "team",
    amount_cents: 0,
    status: "active",
    simulated: true,
  });
  await audit(user.id, "admin.entitlement_granted", "profile", userId);
  revalidatePath("/admin/users");
  revalidatePath("/admin/payments");
}

export async function revokeEntitlement(entitlementId: string): Promise<void> {
  if (!z.uuid().safeParse(entitlementId).success) return;
  const { user } = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();
  await admin
    .from("entitlements")
    .update({ status: "revoked" })
    .eq("id", entitlementId)
    .eq("status", "active");
  await audit(user.id, "admin.entitlement_revoked", "entitlement", entitlementId);
  revalidatePath("/admin/users");
  revalidatePath("/admin/payments");
}

export async function setUserActive(userId: string, active: boolean): Promise<void> {
  if (!z.uuid().safeParse(userId).success) return;
  const { user } = await requireSuperAdmin();
  if (userId === user.id) return;
  const admin = createSupabaseAdminClient();
  await admin
    .from("profiles")
    .update({ deactivated_at: active ? null : new Date().toISOString() })
    .eq("id", userId);
  await audit(user.id, active ? "admin.user_reactivated" : "admin.user_deactivated", "profile", userId);
  revalidatePath("/admin/users");
}

export async function archiveTeamAsAdmin(teamId: string): Promise<void> {
  if (!z.uuid().safeParse(teamId).success) return;
  const { user } = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();
  await admin
    .from("teams")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", teamId);
  await audit(user.id, "admin.team_archived", "team", teamId);
  revalidatePath("/admin/teams");
}

const createTeamForUserSchema = z.object({
  user_id: z.uuid(),
  team_name: z.string().min(2).max(120),
  organization_name: z.string().min(2).max(120),
});

export interface AdminActionState {
  status: "idle" | "success" | "error";
  message: string;
}

/** Creates a team on behalf of a user, with them as team admin. */
export async function createTeamForUser(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = createTeamForUserSchema.safeParse({
    user_id: formData.get("user_id"),
    team_name: formData.get("team_name"),
    organization_name: formData.get("organization_name"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Check the team and organization names." };
  }
  const { user } = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", parsed.data.user_id)
    .maybeSingle();
  if (!target) return { status: "error", message: "User not found." };

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: parsed.data.organization_name, created_by: target.id })
    .select("id")
    .single();
  if (orgError || !org) return { status: "error", message: "Could not create the organization." };

  await admin.from("organization_members").insert({
    organization_id: org.id,
    profile_id: target.id,
    role: "organization_admin",
  });

  const stem = parsed.data.team_name.replace(/[^a-zA-Z]/g, "").slice(0, 5).toUpperCase() || "TEAM";
  const { data: team, error: teamError } = await admin
    .from("teams")
    .insert({
      organization_id: org.id,
      name: parsed.data.team_name,
      team_code: `${stem}-${Math.floor(1000 + Math.random() * 9000)}`,
      created_by: target.id,
    })
    .select("id")
    .single();
  if (teamError || !team) return { status: "error", message: "Could not create the team." };

  await admin.from("team_members").insert({
    team_id: team.id,
    profile_id: target.id,
    display_name: target.full_name,
    email: target.email,
    role: "team_admin",
  });

  await admin.from("entitlements").insert({
    purchaser_id: target.id,
    product: "team",
    amount_cents: 0,
    status: "consumed",
    team_id: team.id,
    simulated: true,
  });

  await audit(user.id, "admin.team_created_for_user", "team", team.id);
  revalidatePath("/admin/teams");
  return { status: "success", message: `Team created for ${target.email}.` };
}

/** Resend the report email for a submission — to its owner only. */
export async function resendReportEmail(resultId: string): Promise<void> {
  if (!z.uuid().safeParse(resultId).success) return;
  const { user } = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();
  const { data: result } = await admin
    .from("assessment_results")
    .select("id, archetype_code, profile_id, profiles (email)")
    .eq("id", resultId)
    .maybeSingle();
  if (!result) return;
  const profileRow = Array.isArray(result.profiles) ? result.profiles[0] : result.profiles;
  if (!profileRow?.email) return;

  await sendReportReady({
    to: profileRow.email,
    profileId: result.profile_id,
    archetypeName: insightMap[result.archetype_code as ArchetypeCode].name,
    resultId: result.id,
  });
  await audit(user.id, "admin.report_resent", "assessment_result", resultId);
  revalidatePath("/admin/submissions");
  revalidatePath("/admin/emails");
}
