"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { saveFocusResponse, submitFocusAssessment } from "@/lib/actions/focus";

interface RunnerQuestion {
  id: string;
  index: number;
  prompt: string;
  kind: "single" | "scale";
  options: { id: string; label: string }[];
  scaleMin: number | null;
  scaleMax: number | null;
  scaleMinLabel: string | null;
  scaleMaxLabel: string | null;
}

type AnswerValue = { optionId?: string; scaleValue?: number };

interface FocusRunnerProps {
  sessionId: string;
  startIndex: number;
  questions: RunnerQuestion[];
  initialAnswers: Record<string, AnswerValue>;
}

const ADVANCE_DELAY_MS = 350;

export function FocusRunner({
  sessionId,
  startIndex,
  questions,
  initialAnswers,
}: FocusRunnerProps) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(Math.min(startIndex, questions.length - 1));
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(initialAnswers);
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
  const answer = (question && answers[question.id]) ?? {};
  const isAnswered = (value: AnswerValue | undefined) =>
    Boolean(value && (value.optionId || value.scaleValue));
  const answeredCount = Object.values(answers).filter(isAnswered).length;
  const allAnswered = answeredCount === total;

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  const persist = useCallback(
    (q: RunnerQuestion, value: AnswerValue) => {
      setSaveState("saving");
      startSave(async () => {
        const result = await saveFocusResponse({
          sessionId,
          questionId: q.id,
          optionId: value.optionId,
          scaleValue: value.scaleValue,
          questionIndex: q.index,
        });
        setSaveState(result.ok ? "saved" : "error");
      });
    },
    [sessionId],
  );

  const advance = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      if (index < total - 1) setIndex(index + 1);
      else setConfirming(true);
    }, ADVANCE_DELAY_MS);
  }, [index, total]);

  const record = (value: AnswerValue) => {
    if (!question) return;
    setAnswers((current) => ({ ...current, [question.id]: value }));
    persist(question, value);
    advance();
  };

  const goTo = (next: number) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setIndex(Math.max(0, Math.min(total - 1, next)));
  };

  const handleSubmit = () => {
    setSubmitError(null);
    startSubmit(async () => {
      const result = await submitFocusAssessment(sessionId);
      if (result && !result.ok) setSubmitError(result.error ?? "Please try again.");
    });
  };

  if (confirming) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-center justify-center gap-6 px-5 text-center">
        {submitting ? (
          <>
            <motion.div
              aria-hidden
              className="size-12 rounded-full border-2 border-sage border-t-botanical"
              animate={reduced ? undefined : { rotate: 360 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
            />
            <h1 className="font-display text-h3 font-semibold">Reading your attention pattern…</h1>
          </>
        ) : (
          <>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
              {answeredCount} of {total} answered
            </span>
            <h1 className="font-display text-h3 font-semibold text-balance">
              {allAnswered ? "Ready to see your attention pattern?" : "A question still needs an answer"}
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-slate">
              {allAnswered
                ? "Submitting closes this pulse and builds your Focus profile. Nothing here is a diagnosis."
                : "Head back to answer the remaining question — everything you've chosen is saved."}
            </p>
            {submitError ? (
              <p role="alert" className="text-sm text-disc-d">
                {submitError}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button variant="outline" onClick={() => { setConfirming(false); goTo(allAnswered ? total - 1 : index); }}>
                Review answers
              </Button>
              {allAnswered ? (
                <Button size="lg" onClick={handleSubmit} disabled={submitting}>
                  See my Focus profile
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-10 sm:py-14">
      {/* progress */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-xs text-slate">
            Question <span className="text-ink">{index + 1}</span> of {total}
          </span>
          <span
            aria-live="polite"
            className={cn("font-mono text-[11px]", saveState === "error" ? "text-disc-d" : "text-faint")}
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Autosaved"
                : saveState === "error"
                  ? "Save failed — retrying on your next choice"
                  : "Under 90 seconds"}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={answeredCount}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Focus Pulse progress"
          className="h-1.5 w-full overflow-hidden rounded-full bg-ink/8"
        >
          <div
            className="h-full rounded-full bg-botanical transition-[width] duration-500"
            style={{ width: `${(answeredCount / total) * 100}%` }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={question.id}
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
          transition={{ duration: 0.28, ease: [0.32, 0.94, 0.6, 1] }}
          className="flex flex-col gap-7"
        >
          <h1 className="font-display text-h3 font-semibold text-balance">{question.prompt}</h1>

          {question.kind === "single" ? (
            <div role="group" aria-label={question.prompt} className="flex flex-col gap-2.5">
              {question.options.map((option, optionIndex) => {
                const selected = answer.optionId === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => record({ optionId: option.id })}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-2xl border bg-paper px-5 py-4 text-left text-base font-medium transition-all duration-200",
                      selected
                        ? "border-botanical bg-sage/25 text-ink"
                        : "border-hairline text-slate hover:border-hairline-strong hover:text-ink",
                    )}
                  >
                    <span aria-hidden className="font-mono text-[11px] text-faint">
                      {optionIndex + 1}
                    </span>
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <ScaleControl
              min={question.scaleMin ?? 1}
              max={question.scaleMax ?? 10}
              minLabel={question.scaleMinLabel ?? ""}
              maxLabel={question.scaleMaxLabel ?? ""}
              value={answer.scaleValue}
              onPick={(value) => record({ scaleValue: value })}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="rounded-full px-4 py-2 text-sm text-slate transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-30"
        >
          ← Previous
        </button>
        <Link href="/app" className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint transition-colors hover:text-ink">
          Resume later
        </Link>
        <button
          type="button"
          onClick={() => (index < total - 1 ? goTo(index + 1) : setConfirming(true))}
          disabled={!isAnswered(answer)}
          className="rounded-full px-4 py-2 text-sm text-slate transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-30"
        >
          {index < total - 1 ? "Next →" : "Finish"}
        </button>
      </div>
    </div>
  );
}

function ScaleControl({
  min,
  max,
  minLabel,
  maxLabel,
  value,
  onPick,
}: {
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
  value: number | undefined;
  onPick: (value: number) => void;
}) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label={`Scale from ${min} to ${max}`}
        className="grid grid-cols-5 gap-2 sm:grid-cols-10"
      >
        {values.map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={selected}
              onClick={() => onPick(n)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-xl border font-display text-lg font-semibold transition-all duration-200",
                selected
                  ? "border-botanical bg-botanical text-mineral"
                  : "border-hairline text-slate hover:border-botanical hover:text-botanical",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-slate">
        <span>{min} — {minLabel}</span>
        <span className="text-right">{max} — {maxLabel}</span>
      </div>
    </div>
  );
}
