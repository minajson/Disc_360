import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { AssessmentRunner } from "@/components/assessment/AssessmentRunner";

export const metadata: Metadata = { title: "Assessment" };

export default async function AssessmentSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { supabase, user } = await requireOnboarded();

  const { data: session } = await supabase
    .from("assessment_sessions")
    .select("id, status, profile_id, version_id, current_index")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.profile_id !== user.id) notFound();

  if (session.status === "completed") {
    const { data: result } = await supabase
      .from("assessment_results")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (result) redirect(`/app/results/${result.id}`);
    notFound();
  }

  const [{ data: questionRows }, { data: responses }] = await Promise.all([
    supabase
      .from("questions")
      .select("id, position, prompt, question_options (id, position, label)")
      .eq("version_id", session.version_id)
      .order("position"),
    supabase
      .from("assessment_responses")
      .select("question_id, most_option_id, least_option_id")
      .eq("session_id", sessionId),
  ]);

  // Dimension mappings deliberately never reach the client during the
  // assessment — only option ids and labels.
  const questions = (questionRows ?? []).map((row) => ({
    id: row.id,
    index: row.position,
    prompt: row.prompt,
    options: [...row.question_options]
      .sort((a, b) => a.position - b.position)
      .map((option) => ({ id: option.id, label: option.label })),
  }));

  const initialAnswers: Record<string, { most: string; least: string }> = {};
  for (const response of responses ?? []) {
    initialAnswers[response.question_id] = {
      most: response.most_option_id,
      least: response.least_option_id,
    };
  }

  return (
    <AssessmentRunner
      sessionId={session.id}
      startIndex={Math.min(session.current_index, questions.length - 1)}
      questions={questions}
      initialAnswers={initialAnswers}
    />
  );
}
