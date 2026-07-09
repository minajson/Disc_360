import { discQuestions } from "@/data/disc-questions";
import type { Dimension, Question, QuestionOption } from "@/lib/types";

const byId = new Map<string, Question>(discQuestions.map((q) => [q.id, q]));

export function getQuestion(questionId: string): Question | null {
  return byId.get(questionId) ?? null;
}

export function getOption(
  question: Question,
  optionId: string,
): QuestionOption | null {
  return question.options.find((option) => option.id === optionId) ?? null;
}

/** Dimension of an option, or null if the option is not in the question. */
export function optionDimension(
  questionId: string,
  optionId: string,
): Dimension | null {
  const question = getQuestion(questionId);
  if (!question) return null;
  return getOption(question, optionId)?.dimension ?? null;
}
