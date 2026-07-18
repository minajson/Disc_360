import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { focusQuestionById } from "@/data/focus-questions";
import { FocusRunner } from "@/components/focus/FocusRunner";

export const metadata: Metadata = { title: "Focus Pulse" };

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function FocusSessionPage({ params }: PageProps) {
  const { sessionId } = await params;
  const { supabase, user } = await requireOnboarded();

  const { data: session } = await supabase
    .from("focus_sessions")
    .select("id, status, profile_id, version_id, current_index")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.profile_id !== user.id) notFound();

  if (session.status === "completed") {
    const { data: result } = await supabase
      .from("focus_results")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (result) redirect(`/focus/results/${result.id}`);
    notFound();
  }

  const [{ data: questionRows }, { data: responses }] = await Promise.all([
    supabase
      .from("focus_questions")
      .select("id, external_id, position, prompt, kind, scale_min, scale_max, focus_options (id, position, label)")
      .eq("version_id", session.version_id)
      .order("position"),
    supabase
      .from("focus_responses")
      .select("question_id, option_id, scale_value")
      .eq("session_id", sessionId),
  ]);

  const questions = (questionRows ?? []).map((row) => {
    // Scale endpoint labels are content, resolved from the bank by external id.
    const bank = focusQuestionById.get(row.external_id);
    return {
      id: row.id,
      index: row.position,
      prompt: row.prompt,
      kind: row.kind as "single" | "scale",
      options: [...row.focus_options]
        .sort((a, b) => a.position - b.position)
        .map((o) => ({ id: o.id, label: o.label })),
      scaleMin: row.scale_min,
      scaleMax: row.scale_max,
      scaleMinLabel: bank?.scaleMinLabel ?? null,
      scaleMaxLabel: bank?.scaleMaxLabel ?? null,
    };
  });

  const initialAnswers: Record<string, { optionId?: string; scaleValue?: number }> = {};
  for (const response of responses ?? []) {
    initialAnswers[response.question_id] = {
      optionId: response.option_id ?? undefined,
      scaleValue: response.scale_value ?? undefined,
    };
  }

  return (
    <FocusRunner
      sessionId={sessionId}
      startIndex={session.current_index}
      questions={questions}
      initialAnswers={initialAnswers}
    />
  );
}
