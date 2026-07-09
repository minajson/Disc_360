import { z } from "zod";

/** Shared client/server validation for the assessment flow. */

export const submitAnswerSchema = z
  .object({
    sessionId: z.string().min(1),
    questionId: z.string().min(1),
    mostOptionId: z.string().min(1),
    leastOptionId: z.string().min(1),
  })
  .refine((value) => value.mostOptionId !== value.leastOptionId, {
    message: "MOST and LEAST must be different options",
    path: ["leastOptionId"],
  });

export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;

export const completeAssessmentSchema = z.object({
  sessionId: z.string().min(1),
});

export type CompleteAssessmentInput = z.infer<typeof completeAssessmentSchema>;

/** Uniform API error envelope. */
export interface ApiError {
  error: {
    code: string;
    message: string;
    issues?: unknown;
  };
}

export function apiError(
  code: string,
  message: string,
  issues?: unknown,
): ApiError {
  return { error: { code, message, ...(issues !== undefined ? { issues } : {}) } };
}
