"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import {
  LIFECYCLE_CONFIRMATION,
  lifecycleOf,
  resultOf,
  statusValueOf,
  type LifecycleAction,
} from "@/lib/wellbeing/campaign-lifecycle";

/**
 * Wellbeing Pulse — campaign lifecycle operations.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THIS FIXES.
 *
 * A facilitator in production was shown "Joining is switched off" with no
 * control to switch it on, because the panel read `teams.join_enabled` — a
 * DISC invitation flag that is false on every wellbeing roster by design.
 * There was no lifecycle control at all: campaigns could be created and never
 * paused, closed or reopened from the product.
 *
 * NOTHING HERE DELETES A RESPONSE.
 *
 * Every operation below is an UPDATE of `wellbeing_campaigns.status` and its
 * timestamps, plus — for archival only — `teams.archived_at`, which is what
 * takes a campaign off the working list. No statement in this file touches
 * `wellbeing_sessions`, `wellbeing_responses` or `wellbeing_results`.
 * `lib/wellbeing/campaign-lifecycle.test.ts` reads this file and asserts it,
 * so a future edit that adds one fails the suite rather than a participant.
 *
 * WHY THE TRANSITION IS RE-DERIVED SERVER-SIDE.
 *
 * The client submits an ACTION ("pause"), never a target state. The current
 * state is re-read here and `resultOf()` decides whether that action is
 * offered from it, so a stale page whose buttons describe a state the campaign
 * has since left cannot drive it into an unintended one — and no request body
 * can name `archived` directly.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface CampaignActionResult {
  ok: boolean;
  message: string;
}

const schema = z.object({
  teamId: z.uuid(),
  action: z.enum(["open", "pause", "resume", "close", "reopen", "archive"]),
});

export async function setCampaignLifecycleAction(
  formData: FormData,
): Promise<CampaignActionResult> {
  const parsed = schema.safeParse({
    teamId: formData.get("team_id"),
    action: formData.get("lifecycle_action"),
  });
  if (!parsed.success) {
    return { ok: false, message: "That change could not be applied." };
  }
  const { teamId, action } = parsed.data;

  // Running a campaign is team administration. Reading its figures is a
  // separate wellbeing role and is not required to pause or close.
  const context = await requireTeamAdmin(teamId);

  const admin = createSupabaseAdminClient();
  const { data: campaign } = await admin
    .from("wellbeing_campaigns")
    .select("id, status, organization_id")
    .eq("team_id", teamId)
    .maybeSingle();

  if (!campaign) {
    return {
      ok: false,
      message: "This campaign has no join route to open or close.",
    };
  }

  const current = lifecycleOf(campaign.status as string);
  const next = resultOf(current, action as LifecycleAction);
  if (!next) {
    // The page was showing a state the campaign has since left. Say what is
    // true now rather than pretending the click worked.
    return {
      ok: false,
      message: "This campaign has already moved on. Reload the page to see its current state.",
    };
  }

  const now = new Date().toISOString();
  const patch: {
    status: ReturnType<typeof statusValueOf>;
    opened_at?: string | null;
    paused_at?: string | null;
    closed_at?: string | null;
  } = { status: statusValueOf(next) };

  // Timestamps are set from the transition, not from the destination: opening
  // and resuming both land on `open`, and both are moments worth recording.
  if (next === "open") {
    patch.opened_at = now;
    patch.paused_at = null;
    // Cleared so a reopened campaign does not display a closing date it has
    // since reversed. The closure itself stays in `audit_logs`.
    patch.closed_at = null;
  }
  if (next === "paused") patch.paused_at = now;
  if (next === "closed") patch.closed_at = now;

  const { error } = await admin
    .from("wellbeing_campaigns")
    .update(patch)
    .eq("id", campaign.id);

  if (error) {
    return { ok: false, message: "That change could not be saved. Please try again." };
  }

  // Archival is the one transition that also touches the roster: `archived_at`
  // is what removes a campaign from every working list in the product.
  if (next === "archived") {
    await admin.from("teams").update({ archived_at: now }).eq("id", teamId);
  } else {
    await admin.from("teams").update({ archived_at: null }).eq("id", teamId);
  }

  await admin.from("audit_logs").insert({
    actor_id: context.user.id,
    action: `wellbeing.campaign_${action}`,
    entity_type: "wellbeing_campaign",
    entity_id: campaign.id,
    // Structural only. No join token, no participant, no figure.
    metadata: { from: current, to: next, team_id: teamId },
  });

  revalidatePath(`/wellbeing/admin/campaigns/${teamId}`);
  revalidatePath(`/wellbeing/admin/campaigns/${teamId}/settings`);
  revalidatePath("/wellbeing/admin/campaigns");
  revalidatePath("/wellbeing/admin/pilot");

  return { ok: true, message: LIFECYCLE_CONFIRMATION[action as LifecycleAction] };
}
