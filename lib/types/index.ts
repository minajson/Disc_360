/**
 * Shared domain model — Prisma-compatible naming and serialization.
 * Dates are ISO-8601 strings; IDs are prefixed strings (see lib/mock-db/ids.ts).
 */

export type Dimension = "D" | "I" | "S" | "C";

export type ArchetypeCode =
  | "D"
  | "DI"
  | "ID"
  | "I"
  | "IS"
  | "SI"
  | "S"
  | "SC"
  | "CS"
  | "C"
  | "CD"
  | "DC"
  | "BAL";

export type IntensityBand = "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";

export interface DiscScores {
  d: number;
  i: number;
  s: number;
  c: number;
}

export type UserRole = "INDIVIDUAL" | "COACH" | "HR_ADMIN";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export type SessionStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

export interface AssessmentSession {
  id: string;
  userId: string;
  status: SessionStatus;
  currentQuestionIndex: number;
  startedAt: string;
  completedAt: string | null;
  resultId: string | null;
}

export interface Answer {
  id: string;
  sessionId: string;
  questionId: string;
  mostOptionId: string;
  leastOptionId: string;
  answeredAt: string;
}

export interface Result {
  id: string;
  sessionId: string;
  userId: string;
  rawMost: DiscScores;
  rawLeast: DiscScores;
  net: DiscScores;
  normalized: DiscScores;
  archetypeCode: ArchetypeCode;
  primaryDimension: Dimension;
  secondaryDimension: Dimension | null;
  intensity: Record<Dimension, IntensityBand>;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string | null;
  displayName: string;
  roleTitle: string;
  department: string;
  resultId: string;
  archetypeCode: ArchetypeCode;
  normalized: DiscScores;
}

/* ── Assessment content types ─────────────────────────────── */

export interface QuestionOption {
  id: string;
  label: string;
  dimension: Dimension;
}

export interface Question {
  id: string;
  index: number;
  prompt: string;
  options: [QuestionOption, QuestionOption, QuestionOption, QuestionOption];
}

/* ── Helpers ──────────────────────────────────────────────── */

export const DIMENSIONS: readonly Dimension[] = ["D", "I", "S", "C"] as const;

/** Maps dimension code to the DiscScores key. */
export const DIMENSION_KEY: Record<Dimension, keyof DiscScores> = {
  D: "d",
  I: "i",
  S: "s",
  C: "c",
};
