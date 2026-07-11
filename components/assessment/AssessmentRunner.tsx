"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { AssessmentTransitionScene } from "@/components/media/AssessmentTransitionScene";
import { saveResponse, submitAssessment } from "@/lib/actions/assessment";

interface RunnerQuestion {
  id: string;
  index: number;
  prompt: string;
  options: { id: string; label: string }[];
}

interface Answer {
  most: string | null;
  least: string | null;
}

interface AssessmentRunnerProps {
  sessionId: string;
  startIndex: number;
  questions: RunnerQuestion[];
  initialAnswers: Record<string, { most: string; least: string }>;
}

const ADVANCE_DELAY_MS = 450;

export function AssessmentRunner({
  sessionId,
  startIndex,
  questions,
  initialAnswers,
}: AssessmentRunnerProps) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(startIndex);
  const [answers, setAnswers] = useState<Record<string, Answer>>(initialAnswers);
  const [stage, setStage] = useState<"most" | "least">("most");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    Object.keys(initialAnswers).length > 0 ? "saved" : "idle",
  );
  const [confirming, setConfirming] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [, startSave] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = questions.length;
  const question = questions[index];
  const answer: Answer = (question && answers[question.id]) ?? {
    most: null,
    least: null,
  };
  const answeredCount = Object.values(answers).filter(
    (entry) => entry.most && entry.least,
  ).length;
  const allAnswered = answeredCount === total;

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  const persist = useCallback(
    (questionId: string, questionIndex: number, most: string, least: string) => {
      setSaveState("saving");
      startSave(async () => {
        const result = await saveResponse({
          sessionId,
          questionId,
          mostOptionId: most,
          leastOptionId: least,
          questionIndex,
        });
        setSaveState(result.ok ? "saved" : "error");
      });
    },
    [sessionId],
  );

  const goTo = (nextIndex: number) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setIndex(Math.max(0, Math.min(total - 1, nextIndex)));
    setStage("most");
  };

  const pickMost = (optionId: string) => {
    if (!question) return;
    const nextLeast = answer.least === optionId ? null : answer.least;
    setAnswers((current) => ({
      ...current,
      [question.id]: { most: optionId, least: nextLeast },
    }));
    setStage("least");
    if (nextLeast) persist(question.id, question.index, optionId, nextLeast);
  };

  const pickLeast = (optionId: string) => {
    if (!question || !answer.most || optionId === answer.most) return;
    setAnswers((current) => ({
      ...current,
      [question.id]: { most: answer.most, least: optionId },
    }));
    persist(question.id, question.index, answer.most, optionId);

    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      if (index < total - 1) {
        setIndex(index + 1);
        setStage("most");
      } else {
        setConfirming(true);
      }
    }, ADVANCE_DELAY_MS);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!question) return;
    const number = Number(event.key);
    if (number >= 1 && number <= question.options.length) {
      const option = question.options[number - 1];
      if (!option) return;
      if (stage === "most") pickMost(option.id);
      else pickLeast(option.id);
    }
  };

  const handleSubmit = () => {
    setSubmitError(null);
    startSubmit(async () => {
      const result = await submitAssessment(sessionId);
      // On success the action redirects; reaching here means it failed.
      if (result && !result.ok) setSubmitError(result.error ?? "Please try again.");
    });
  };

  if (confirming) {
    return (
      <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-5">
        <AssessmentTransitionScene />
        <div className="paper-card relative z-10 flex w-full max-w-lg flex-col items-center gap-6 p-10 text-center">
          {submitting ? (
            <>
              <motion.div
                aria-hidden
                className="size-12 rounded-full border-2 border-sage border-t-botanical"
                animate={reduced ? undefined : { rotate: 360 }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
              />
              <h1 className="font-display text-h3 font-semibold">
                Computing your profile…
              </h1>
              <p className="text-sm text-slate">
                Weighing all {total} of your choices.
              </p>
            </>
          ) : (
            <>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
                {answeredCount} of {total} answered
              </span>
              <h1 className="font-display text-h3 font-semibold text-balance">
                {allAnswered
                  ? "Ready to see your profile?"
                  : "A few scenarios still need answers"}
              </h1>
              <p className="max-w-sm text-sm leading-relaxed text-slate">
                {allAnswered
                  ? "Submitting closes this assessment and computes your profile. You can review any answer first."
                  : "Head back to complete the remaining scenarios — everything you've chosen is saved."}
              </p>
              {submitError ? (
                <p role="alert" className="text-sm text-disc-d">
                  {submitError}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirming(false);
                    goTo(allAnswered ? total - 1 : index);
                  }}
                >
                  Review answers
                </Button>
                {allAnswered ? (
                  <Button size="lg" onClick={handleSubmit} disabled={submitting}>
                    Submit assessment
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!question) return null;

  const stagePrompt =
    stage === "most"
      ? "Which statement is MOST like you?"
      : "And which is LEAST like you?";

  return (
    <div
      className="relative mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-10 sm:py-14"
      onKeyDown={handleKeyDown}
    >
      {/* progress */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-xs text-slate">
            Scenario <span className="text-ink">{index + 1}</span> of {total}
          </span>
          <span
            aria-live="polite"
            className={cn(
              "font-mono text-[11px]",
              saveState === "error" ? "text-disc-d" : "text-faint",
            )}
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Autosaved"
                : saveState === "error"
                  ? "Save failed — retrying on your next choice"
                  : `${Math.round((answeredCount / total) * 100)}% complete`}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={answeredCount}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Assessment progress"
          className="h-1.5 w-full overflow-hidden rounded-full bg-ink/8"
        >
          <div
            className="h-full rounded-full bg-botanical transition-[width] duration-500 ease-[var(--ease-meridian)]"
            style={{ width: `${(answeredCount / total) * 100}%` }}
          />
        </div>
      </div>

      {/* question card */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={question.id}
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
          transition={{ duration: 0.28, ease: [0.32, 0.94, 0.6, 1] }}
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col gap-2 text-center">
            <h1 className="font-display text-h3 font-semibold text-balance">
              {question.prompt}
            </h1>
            <p aria-live="polite" className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal">
              {stagePrompt}
            </p>
          </div>

          <div role="group" aria-label={stagePrompt} className="flex flex-col gap-2.5">
            {question.options.map((option, optionIndex) => {
              const isMost = answer.most === option.id;
              const isLeast = answer.least === option.id;
              const disabled = stage === "least" && isMost;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={stage === "most" ? isMost : isLeast}
                  onClick={() =>
                    stage === "most" ? pickMost(option.id) : pickLeast(option.id)
                  }
                  className={cn(
                    "flex min-h-14 items-center justify-between gap-4 rounded-2xl border bg-paper px-5 py-4 text-left text-sm font-medium transition-all duration-200 sm:text-base",
                    isMost && "border-botanical bg-sage/25 text-ink",
                    isLeast && "border-disc-d/60 bg-disc-d-soft/50 text-ink",
                    !isMost && !isLeast &&
                      "border-hairline text-slate hover:border-hairline-strong hover:text-ink",
                    disabled && "opacity-60",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span aria-hidden className="font-mono text-[11px] text-faint">
                      {optionIndex + 1}
                    </span>
                    {option.label}
                  </span>
                  {isMost ? (
                    <span className="shrink-0 rounded-full bg-botanical px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-mineral">
                      Most
                    </span>
                  ) : isLeast ? (
                    <span className="shrink-0 rounded-full bg-disc-d px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-mineral">
                      Least
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="rounded-full px-4 py-2 text-sm text-slate transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-30"
        >
          ← Previous
        </button>

        <Link
          href="/app"
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint transition-colors hover:text-ink"
        >
          Resume later
        </Link>

        <button
          type="button"
          onClick={() =>
            index < total - 1 ? goTo(index + 1) : setConfirming(true)
          }
          disabled={!(answer.most && answer.least)}
          className="rounded-full px-4 py-2 text-sm text-slate transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-30"
        >
          {index < total - 1 ? "Next →" : "Finish"}
        </button>
      </div>
    </div>
  );
}
