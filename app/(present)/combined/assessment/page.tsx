import { redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";

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
    .select("id, disc_session_id, focus_session_id, status")
    .eq("profile_id", user.id)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!combined) {
    const { data: created } = await supabase
      .from("combined_sessions")
      .insert({ profile_id: user.id })
      .select("id, disc_session_id, focus_session_id, status")
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
      const { data: version } = await supabase
        .from("assessment_versions")
        .select("id")
        .eq("is_active", true)
        .single();
      if (!version) redirect("/combined");
      const { data: session } = await supabase
        .from("assessment_sessions")
        .insert({ profile_id: user.id, version_id: version!.id })
        .select("id")
        .single();
      discId = session?.id ?? null;
      if (!discId) redirect("/combined");
      await supabase.from("combined_sessions").update({ disc_session_id: discId }).eq("id", combined.id);
    }
    redirect(`/app/assessments/${discId}`);
  }

  // ── Stage 2: Focus ──
  if (!(await completed("focus_sessions", combined.focus_session_id))) {
    let focusId = combined.focus_session_id;
    if (!focusId) {
      const { data: version } = await supabase
        .from("focus_versions")
        .select("id")
        .eq("is_active", true)
        .single();
      if (!version) redirect("/combined");
      const { data: session } = await supabase
        .from("focus_sessions")
        .insert({ profile_id: user.id, version_id: version!.id })
        .select("id")
        .single();
      focusId = session?.id ?? null;
      if (!focusId) redirect("/combined");
      await supabase.from("combined_sessions").update({ focus_session_id: focusId }).eq("id", combined.id);
    }
    redirect(`/focus/assessment/${focusId}`);
  }

  // ── Both done: finalize and show the combined result ──
  await supabase.from("combined_sessions").update({ status: "completed" }).eq("id", combined.id);
  redirect(`/combined/results/${combined.id}`);
}
