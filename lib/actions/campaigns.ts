"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamAdmin } from "@/lib/auth/guards";
import {
  assertTransition,
  launchStatus,
  type CampaignStatus,
} from "@/lib/campaigns/state";
import {
  sendCampaignInvitation,
  sendCampaignReminder,
} from "@/lib/email/notifications";
import type { ActionState } from "@/lib/actions/teams";

const formatDeadline = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })
    : undefined;

const ok = (message: string): ActionState => ({ status: "success", message });
const fail = (message: string): ActionState => ({ status: "error", message });

const createCampaignSchema = z.object({
  team_id: z.uuid(),
  name: z.string().min(2).max(120),
  invitation_message: z.string().max(1000).optional().or(z.literal("")),
  starts_at: z.string().optional().or(z.literal("")),
  deadline_at: z.string().optional().or(z.literal("")),
});

export async function createCampaign(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createCampaignSchema.safeParse({
    team_id: formData.get("team_id"),
    name: formData.get("name"),
    invitation_message: formData.get("invitation_message"),
    starts_at: formData.get("starts_at"),
    deadline_at: formData.get("deadline_at"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the campaign details.");

  const { supabase, user } = await requireTeamAdmin(parsed.data.team_id);

  const { data: version } = await supabase
    .from("assessment_versions")
    .select("id")
    .eq("is_active", true)
    .single();
  if (!version) return fail("No active assessment version.");

  const { error } = await supabase.from("assessment_campaigns").insert({
    team_id: parsed.data.team_id,
    version_id: version.id,
    name: parsed.data.name,
    invitation_message: parsed.data.invitation_message || "",
    starts_at: parsed.data.starts_at
      ? new Date(parsed.data.starts_at).toISOString()
      : null,
    deadline_at: parsed.data.deadline_at
      ? new Date(parsed.data.deadline_at).toISOString()
      : null,
    created_by: user.id,
  });
  if (error) return fail("Could not create the campaign.");

  revalidatePath(`/app/teams/${parsed.data.team_id}/campaigns`);
  return ok("Campaign created as a draft.");
}

async function loadCampaign(teamId: string, campaignId: string) {
  const context = await requireTeamAdmin(teamId);
  const { data: campaign } = await context.supabase
    .from("assessment_campaigns")
    .select("id, team_id, status")
    .eq("id", campaignId)
    .eq("team_id", teamId)
    .maybeSingle();
  return { context, campaign };
}

/** Launch: draft/scheduled → active (or scheduled if start is future) + assignments. */
export async function launchCampaign(teamId: string, campaignId: string): Promise<void> {
  if (!z.uuid().safeParse(teamId).success || !z.uuid().safeParse(campaignId).success) return;
  const { context, campaign } = await loadCampaign(teamId, campaignId);
  if (!campaign) return;

  const { data: full } = await context.supabase
    .from("assessment_campaigns")
    .select("name, invitation_message, starts_at, deadline_at, teams (name)")
    .eq("id", campaignId)
    .single();
  const next = launchStatus(full?.starts_at ?? null, new Date());
  try {
    assertTransition(campaign.status as CampaignStatus, next);
  } catch {
    return;
  }

  // One assignment per roster member (invited state) + campaign invitation email.
  const teamRow = Array.isArray(full?.teams) ? full?.teams[0] : full?.teams;
  const { data: members } = await context.supabase
    .from("team_members")
    .select("id, email, profile_id")
    .eq("team_id", teamId);
  for (const member of members ?? []) {
    await context.supabase
      .from("campaign_assignments")
      .upsert(
        { campaign_id: campaignId, team_member_id: member.id },
        { onConflict: "campaign_id,team_member_id", ignoreDuplicates: true },
      );
    if (next === "active") {
      await sendCampaignInvitation({
        to: member.email,
        profileId: member.profile_id,
        teamName: teamRow?.name ?? "your team",
        campaignName: full?.name ?? "Assessment round",
        message: full?.invitation_message || undefined,
        deadline: formatDeadline(full?.deadline_at ?? null),
      });
    }
  }

  await context.supabase
    .from("assessment_campaigns")
    .update({ status: next })
    .eq("id", campaignId);
  await context.supabase.from("audit_logs").insert({
    actor_id: context.user.id,
    action: "campaign.launched",
    entity_type: "assessment_campaign",
    entity_id: campaignId,
  });
  revalidatePath(`/app/teams/${teamId}/campaigns`);
}

async function transitionCampaign(
  teamId: string,
  campaignId: string,
  to: CampaignStatus,
  auditAction: string,
): Promise<void> {
  if (!z.uuid().safeParse(teamId).success || !z.uuid().safeParse(campaignId).success) return;
  const { context, campaign } = await loadCampaign(teamId, campaignId);
  if (!campaign) return;
  try {
    assertTransition(campaign.status as CampaignStatus, to);
  } catch {
    return;
  }
  await context.supabase
    .from("assessment_campaigns")
    .update({
      status: to,
      ...(to === "archived" ? { archived_at: new Date().toISOString() } : {}),
    })
    .eq("id", campaignId);
  await context.supabase.from("audit_logs").insert({
    actor_id: context.user.id,
    action: auditAction,
    entity_type: "assessment_campaign",
    entity_id: campaignId,
  });
  revalidatePath(`/app/teams/${teamId}/campaigns`);
}

export async function closeCampaign(teamId: string, campaignId: string): Promise<void> {
  await transitionCampaign(teamId, campaignId, "closed", "campaign.closed");
}

export async function reopenCampaign(teamId: string, campaignId: string): Promise<void> {
  await transitionCampaign(teamId, campaignId, "active", "campaign.reopened");
}

export async function archiveCampaign(teamId: string, campaignId: string): Promise<void> {
  await transitionCampaign(teamId, campaignId, "archived", "campaign.archived");
}

/** Reminders for everyone who hasn't completed — preference-gated per recipient. */
export async function sendCampaignReminders(teamId: string, campaignId: string): Promise<void> {
  if (!z.uuid().safeParse(teamId).success || !z.uuid().safeParse(campaignId).success) return;
  const { context, campaign } = await loadCampaign(teamId, campaignId);
  if (!campaign || campaign.status !== "active") return;

  const { data: pendingAssignments } = await context.supabase
    .from("campaign_assignments")
    .select("id, team_members (email, profile_id, teams (name)), assessment_campaigns (deadline_at)")
    .eq("campaign_id", campaignId)
    .neq("status", "completed");

  for (const assignment of pendingAssignments ?? []) {
    const member = Array.isArray(assignment.team_members)
      ? assignment.team_members[0]
      : assignment.team_members;
    if (!member) continue;
    const team = Array.isArray(member.teams) ? member.teams[0] : member.teams;
    const campaignRow = Array.isArray(assignment.assessment_campaigns)
      ? assignment.assessment_campaigns[0]
      : assignment.assessment_campaigns;
    await sendCampaignReminder({
      to: member.email,
      profileId: member.profile_id,
      teamName: team?.name ?? "your team",
      deadline: formatDeadline(campaignRow?.deadline_at ?? null),
    });
  }

  await context.supabase
    .from("campaign_assignments")
    .update({ reminded_at: new Date().toISOString() })
    .eq("campaign_id", campaignId)
    .neq("status", "completed");

  await context.supabase.from("audit_logs").insert({
    actor_id: context.user.id,
    action: "campaign.reminders_sent",
    entity_type: "assessment_campaign",
    entity_id: campaignId,
  });
  revalidatePath(`/app/teams/${teamId}/campaigns`);
}
