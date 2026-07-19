"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOnboarded } from "@/lib/auth/guards";
import { requireProductAllowed } from "@/lib/teams/session-guard";
import { computeFocusResult, type FocusAnswerInput } from "@/lib/scoring/focus";

/**
 * Focus Pulse flow actions. Mirror the DISC actions: RLS restricts
 * sessions/responses/results to their owner; these re-verify ownership and
 * enforce flow invariants. Scoring is computed here (server-side) and stored —
 * never only in the browser.
 */

/** Resume the open Focus session or start a new one, then go to the runner. */
export async function startFocusAssessment(): Promise<void> {
  // Backend lock: facilitator-led participants can only start the
  // assessment their facilitator selected, while its window is open.
  const { supabase, user } = await requireProductAllowed("focus");

  const { data: existing } = await supabase
    .from("focus_sessions")
    .select("id")
    .eq("profile_id", user.id)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) redirect(`/focus/assessment/${existing.id}`);

  const { data: version } = await supabase
    .from("focus_versions")
    .select("id")
    .eq("is_active", true)
    .single();
  if (!version) throw new Error("No active Focus version");

  const { data: session, error } = await supabase
    .from("focus_sessions")
    .insert({ profile_id: user.id, version_id: version.id })
    .select("id")
    .single();
  if (error || !session) throw new Error("Could not start the Focus Pulse");

  redirect(`/focus/assessment/${session.id}`);
}

const saveSchema = z
  .object({
    sessionId: z.uuid(),
    questionId: z.uuid(),
    optionId: z.uuid().optional(),
    scaleValue: z.number().int().min(1).max(10).optional(),
    questionIndex: z.number().int().min(0).max(50),
  })
  .refine((v) => v.optionId != null || v.scaleValue != null, {
    message: "An answer is required",
  });

export interface SaveFocusResult {
  ok: boolean;
  answeredCount: number;
  error?: string;
}

/** Autosave one answer (option or scale value); advances the resume position. */
export async function saveFocusResponse(
  input: z.infer<typeof saveSchema>,
): Promise<SaveFocusResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, answeredCount: 0, error: "Invalid answer" };
  const { supabase, user } = await requireOnboarded();
  const { sessionId, questionId, optionId, scaleValue, questionIndex } = parsed.data;

  const { data: session } = await supabase
    .from("focus_sessions")
    .select("id, status, profile_id, current_index, version_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.profile_id !== user.id) {
    return { ok: false, answeredCount: 0, error: "Session not found" };
  }
  if (session.status !== "in_progress") {
    return { ok: false, answeredCount: 0, error: "This pulse is already complete" };
  }

  // The question must belong to this session's version; an option (when given)
  // must belong to the question. Never trust the client's ids blindly.
  const { data: question } = await supabase
    .from("focus_questions")
    .select("id, kind")
    .eq("id", questionId)
    .eq("version_id", session.version_id)
    .maybeSingle();
  if (!question) {
    return { ok: false, answeredCount: 0, error: "Unknown question" };
  }
  if (question.kind === "single") {
    if (!optionId) return { ok: false, answeredCount: 0, error: "Choose an option" };
    const { data: option } = await supabase
      .from("focus_options")
      .select("id")
      .eq("id", optionId)
      .eq("question_id", questionId)
      .maybeSingle();
    if (!option) return { ok: false, answeredCount: 0, error: "Option does not match the question" };
  } else if (scaleValue == null) {
    return { ok: false, answeredCount: 0, error: "Choose a value" };
  }

  const { error: upsertError } = await supabase.from("focus_responses").upsert(
    {
      session_id: sessionId,
      question_id: questionId,
      option_id: question.kind === "single" ? optionId : null,
      scale_value: question.kind === "scale" ? scaleValue : null,
      answered_at: new Date().toISOString(),
    },
    { onConflict: "session_id,question_id" },
  );
  if (upsertError) {
    return { ok: false, answeredCount: 0, error: "Could not save — check your connection" };
  }

  const { count } = await supabase
    .from("focus_responses")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  await supabase
    .from("focus_sessions")
    .update({ current_index: Math.max(session.current_index, questionIndex + 1) })
    .eq("id", sessionId);

  return { ok: true, answeredCount: count ?? 0 };
}

export interface SubmitFocusResult {
  ok: boolean;
  error?: string;
}

/** Final submission: recompute server-side and persist the Focus result. */
export async function submitFocusAssessment(sessionId: string): Promise<SubmitFocusResult> {
  if (!z.uuid().safeParse(sessionId).success) return { ok: false, error: "Invalid session" };
  const { supabase, user } = await requireOnboarded();

  const { data: session } = await supabase
    .from("focus_sessions")
    .select("id, status, profile_id, version_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.profile_id !== user.id) {
    return { ok: false, error: "Session not found" };
  }

  if (session.status === "completed") {
    const { data: existing } = await supabase
      .from("focus_results")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (existing) redirect(`/focus/results/${existing.id}?new=1`);
    return { ok: false, error: "Session already closed" };
  }

  // Load responses with the external ids the pure scorer keys on.
  const { data: rows } = await supabase
    .from("focus_responses")
    .select(
      "scale_value, focus_questions (external_id), focus_options (external_id)",
    )
    .eq("session_id", sessionId);

  const answers: FocusAnswerInput[] = (rows ?? []).map((row) => {
    const question = Array.isArray(row.focus_questions) ? row.focus_questions[0] : row.focus_questions;
    const option = Array.isArray(row.focus_options) ? row.focus_options[0] : row.focus_options;
    return {
      questionId: question?.external_id ?? "",
      optionId: option?.external_id ?? null,
      scaleValue: row.scale_value,
    };
  });

  let computed;
  try {
    computed = computeFocusResult(answers);
  } catch {
    return { ok: false, error: "Your answers could not be scored — please review them" };
  }

  const { data: resultRow, error: resultError } = await supabase
    .from("focus_results")
    .insert({
      session_id: sessionId,
      profile_id: user.id,
      automaticity: computed.scores.automaticity,
      distraction: computed.scores.distraction,
      mental_load: computed.scores.mentalLoad,
      recovery: computed.scores.recovery,
      pattern_code: computed.patternCode,
      primary_loop: computed.primaryLoop,
      notification_pattern: computed.notificationPattern,
      energy_pattern: computed.energyPattern,
      preferred_reset: computed.preferredReset,
      raw: computed.scores,
    })
    .select("id")
    .single();
  if (resultError || !resultRow) {
    return { ok: false, error: "Could not store your result — please try again" };
  }

  await supabase
    .from("focus_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId);

  // Combined flow: when this Focus session belongs to a combined_session,
  // return to the controller, which finalizes and shows the combined result.
  const { data: combined } = await supabase
    .from("combined_sessions")
    .select("id")
    .eq("focus_session_id", sessionId)
    .eq("status", "in_progress")
    .maybeSingle();
  if (combined) redirect("/combined/assessment");

  redirect(`/focus/results/${resultRow.id}?new=1`);
}
