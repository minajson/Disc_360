"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import {
  canTransition,
  type PresentationAccess,
  type SessionMode,
  type SessionState,
} from "@/lib/teams/session";

export interface SessionActionState {
  status: "idle" | "ok" | "error" | "needs_confirmation";
  message: string;
}

const setupSchema = z.object({
  assessment_type: z.enum(["disc", "focus", "combined"]),
  session_mode: z.enum(["self_paced", "facilitator_led"]),
  presentation_access: z.enum(["live_only", "live_and_review", "review_after_session"]),
  facilitator_name: z.string().max(120).optional().or(z.literal("")),
  confirm_change: z.string().optional(),
});

/** True when any roster member has begun answering anything for this team. */
async function teamHasResponses(teamId: string): Promise<boolean> {
  // Service role after the admin guard: counting activity across roster
  // members requires cross-profile reads that RLS rightly forbids.
  const admin = createSupabaseAdminClient();
  const { data: members } = await admin
    .from("team_members")
    .select("profile_id")
    .eq("team_id", teamId)
    .not("profile_id", "is", null);
  const ids = (members ?? []).map((m) => m.profile_id as string);
  if (!ids.length) return false;

  const [a, f, c] = await Promise.all([
    admin.from("assessment_sessions").select("id", { count: "exact", head: true }).in("profile_id", ids),
    admin.from("focus_sessions").select("id", { count: "exact", head: true }).in("profile_id", ids),
    admin.from("combined_sessions").select("id", { count: "exact", head: true }).in("profile_id", ids),
  ]);
  return (a.count ?? 0) + (f.count ?? 0) + (c.count ?? 0) > 0;
}

/**
 * Session setup (assessment · delivery mode · presentation access).
 * Changing the assessment after responses exist requires explicit
 * confirmation — the coach is warned instead of silently mixing datasets.
 */
export async function updateSessionSetup(
  teamId: string,
  _prev: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  const { supabase } = await requireTeamAdmin(teamId);
  const parsed = setupSchema.safeParse({
    assessment_type: formData.get("assessment_type"),
    session_mode: formData.get("session_mode"),
    presentation_access: formData.get("presentation_access"),
    facilitator_name: formData.get("facilitator_name") ?? "",
    confirm_change: formData.get("confirm_change") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: "Choose an option for every session setting." };
  }
  const input = parsed.data;

  const { data: team } = await supabase
    .from("teams")
    .select("assessment_type")
    .eq("id", teamId)
    .single();
  if (!team) return { status: "error", message: "Team not found." };

  if (team.assessment_type !== input.assessment_type) {
    const hasResponses = await teamHasResponses(teamId);
    if (hasResponses && input.confirm_change !== "yes") {
      return {
        status: "needs_confirmation",
        message:
          "Participants have already started responding. Changing the assessment now starts a different instrument for everyone — existing responses stay stored but won't appear in this session. Confirm to change anyway.",
      };
    }
  }

  const { error } = await supabase
    .from("teams")
    .update({
      assessment_type: input.assessment_type,
      session_mode: input.session_mode as SessionMode,
      presentation_access: input.presentation_access as PresentationAccess,
      facilitator_name: input.facilitator_name?.trim() || null,
    })
    .eq("id", teamId);
  if (error) return { status: "error", message: "Could not save session setup — try again." };

  revalidatePath(`/app/teams/${teamId}/settings`);
  revalidatePath(`/app/teams/${teamId}/dashboard`);
  return { status: "ok", message: "Session setup saved." };
}

/** Coach moves the session to the next state (validated transition). */
export async function setSessionState(
  teamId: string,
  next: SessionState,
): Promise<SessionActionState> {
  const { supabase } = await requireTeamAdmin(teamId);
  const { data: team } = await supabase
    .from("teams")
    .select("session_state")
    .eq("id", teamId)
    .single();
  if (!team) return { status: "error", message: "Team not found." };

  const current = team.session_state as SessionState;
  if (!canTransition(current, next)) {
    return { status: "error", message: `Can't move from ${current} to ${next}.` };
  }

  const { error } = await supabase
    .from("teams")
    .update({
      session_state: next,
      // Entering the presentation always starts at slide one.
      ...(next === "presentation" ? { active_slide: 0 } : {}),
    })
    .eq("id", teamId);
  if (error) return { status: "error", message: "Could not update the session — try again." };

  revalidatePath(`/app/teams/${teamId}/dashboard`);
  revalidatePath(`/app/teams/${teamId}/settings`);
  revalidatePath("/app");
  return { status: "ok", message: "Session updated." };
}

/** The facilitator's deck reports its current slide for live followers. */
export async function setActiveSlide(teamId: string, index: number): Promise<void> {
  const { supabase } = await requireTeamAdmin(teamId);
  const clamped = Math.max(0, Math.min(60, Math.round(index)));
  await supabase.from("teams").update({ active_slide: clamped }).eq("id", teamId);
}
