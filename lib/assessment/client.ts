import type { AssessmentSession, Result } from "@/lib/types";
import type { SubmitAnswerInput } from "@/lib/assessment/schemas";

/** Client-side fetch helpers for the assessment flow. */

async function parseOrThrow<T>(response: Response): Promise<T> {
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: { message?: string } }).error.message)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function createSession(): Promise<{
  session: AssessmentSession;
  totalQuestions: number;
}> {
  const response = await fetch("/api/assessment", { method: "POST" });
  return parseOrThrow(response);
}

export async function saveAnswer(input: SubmitAnswerInput): Promise<{
  session: AssessmentSession;
  answeredCount: number;
}> {
  const response = await fetch("/api/assessment", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow(response);
}

export async function completeAssessment(
  sessionId: string,
): Promise<{ result: Result }> {
  const response = await fetch("/api/results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  return parseOrThrow(response);
}
