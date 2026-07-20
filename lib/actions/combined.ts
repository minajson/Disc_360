"use server";

import { redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { requireProductAllowed } from "@/lib/teams/session-guard";

/**
 * Combined assessment orchestration.
 *
 * A combined_session links one DISC session and one Focus session. The
 * controller (app/(present)/combined/assessment) advances through them; the
 * DISC and Focus runners are reused unchanged, and their submit actions return
 * to the controller when their session belongs to a combined_session.
 */

/**
 * Start (or resume) the combined flow, then hand off to the controller.
 * The combined attempt binds to the authorized team; its DISC and Focus
 * child sessions inherit that binding in the controller.
 */
export async function startCombinedAssessment(formData?: FormData): Promise<void> {
  const requestedTeam = (formData?.get("team_id") as string | null) || null;
  // Backend lock: facilitator-led participants can only start the
  // assessment their facilitator selected, while its window is open.
  const { context, teamId } = await requireProductAllowed("combined", requestedTeam);
  const { supabase, user } = context;

  let resumeQuery = supabase
    .from("combined_sessions")
    .select("id")
    .eq("profile_id", user.id)
    .eq("status", "in_progress");
  resumeQuery = teamId ? resumeQuery.eq("team_id", teamId) : resumeQuery.is("team_id", null);
  const { data: existing } = await resumeQuery
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    await supabase.from("combined_sessions").insert({ profile_id: user.id, team_id: teamId });
  }
  redirect("/combined/assessment");
}
