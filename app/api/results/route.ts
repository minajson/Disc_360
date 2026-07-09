import { NextResponse } from "next/server";
import { discQuestions } from "@/data/disc-questions";
import { apiError, completeAssessmentSchema } from "@/lib/assessment/schemas";
import { computeResult } from "@/lib/scoring/compute-result";
import { ScoringError } from "@/lib/scoring/pipeline";
import { db } from "@/lib/mock-db/client";
import { createId } from "@/lib/mock-db/ids";
import type { Answer, AssessmentSession, Result } from "@/lib/types";

export const dynamic = "force-dynamic";

/** POST /api/results — complete a session and compute its result. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      apiError("INVALID_JSON", "Request body must be valid JSON"),
      { status: 400 },
    );
  }

  const parsed = completeAssessmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError("VALIDATION_FAILED", "Invalid payload", parsed.error.issues),
      { status: 400 },
    );
  }

  const session = (await db.assessmentSession.findUnique({
    where: { id: parsed.data.sessionId },
  })) as AssessmentSession | null;
  if (!session) {
    return NextResponse.json(
      apiError("SESSION_NOT_FOUND", "Assessment session does not exist"),
      { status: 404 },
    );
  }

  // Idempotent completion: re-posting a finished session returns its result.
  if (session.status === "COMPLETED" && session.resultId) {
    const existing = (await db.result.findUnique({
      where: { id: session.resultId },
    })) as Result | null;
    if (existing) return NextResponse.json({ result: existing });
  }

  const answers = (await db.answer.findMany({
    where: { sessionId: session.id },
  })) as Answer[];

  const answeredIds = new Set(answers.map((a) => a.questionId));
  const missingQuestionIds = discQuestions
    .filter((q) => !answeredIds.has(q.id))
    .map((q) => q.id);
  if (missingQuestionIds.length > 0) {
    return NextResponse.json(
      apiError(
        "INCOMPLETE_ASSESSMENT",
        `${missingQuestionIds.length} question(s) still unanswered`,
        { missingQuestionIds },
      ),
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  let result: Result;
  try {
    result = computeResult({
      resultId: createId("res"),
      sessionId: session.id,
      userId: session.userId,
      answers,
      questions: discQuestions,
      createdAt: now,
    });
  } catch (error) {
    if (error instanceof ScoringError) {
      return NextResponse.json(apiError(error.code, error.message), {
        status: 422,
      });
    }
    throw error;
  }

  await db.result.create({ data: result });
  await db.assessmentSession.update({
    where: { id: session.id },
    data: { status: "COMPLETED", completedAt: now, resultId: result.id },
  });

  return NextResponse.json({ result }, { status: 201 });
}

/** GET /api/results?resultId=… */
export async function GET(request: Request) {
  const resultId = new URL(request.url).searchParams.get("resultId");
  if (!resultId) {
    return NextResponse.json(
      apiError("MISSING_PARAM", "resultId query parameter is required"),
      { status: 400 },
    );
  }
  const result = (await db.result.findUnique({
    where: { id: resultId },
  })) as Result | null;
  if (!result) {
    return NextResponse.json(apiError("RESULT_NOT_FOUND", "No such result"), {
      status: 404,
    });
  }
  return NextResponse.json({ result });
}
