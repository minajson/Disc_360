import { NextResponse } from "next/server";
import { TOTAL_QUESTIONS } from "@/data/disc-questions";
import { getOption, getQuestion } from "@/lib/assessment/questions";
import { apiError, submitAnswerSchema } from "@/lib/assessment/schemas";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mock-db/client";
import { createId } from "@/lib/mock-db/ids";
import type { Answer, AssessmentSession } from "@/lib/types";

export const dynamic = "force-dynamic";

/** POST /api/assessment — create a new assessment session. */
export async function POST() {
  const user = await getCurrentUser();
  const session: AssessmentSession = {
    id: createId("ses"),
    userId: user.id,
    status: "IN_PROGRESS",
    currentQuestionIndex: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    resultId: null,
  };
  await db.assessmentSession.create({ data: session });
  return NextResponse.json(
    { session, totalQuestions: TOTAL_QUESTIONS },
    { status: 201 },
  );
}

/** PATCH /api/assessment — upsert one answer and advance progress. */
export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      apiError("INVALID_JSON", "Request body must be valid JSON"),
      { status: 400 },
    );
  }

  const parsed = submitAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError("VALIDATION_FAILED", "Invalid answer payload", parsed.error.issues),
      { status: 400 },
    );
  }
  const { sessionId, questionId, mostOptionId, leastOptionId } = parsed.data;

  const session = (await db.assessmentSession.findUnique({
    where: { id: sessionId },
  })) as AssessmentSession | null;
  if (!session) {
    return NextResponse.json(
      apiError("SESSION_NOT_FOUND", "Assessment session does not exist"),
      { status: 404 },
    );
  }
  if (session.status === "COMPLETED") {
    return NextResponse.json(
      apiError("SESSION_COMPLETED", "This assessment is already completed"),
      { status: 409 },
    );
  }

  const question = getQuestion(questionId);
  if (!question) {
    return NextResponse.json(
      apiError("QUESTION_NOT_FOUND", "Unknown question id"),
      { status: 400 },
    );
  }
  if (!getOption(question, mostOptionId) || !getOption(question, leastOptionId)) {
    return NextResponse.json(
      apiError(
        "OPTION_MISMATCH",
        "Both options must belong to the answered question",
      ),
      { status: 400 },
    );
  }

  // Upsert: one answer per (session, question).
  const existing = (await db.answer.findMany({
    where: { sessionId, questionId },
  })) as Answer[];
  const now = new Date().toISOString();

  if (existing.length > 0 && existing[0]) {
    await db.answer.update({
      where: { id: existing[0].id },
      data: { mostOptionId, leastOptionId, answeredAt: now },
    });
  } else {
    const answer: Answer = {
      id: createId("ans"),
      sessionId,
      questionId,
      mostOptionId,
      leastOptionId,
      answeredAt: now,
    };
    await db.answer.create({ data: answer });
  }

  const answered = (await db.answer.findMany({ where: { sessionId } })) as Answer[];
  const nextIndex = Math.min(
    Math.max(session.currentQuestionIndex, question.index + 1),
    TOTAL_QUESTIONS - 1,
  );
  const updated = await db.assessmentSession.update({
    where: { id: sessionId },
    data: { currentQuestionIndex: nextIndex },
  });

  return NextResponse.json({ session: updated, answeredCount: answered.length });
}
