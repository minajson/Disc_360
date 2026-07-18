"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOnboarded } from "@/lib/auth/guards";
import { computeResult } from "@/lib/scoring/compute-result";
import { insightMap } from "@/data/insight-maps";
import {
  sendReportReady,
  sendTeamCampaignCompleted,
} from "@/lib/email/notifications";
import type { Question } from "@/lib/types";

/**
 * Assessment flow actions. RLS already restricts sessions/responses to their
 * owner; these actions re-verify ownership and enforce flow invariants.
 */

/** Resume the open session or create a new one, then go to the runner. */
export async function startAssessment(): Promise<void> {
  const { supabase, user } = await requireOnboarded();

  const { data: existing } = await supabase
    .from("assessment_sessions")
    .select("id")
    .eq("profile_id", user.id)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) redirect(`/app/assessments/${existing.id}`);

  const { data: version } = await supabase
    .from("assessment_versions")
    .select("id")
    .eq("is_active", true)
    .single();
  if (!version) throw new Error("No active assessment version");

  const { data: session, error } = await supabase
    .from("assessment_sessions")
    .insert({ profile_id: user.id, version_id: version.id })
    .select("id")
    .single();
  if (error || !session) throw new Error("Could not start the assessment");

  redirect(`/app/assessments/${session.id}`);
}

const saveResponseSchema = z
  .object({
    sessionId: z.uuid(),
    questionId: z.uuid(),
    mostOptionId: z.uuid(),
    leastOptionId: z.uuid(),
    questionIndex: z.number().int().min(0).max(200),
  })
  .refine((v) => v.mostOptionId !== v.leastOptionId, {
    message: "MOST and LEAST must differ",
  });

export interface SaveResponseResult {
  ok: boolean;
  answeredCount: number;
  error?: string;
}

/** Autosave one MOST/LEAST pair; upserts and advances the resume position. */
export async function saveResponse(
  input: z.infer<typeof saveResponseSchema>,
): Promise<SaveResponseResult> {
  const parsed = saveResponseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, answeredCount: 0, error: "Invalid answer payload" };
  }
  const { supabase, user } = await requireOnboarded();
  const { sessionId, questionId, mostOptionId, leastOptionId, questionIndex } =
    parsed.data;

  const { data: session } = await supabase
    .from("assessment_sessions")
    .select("id, status, profile_id, current_index")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.profile_id !== user.id) {
    return { ok: false, answeredCount: 0, error: "Session not found" };
  }
  if (session.status !== "in_progress") {
    return { ok: false, answeredCount: 0, error: "This assessment is already completed" };
  }

  // Both options must belong to the answered question.
  const { data: options } = await supabase
    .from("question_options")
    .select("id")
    .eq("question_id", questionId)
    .in("id", [mostOptionId, leastOptionId]);
  if ((options ?? []).length !== 2) {
    return { ok: false, answeredCount: 0, error: "Options do not match the question" };
  }

  const { error: upsertError } = await supabase
    .from("assessment_responses")
    .upsert(
      {
        session_id: sessionId,
        question_id: questionId,
        most_option_id: mostOptionId,
        least_option_id: leastOptionId,
        answered_at: new Date().toISOString(),
      },
      { onConflict: "session_id,question_id" },
    );
  if (upsertError) {
    return { ok: false, answeredCount: 0, error: "Could not save — check your connection" };
  }

  const { count } = await supabase
    .from("assessment_responses")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  await supabase
    .from("assessment_sessions")
    .update({ current_index: Math.max(session.current_index, questionIndex + 1) })
    .eq("id", sessionId);

  return { ok: true, answeredCount: count ?? 0 };
}

export interface SubmitResult {
  ok: boolean;
  error?: string;
}

/** Final submission: recompute everything server-side and persist the result. */
export async function submitAssessment(sessionId: string): Promise<SubmitResult> {
  if (!z.uuid().safeParse(sessionId).success) {
    return { ok: false, error: "Invalid session" };
  }
  const { supabase, user } = await requireOnboarded();

  const { data: session } = await supabase
    .from("assessment_sessions")
    .select("id, status, profile_id, version_id, campaign_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.profile_id !== user.id) {
    return { ok: false, error: "Session not found" };
  }

  // Idempotent: a completed session forwards to its existing result.
  if (session.status === "completed") {
    const { data: existing } = await supabase
      .from("assessment_results")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (existing) redirect(`/app/results/${existing.id}?new=1`);
    return { ok: false, error: "Session already closed" };
  }

  const [{ data: questionRows }, { data: responses }] = await Promise.all([
    supabase
      .from("questions")
      .select("id, external_id, position, prompt, question_options (id, external_id, position, label, dimension)")
      .eq("version_id", session.version_id)
      .order("position"),
    supabase
      .from("assessment_responses")
      .select("question_id, most_option_id, least_option_id")
      .eq("session_id", sessionId),
  ]);

  const questions: Question[] = (questionRows ?? []).map((row) => ({
    id: row.id,
    index: row.position,
    prompt: row.prompt,
    options: [...row.question_options]
      .sort((a, b) => a.position - b.position)
      .map((option) => ({
        id: option.id,
        label: option.label,
        dimension: option.dimension,
      })) as Question["options"],
  }));

  if ((responses ?? []).length !== questions.length) {
    return {
      ok: false,
      error: `${questions.length - (responses ?? []).length} scenario(s) still unanswered`,
    };
  }

  let computed;
  try {
    computed = computeResult({
      resultId: "pending",
      sessionId,
      userId: user.id,
      answers: (responses ?? []).map((response) => ({
        questionId: response.question_id,
        mostOptionId: response.most_option_id,
        leastOptionId: response.least_option_id,
      })),
      questions,
      createdAt: new Date().toISOString(),
    });
  } catch {
    return { ok: false, error: "Your answers could not be scored — please review them" };
  }

  const { data: resultRow, error: resultError } = await supabase
    .from("assessment_results")
    .insert({
      session_id: sessionId,
      profile_id: user.id,
      score_d: computed.normalized.d,
      score_i: computed.normalized.i,
      score_s: computed.normalized.s,
      score_c: computed.normalized.c,
      archetype_code: computed.archetypeCode,
      primary_dimension: computed.primaryDimension,
      secondary_dimension: computed.secondaryDimension,
      intensity: computed.intensity,
      raw_most: computed.rawMost,
      raw_least: computed.rawLeast,
      net: computed.net,
    })
    .select("id")
    .single();
  if (resultError || !resultRow) {
    return { ok: false, error: "Could not store your result — please try again" };
  }

  // Freeze the insight copy used for this report.
  await supabase.from("result_insights").insert({
    result_id: resultRow.id,
    insight_snapshot: JSON.parse(
      JSON.stringify(insightMap[computed.archetypeCode]),
    ),
  });

  await supabase
    .from("assessment_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId);

  // Combined flow: when this DISC session belongs to a combined_session, return
  // to the controller (which continues to the Focus Pulse) rather than showing
  // the standalone DISC result.
  const { data: combined } = await supabase
    .from("combined_sessions")
    .select("id")
    .eq("disc_session_id", sessionId)
    .eq("status", "in_progress")
    .maybeSingle();
  if (combined) redirect("/combined/assessment");

  // Report-ready notification (preference-gated).
  const { profile } = await requireOnboarded();
  await sendReportReady({
    to: profile.email,
    profileId: user.id,
    archetypeName: insightMap[computed.archetypeCode].name,
    resultId: resultRow.id,
  });

  // Campaign bookkeeping: mark this member's assignment completed and,
  // when the whole campaign finishes, notify team admins.
  if (session.campaign_id) {
    const { data: campaign } = await supabase
      .from("assessment_campaigns")
      .select("team_id, name, teams (name)")
      .eq("id", session.campaign_id)
      .maybeSingle();
    if (campaign) {
      const { data: member } = await supabase
        .from("team_members")
        .select("id")
        .eq("team_id", campaign.team_id)
        .eq("profile_id", user.id)
        .maybeSingle();
      if (member) {
        await supabase
          .from("campaign_assignments")
          .update({ status: "completed" })
          .eq("campaign_id", session.campaign_id)
          .eq("team_member_id", member.id);
      }

      const { data: assignments } = await supabase
        .from("campaign_assignments")
        .select("status")
        .eq("campaign_id", session.campaign_id);
      const total = (assignments ?? []).length;
      const completed = (assignments ?? []).filter((a) => a.status === "completed").length;
      if (total > 0 && completed === total) {
        const teamRow = Array.isArray(campaign.teams) ? campaign.teams[0] : campaign.teams;
        const { data: admins } = await supabase
          .from("team_members")
          .select("email, profile_id")
          .eq("team_id", campaign.team_id)
          .eq("role", "team_admin");
        for (const adminMember of admins ?? []) {
          await sendTeamCampaignCompleted({
            to: adminMember.email,
            profileId: adminMember.profile_id,
            teamId: campaign.team_id,
            teamName: teamRow?.name ?? "your team",
            campaignName: campaign.name,
            completed,
            total,
          });
        }
      }
    }
  }

  redirect(`/app/results/${resultRow.id}?new=1`);
}
