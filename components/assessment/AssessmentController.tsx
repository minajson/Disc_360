"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { discQuestions, TOTAL_QUESTIONS } from "@/data/disc-questions";
import { completeAssessment, saveAnswer } from "@/lib/assessment/client";
import type { AssessmentSession } from "@/lib/types";
import { QuestionCard } from "@/components/assessment/QuestionCard";
import { QuestionTransition } from "@/components/assessment/QuestionTransition";
import { AssessmentProgress } from "@/components/assessment/AssessmentProgress";
import { CompletionInterstitial } from "@/components/assessment/CompletionInterstitial";
import type { Selection } from "@/components/assessment/MostLeastSelector";

const ADVANCE_DELAY_MS = 420;
/** Minimum time the interstitial stays visible — the cinematic beat. */
const INTERSTITIAL_MIN_MS = 1600;

interface FlowState {
  index: number;
  direction: 1 | -1;
  selections: Record<string, Selection>;
  saveState: "idle" | "saving" | "error";
}

type FlowAction =
  | { type: "SELECT_MOST"; questionId: string; optionId: string }
  | { type: "SELECT_LEAST"; questionId: string; optionId: string }
  | { type: "GO_TO"; index: number }
  | { type: "SAVE_STATE"; value: FlowState["saveState"] };

function selectionFor(state: FlowState, questionId: string): Selection {
  return state.selections[questionId] ?? { most: null, least: null };
}

function reducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "SELECT_MOST": {
      const current = selectionFor(state, action.questionId);
      if (current.least === action.optionId) return state;
      return {
        ...state,
        selections: {
          ...state.selections,
          [action.questionId]: { ...current, most: action.optionId },
        },
      };
    }
    case "SELECT_LEAST": {
      const current = selectionFor(state, action.questionId);
      if (current.most === action.optionId) return state;
      return {
        ...state,
        selections: {
          ...state.selections,
          [action.questionId]: { ...current, least: action.optionId },
        },
      };
    }
    case "GO_TO":
      return {
        ...state,
        index: Math.max(0, Math.min(TOTAL_QUESTIONS - 1, action.index)),
        direction: action.index >= state.index ? 1 : -1,
      };
    case "SAVE_STATE":
      return { ...state, saveState: action.value };
  }
}

interface AssessmentControllerProps {
  session: AssessmentSession;
  initialSelections: Record<string, Selection>;
}

export function AssessmentController({
  session,
  initialSelections,
}: AssessmentControllerProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, {
    index: session.currentQuestionIndex,
    direction: 1,
    selections: initialSelections,
    saveState: "idle",
  });
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  const answeredCount = Object.values(state.selections).filter(
    (selection) => selection.most && selection.least,
  ).length;

  const question = discQuestions[state.index];

  const persist = useCallback(
    async (questionId: string, selection: Selection) => {
      if (!selection.most || !selection.least) return;
      dispatch({ type: "SAVE_STATE", value: "saving" });
      try {
        await saveAnswer({
          sessionId: session.id,
          questionId,
          mostOptionId: selection.most,
          leastOptionId: selection.least,
        });
        dispatch({ type: "SAVE_STATE", value: "idle" });
      } catch {
        dispatch({ type: "SAVE_STATE", value: "error" });
      }
    },
    [session.id],
  );

  const finish = useCallback(async () => {
    setCompleting(true);
    setCompletionError(null);
    const startedAt = Date.now();
    try {
      const { result } = await completeAssessment(session.id);
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, INTERSTITIAL_MIN_MS - elapsed);
      setTimeout(() => {
        router.push(`/results/${result.id}`);
      }, remaining);
    } catch (error) {
      setCompletionError(
        error instanceof Error
          ? error.message
          : "We couldn't compute your profile. Your answers are saved — try again.",
      );
    }
  }, [router, session.id]);

  const handlePick = (kind: "most" | "least", optionId: string) => {
    if (!question) return;
    const before = selectionFor(state, question.id);
    // Reducer blocks most === least; mirror the check to decide follow-up.
    const blocked =
      kind === "most" ? before.least === optionId : before.most === optionId;
    if (blocked) return;

    dispatch({
      type: kind === "most" ? "SELECT_MOST" : "SELECT_LEAST",
      questionId: question.id,
      optionId,
    });

    const after: Selection =
      kind === "most"
        ? { most: optionId, least: before.least }
        : { most: before.most, least: optionId };

    if (after.most && after.least) {
      void persist(question.id, after);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      if (state.index < TOTAL_QUESTIONS - 1) {
        advanceTimer.current = setTimeout(() => {
          dispatch({ type: "GO_TO", index: state.index + 1 });
        }, ADVANCE_DELAY_MS);
      } else {
        advanceTimer.current = setTimeout(() => {
          void finish();
        }, ADVANCE_DELAY_MS);
      }
    }
  };

  if (completing) {
    return (
      <CompletionInterstitial
        error={completionError}
        onRetry={() => void finish()}
      />
    );
  }

  if (!question) return null;
  const selection = selectionFor(state, question.id);

  return (
    <div className="flex flex-col gap-10">
      <AssessmentProgress
        current={state.index}
        total={TOTAL_QUESTIONS}
        answeredCount={answeredCount}
      />

      <QuestionTransition transitionKey={question.id} direction={state.direction}>
        <QuestionCard
          question={question}
          selection={selection}
          onSelectMost={(optionId) => handlePick("most", optionId)}
          onSelectLeast={(optionId) => handlePick("least", optionId)}
        />
      </QuestionTransition>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => dispatch({ type: "GO_TO", index: state.index - 1 })}
          disabled={state.index === 0}
          className="rounded-full px-4 py-2 text-sm text-ink-muted transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-30"
        >
          ← Previous
        </button>

        <span aria-live="polite" className="font-mono text-xs text-ink-muted">
          {state.saveState === "saving"
            ? "Saving…"
            : state.saveState === "error"
              ? "Save failed — answers retry on your next pick"
              : "Autosaved"}
        </span>

        <button
          type="button"
          onClick={() => dispatch({ type: "GO_TO", index: state.index + 1 })}
          disabled={
            state.index >= TOTAL_QUESTIONS - 1 ||
            !(selection.most && selection.least)
          }
          className="rounded-full px-4 py-2 text-sm text-ink-muted transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
