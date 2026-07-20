import { redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { facilitatedProductState } from "@/lib/teams/session-guard";

/**
 * Combined controller. Each visit advances the flow: DISC first, then Focus,
 * then the combined result. The DISC and Focus submit actions redirect back
 * here when their session belongs to a combined_session, so the runners
 * themselves need no combined-specific code.
 */
export default async function CombinedAssessmentController() {
  const { supabase, user } = await requireOnboarded();

  // The in-progress combined session (created by startCombinedAssessment).
  let { data: combined } = await supabase
    .from("combined_sessions")
    .select("id, disc_session_id, focus_session_id, status, team_id")
    .eq("profile_id", user.id)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!combined) {
    const { data: created } = await supabase
      .from("combined_sessions")
      .insert({ profile_id: user.id })
      .select("id, disc_session_id, focus_session_id, status, team_id")
      .single();
    combined = created;
  }
  if (!combined) redirect("/combined");

  const completed = async (table: "assessment_sessions" | "focus_sessions", id: string | null) => {
    if (!id) return false;
    const { data } = await supabase.from(table).select("status").eq("id", id).maybeSingle();
    return data?.status === "completed";
  };

  // ── Stage 1: DISC ──
  if (!(await completed("assessment_sessions", combined.disc_session_id))) {
    let discId = combined.disc_session_id;
    if (!discId) {
      // Adopt an existing open attempt in the SAME scope first — one active
      // attempt per (user, team) is a database constraint, and continuing
      // that attempt is what the participant expects.
      let adoptQuery = supabase
        .from("assessment_sessions")
        .select("id")
        .eq("profile_id", user.id)
        .eq("status", "in_progress");
      adoptQuery = combined.team_id
        ? adoptQuery.eq("team_id", combined.team_id)
        : adoptQuery.is("team_id", null);
      const { data: adoptable } = await adoptQuery.limit(1).maybeSingle();
      if (adoptable) {
        discId = adoptable.id;
      } else {
        const { data: version } = await supabase
          .from("assessment_versions")
          .select("id")
          .eq("is_active", true)
          .single();
        if (!version) redirect("/combined");
        const { data: session } = await supabase
          .from("assessment_sessions")
          .insert({ profile_id: user.id, version_id: version!.id, team_id: combined.team_id })
          .select("id")
          .single();
        discId = session?.id ?? null;
      }
      if (!discId) redirect("/combined");
      await supabase.from("combined_sessions").update({ disc_session_id: discId }).eq("id", combined.id);
    }
    redirect(`/app/assessments/${discId}`);
  }

  // ── Stage 2: Focus ──
  if (!(await completed("focus_sessions", combined.focus_session_id))) {
    let focusId = combined.focus_session_id;
    if (!focusId) {
      let adoptQuery = supabase
        .from("focus_sessions")
        .select("id")
        .eq("profile_id", user.id)
        .eq("status", "in_progress");
      adoptQuery = combined.team_id
        ? adoptQuery.eq("team_id", combined.team_id)
        : adoptQuery.is("team_id", null);
      const { data: adoptable } = await adoptQuery.limit(1).maybeSingle();
      if (adoptable) {
        focusId = adoptable.id;
      } else {
        const { data: version } = await supabase
          .from("focus_versions")
          .select("id")
          .eq("is_active", true)
          .single();
        if (!version) redirect("/combined");
        const { data: session } = await supabase
          .from("focus_sessions")
          .insert({ profile_id: user.id, version_id: version!.id, team_id: combined.team_id })
          .select("id")
          .single();
        focusId = session?.id ?? null;
      }
      if (!focusId) redirect("/combined");
      await supabase.from("combined_sessions").update({ focus_session_id: focusId }).eq("id", combined.id);
    }
    redirect(`/focus/assessment/${focusId}`);
  }

  // ── Both done: finalize. Facilitated participants wait on the session
  // card until the facilitator releases; everyone else sees the result. ──
  await supabase.from("combined_sessions").update({ status: "completed" }).eq("id", combined.id);
  const release = await facilitatedProductState(supabase, user.id, "combined");
  if (release === "held") redirect("/app");
  redirect(`/combined/results/${combined.id}`);
}
