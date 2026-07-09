"use client";

import {
  MostLeastSelector,
  type Selection,
} from "@/components/assessment/MostLeastSelector";
import type { Question } from "@/lib/types";

interface QuestionCardProps {
  question: Question;
  selection: Selection;
  onSelectMost: (optionId: string) => void;
  onSelectLeast: (optionId: string) => void;
}

export function QuestionCard({
  question,
  selection,
  onSelectMost,
  onSelectLeast,
}: QuestionCardProps) {
  const nextPick =
    selection.most === null
      ? "Pick the behavior MOST like you"
      : selection.least === null
        ? "Now pick the behavior LEAST like you"
        : "Answer saved — moving on";

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2 text-center">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {question.prompt}
        </h2>
        <p aria-live="polite" className="font-mono text-xs uppercase tracking-[0.14em] text-ink-muted">
          {nextPick}
        </p>
      </div>

      <MostLeastSelector
        question={question}
        selection={selection}
        onSelectMost={onSelectMost}
        onSelectLeast={onSelectLeast}
      />
    </div>
  );
}
