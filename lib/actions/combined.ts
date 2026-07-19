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

/** Start (or resume) the combined flow, then hand off to the controller. */
export async function startCombinedAssessment(): Promise<void> {
  // Backend lock: facilitator-led participants can only start the
  // assessment their facilitator selected, while its window is open.
  await requireProductAllowed("combined");
  const { supabase, user } = await requireOnboarded();

  const { data: existing } = await supabase
    .from("combined_sessions")
    .select("id")
    .eq("profile_id", user.id)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    await supabase.from("combined_sessions").insert({ profile_id: user.id });
  }
  redirect("/combined/assessment");
}
