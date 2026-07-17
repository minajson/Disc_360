"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboarded, requireTeamAdmin } from "@/lib/auth/guards";
import { parseMemberCsv } from "@/lib/teams/csv";
import {
  sendCampaignReminder,
  sendTeamInvitation,
} from "@/lib/email/notifications";

async function inviteAndNotify(options: {
  supabase: Awaited<ReturnType<typeof requireTeamAdmin>>["supabase"];
  teamId: string;
  memberId: string;
  email: string;
  invitedBy: string;
  inviterName: string;
}): Promise<void> {
  const { data: invitation } = await options.supabase
    .from("invitations")
    .insert({
      team_id: options.teamId,
      team_member_id: options.memberId,
      email: options.email,
      invited_by: options.invitedBy,
    })
    .select("token, teams (name)")
    .single();
  if (!invitation) return;
  const team = Array.isArray(invitation.teams) ? invitation.teams[0] : invitation.teams;
  await sendTeamInvitation({
    to: options.email,
    teamName: team?.name ?? "your team",
    inviterName: options.inviterName,
    token: invitation.token,
  });
}

export interface ActionState {
  status: "idle" | "success" | "error";
  message: string;
}

const ok = (message = "Saved."): ActionState => ({ status: "success", message });
const fail = (message: string): ActionState => ({ status: "error", message });

function generateTeamCode(name: string): string {
  const stem = name.replace(/[^a-zA-Z]/g, "").slice(0, 5).toUpperCase() || "TEAM";
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${stem}-${digits}`;
}

/* ── create team from the wizard draft ───────────────────────────────── */

/**
 * The single creation path used by the /app/teams/new wizard.
 *
 * Everything it needs is already on the draft — the user typed it once, in the
 * wizard, and it has survived sign-in and payment. Nothing is re-asked and
 * nothing is read from the client beyond the draft id, whose ownership the
 * database re-checks.
 */
export async function createTeamFromDraft(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const draftId = z.uuid().safeParse(formData.get("draft_id"));
  if (!draftId.success) {
    return fail("That draft is no longer available — start a new team.");
  }

  const context = await requireOnboarded();
  const { supabase, user, profile } = context;

  const { getTeamEntitlement, consumeEntitlement } = await import(
    "@/lib/payments/entitlements"
  );
  const entitlement = await getTeamEntitlement(context);
  if (!entitlement.allowed) redirect("/pricing?intent=create-team");

  /*
   * Claim the draft before creating anything. The status transition
   * draft → completed is conditional on the row still being 'draft', so it
   * acts as a mutex: a double-clicked "Create team" runs this twice, the
   * second call matches zero rows, and exactly one team is created.
   */
  const { data: draft } = await supabase
    .from("team_creation_drafts")
    .update({ status: "completed" })
    .eq("id", draftId.data)
    .eq("owner_profile_id", user.id)
    .eq("status", "draft")
    .select(
      "organization_name, team_name, session_name, department, approximate_size, timezone, deadline_at, results_named, members_can_view_summary, participant_limit",
    )
    .maybeSingle();

  if (!draft) {
    return fail(
      "This team has already been created — open My Teams to find it.",
    );
  }

  if (draft.team_name.trim().length < 2 || draft.organization_name.trim().length < 2) {
    return fail("Add a team name and organization before creating the team.");
  }

  // Reuse an organization this person already administers under the same
  // name, so a second team never spawns a duplicate org.
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, organizations (id, name)")
    .eq("profile_id", user.id)
    .in("role", ["organization_admin", "coach"]);

  let organizationId: string | null = null;
  for (const row of memberships ?? []) {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    if (
      org &&
      org.name.trim().toLowerCase() === draft.organization_name.trim().toLowerCase()
    ) {
      organizationId = org.id;
      break;
    }
  }

  if (!organizationId) {
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ name: draft.organization_name.trim(), created_by: user.id })
      .select("id")
      .single();
    if (orgError || !org) return fail("Could not create the organization.");
    const { error: memberError } = await supabase.from("organization_members").insert({
      organization_id: org.id,
      profile_id: user.id,
      role: "organization_admin",
    });
    if (memberError) return fail("Could not attach you to the organization.");
    organizationId = org.id;
  }

  const { data: team, error } = await supabase
    .from("teams")
    .insert({
      organization_id: organizationId,
      name: draft.team_name.trim(),
      session_name: draft.session_name || null,
      description: "",
      department: draft.department || null,
      timezone: draft.timezone || null,
      approx_size: draft.approximate_size ?? null,
      results_named: draft.results_named,
      members_can_view_summary: draft.members_can_view_summary,
      deadline_at: draft.deadline_at,
      team_code: generateTeamCode(draft.team_name),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !team) {
    // Release the draft so the user can retry without retyping anything.
    await supabase
      .from("team_creation_drafts")
      .update({ status: "draft" })
      .eq("id", draftId.data)
      .eq("owner_profile_id", user.id);
    return fail("Could not create the team — please try again.");
  }

  await supabase.from("team_members").insert({
    team_id: team.id,
    profile_id: user.id,
    display_name: profile.full_name,
    email: profile.email,
    department: draft.department || null,
    role: "team_admin",
  });

  if (entitlement.entitlementId) {
    await consumeEntitlement(context, entitlement.entitlementId, team.id);
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "team.created",
    entity_type: "team",
    entity_id: team.id,
    metadata: { entitlement_id: entitlement.entitlementId, source: "wizard" },
  });

  redirect(`/app/teams/${team.id}/dashboard`);
}

/* ── team settings ───────────────────────────────────────────────────── */

const settingsSchema = z.object({
  team_id: z.uuid(),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().or(z.literal("")),
  department: z.string().max(120).optional().or(z.literal("")),
  timezone: z.string().max(80).optional().or(z.literal("")),
  logo_url: z.url().optional().or(z.literal("")),
  cover_path: z.string().max(300).optional().or(z.literal("")),
  results_named: z.enum(["named", "anonymized"]),
  members_can_view_summary: z.string().optional(),
  deadline_at: z.string().optional().or(z.literal("")),
});

export async function updateTeamSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = settingsSchema.safeParse({
    team_id: formData.get("team_id"),
    name: formData.get("name"),
    description: formData.get("description"),
    department: formData.get("department"),
    timezone: formData.get("timezone"),
    logo_url: formData.get("logo_url"),
    cover_path: formData.get("cover_path"),
    results_named: formData.get("results_named"),
    members_can_view_summary: formData.get("members_can_view_summary") ?? undefined,
    deadline_at: formData.get("deadline_at"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the settings.");

  const { supabase } = await requireTeamAdmin(parsed.data.team_id);

  const { error } = await supabase
    .from("teams")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || "",
      department: parsed.data.department || null,
      timezone: parsed.data.timezone || null,
      logo_url: parsed.data.logo_url || null,
      cover_path: parsed.data.cover_path || null,
      results_named: parsed.data.results_named === "named",
      members_can_view_summary: parsed.data.members_can_view_summary === "on",
      deadline_at: parsed.data.deadline_at
        ? new Date(parsed.data.deadline_at).toISOString()
        : null,
    })
    .eq("id", parsed.data.team_id);
  if (error) return fail("Could not save team settings.");

  revalidatePath(`/app/teams/${parsed.data.team_id}`, "layout");
  return ok("Team settings saved.");
}

export async function archiveTeam(teamId: string): Promise<void> {
  if (!z.uuid().safeParse(teamId).success) return;
  const { supabase, user } = await requireTeamAdmin(teamId);
  await supabase
    .from("teams")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", teamId);
  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "team.archived",
    entity_type: "team",
    entity_id: teamId,
  });
  redirect("/app/teams");
}

export async function rotateInviteLink(teamId: string): Promise<void> {
  if (!z.uuid().safeParse(teamId).success) return;
  const { supabase, user } = await requireTeamAdmin(teamId);
  await supabase
    .from("teams")
    .update({ invite_token: crypto.randomUUID() })
    .eq("id", teamId);
  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "team.invite_link_rotated",
    entity_type: "team",
    entity_id: teamId,
  });
  revalidatePath(`/app/teams/${teamId}/dashboard`);
}

/* ── members ─────────────────────────────────────────────────────────── */

const addMemberSchema = z.object({
  team_id: z.uuid(),
  display_name: z.string().min(2).max(120),
  email: z.email(),
  department: z.string().max(120).optional().or(z.literal("")),
});

export async function addMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addMemberSchema.safeParse({
    team_id: formData.get("team_id"),
    display_name: formData.get("display_name"),
    email: formData.get("email"),
    department: formData.get("department"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the member details.");

  const { supabase, user, profile } = await requireTeamAdmin(parsed.data.team_id);
  const email = parsed.data.email.toLowerCase();

  const { data: member, error } = await supabase
    .from("team_members")
    .insert({
      team_id: parsed.data.team_id,
      display_name: parsed.data.display_name,
      email,
      department: parsed.data.department || null,
    })
    .select("id")
    .single();
  if (error) {
    return fail(
      error.code === "23505"
        ? "That email is already on the roster."
        : "Could not add the member.",
    );
  }

  await inviteAndNotify({
    supabase,
    teamId: parsed.data.team_id,
    memberId: member.id,
    email,
    invitedBy: user.id,
    inviterName: profile.full_name,
  });

  revalidatePath(`/app/teams/${parsed.data.team_id}/dashboard`);
  return ok(`${parsed.data.display_name} added and invited.`);
}

const importSchema = z.object({ team_id: z.uuid(), csv: z.string().min(3).max(100_000) });

export async function importMembers(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = importSchema.safeParse({
    team_id: formData.get("team_id"),
    csv: formData.get("csv"),
  });
  if (!parsed.success) return fail("Paste rows as: name, email, department (optional).");

  const { supabase, user, profile } = await requireTeamAdmin(parsed.data.team_id);
  const { rows, errors } = parseMemberCsv(parsed.data.csv);
  if (rows.length === 0) return fail(errors[0] ?? "No valid rows found.");
  if (rows.length > 200) return fail("Import at most 200 members at a time.");

  let added = 0;
  let skipped = 0;
  for (const row of rows) {
    const { data: member, error } = await supabase
      .from("team_members")
      .insert({ team_id: parsed.data.team_id, ...row })
      .select("id")
      .single();
    if (error) {
      skipped += 1;
      continue;
    }
    added += 1;
    await inviteAndNotify({
      supabase,
      teamId: parsed.data.team_id,
      memberId: member.id,
      email: row.email,
      invitedBy: user.id,
      inviterName: profile.full_name,
    });
  }

  revalidatePath(`/app/teams/${parsed.data.team_id}/dashboard`);
  return ok(
    `Imported ${added} member${added === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}` : ""}${errors.length ? `, ${errors.length} invalid line${errors.length === 1 ? "" : "s"}` : ""}.`,
  );
}

const updateMemberSchema = z.object({
  team_id: z.uuid(),
  member_id: z.uuid(),
  display_name: z.string().min(2).max(120),
  department: z.string().max(120).optional().or(z.literal("")),
  role: z.enum(["member", "team_admin"]),
});

export async function updateMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateMemberSchema.safeParse({
    team_id: formData.get("team_id"),
    member_id: formData.get("member_id"),
    display_name: formData.get("display_name"),
    department: formData.get("department"),
    role: formData.get("role"),
  });
  if (!parsed.success) return fail("Check the member details.");

  const { supabase } = await requireTeamAdmin(parsed.data.team_id);
  const { error } = await supabase
    .from("team_members")
    .update({
      display_name: parsed.data.display_name,
      department: parsed.data.department || null,
      role: parsed.data.role,
    })
    .eq("id", parsed.data.member_id)
    .eq("team_id", parsed.data.team_id);
  if (error) return fail("Could not update the member.");

  revalidatePath(`/app/teams/${parsed.data.team_id}/dashboard`);
  return ok("Member updated.");
}

export async function removeMember(teamId: string, memberId: string): Promise<void> {
  if (!z.uuid().safeParse(teamId).success || !z.uuid().safeParse(memberId).success) return;
  const { supabase, user } = await requireTeamAdmin(teamId);

  // The last admin cannot be removed.
  const { data: target } = await supabase
    .from("team_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!target) return;
  if (target.role === "team_admin") {
    const { count } = await supabase
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("role", "team_admin");
    if ((count ?? 0) <= 1) return;
  }

  await supabase.from("team_members").delete().eq("id", memberId).eq("team_id", teamId);
  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "team.member_removed",
    entity_type: "team_member",
    entity_id: memberId,
    metadata: { team_id: teamId },
  });
  revalidatePath(`/app/teams/${teamId}/dashboard`);
}

/* ── invitations ─────────────────────────────────────────────────────── */

const RESEND_MIN_INTERVAL_MS = 2 * 60 * 1000;
const RESEND_MAX_SENDS = 5;

export async function resendInvitation(teamId: string, invitationId: string): Promise<void> {
  if (!z.uuid().safeParse(teamId).success || !z.uuid().safeParse(invitationId).success) return;
  const { supabase, profile } = await requireTeamAdmin(teamId);

  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, status, last_sent_at, send_count, email, token, message, teams (name)")
    .eq("id", invitationId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!invitation || invitation.status !== "pending") return;

  // Rate limiting: bounded sends with a minimum interval.
  if (invitation.send_count >= RESEND_MAX_SENDS) return;
  if (Date.now() - new Date(invitation.last_sent_at).getTime() < RESEND_MIN_INTERVAL_MS) return;

  await supabase
    .from("invitations")
    .update({
      last_sent_at: new Date().toISOString(),
      send_count: invitation.send_count + 1,
      expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    })
    .eq("id", invitationId);

  const team = Array.isArray(invitation.teams) ? invitation.teams[0] : invitation.teams;
  await sendTeamInvitation({
    to: invitation.email,
    teamName: team?.name ?? "your team",
    inviterName: profile.full_name,
    token: invitation.token,
    message: invitation.message ?? undefined,
  });

  revalidatePath(`/app/teams/${teamId}/dashboard`);
}

/**
 * One-click nudge for everyone who hasn't completed: unclaimed roster
 * entries get their invitation resent; claimed-but-incomplete members get
 * a reminder email (preference-gated).
 */
export async function sendReminderToPending(teamId: string): Promise<void> {
  if (!z.uuid().safeParse(teamId).success) return;
  const { supabase, user, profile } = await requireTeamAdmin(teamId);

  const { data: team } = await supabase
    .from("teams")
    .select("name, deadline_at")
    .eq("id", teamId)
    .single();
  if (!team) return;

  const deadline = team.deadline_at
    ? new Date(team.deadline_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })
    : undefined;

  // Roster with result state — service role via the roster module's caller
  // is unnecessary here: admins can read members; results state comes from
  // notification of completion instead. Use members + own-team invitations.
  const { data: members } = await supabase
    .from("team_members")
    .select("id, email, profile_id, display_name")
    .eq("team_id", teamId);

  // Which members already completed (service role: cross-member result
  // existence check only — no scores are read).
  const { createSupabaseAdminClient } = await import("@/lib/db/admin");
  const admin = createSupabaseAdminClient();
  const profileIds = (members ?? [])
    .map((m) => m.profile_id)
    .filter((id): id is string => Boolean(id));
  const { data: completedRows } = profileIds.length
    ? await admin
        .from("assessment_results")
        .select("profile_id")
        .in("profile_id", profileIds)
    : { data: [] as { profile_id: string }[] };
  const completedProfiles = new Set((completedRows ?? []).map((r) => r.profile_id));

  for (const member of members ?? []) {
    if (member.profile_id && completedProfiles.has(member.profile_id)) continue;

    if (member.profile_id) {
      await sendCampaignReminder({
        to: member.email,
        profileId: member.profile_id,
        teamName: team.name,
        deadline,
      });
    } else {
      // Unclaimed: refresh + resend their pending invitation.
      const { data: invitation } = await supabase
        .from("invitations")
        .select("id, token, send_count, status")
        .eq("team_id", teamId)
        .eq("email", member.email)
        .eq("status", "pending")
        .maybeSingle();
      if (invitation && invitation.send_count < RESEND_MAX_SENDS) {
        await supabase
          .from("invitations")
          .update({
            last_sent_at: new Date().toISOString(),
            send_count: invitation.send_count + 1,
            expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
          })
          .eq("id", invitation.id);
        await sendTeamInvitation({
          to: member.email,
          teamName: team.name,
          inviterName: profile.full_name,
          token: invitation.token,
        });
      }
    }
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "team.reminders_sent",
    entity_type: "team",
    entity_id: teamId,
  });
  revalidatePath(`/app/teams/${teamId}/dashboard`);
}

export async function revokeInvitation(teamId: string, invitationId: string): Promise<void> {
  if (!z.uuid().safeParse(teamId).success || !z.uuid().safeParse(invitationId).success) return;
  const { supabase } = await requireTeamAdmin(teamId);
  await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("team_id", teamId)
    .eq("status", "pending");
  revalidatePath(`/app/teams/${teamId}/dashboard`);
}
