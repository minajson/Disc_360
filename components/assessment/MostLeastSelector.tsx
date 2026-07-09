"use client";

import { AdjectiveOption } from "@/components/assessment/AdjectiveOption";
import type { Question } from "@/lib/types";

export interface Selection {
  most: string | null;
  least: string | null;
}

interface MostLeastSelectorProps {
  question: Question;
  selection: Selection;
  onSelectMost: (optionId: string) => void;
  onSelectLeast: (optionId: string) => void;
}

export function MostLeastSelector({
  question,
  selection,
  onSelectMost,
  onSelectLeast,
}: MostLeastSelectorProps) {
  return (
    <div role="group" aria-label="Choose most and least like you" className="flex flex-col gap-3">
      {question.options.map((option) => (
        <AdjectiveOption
          key={option.id}
          label={option.label}
          isMost={selection.most === option.id}
          isLeast={selection.least === option.id}
          onSelectMost={() => onSelectMost(option.id)}
          onSelectLeast={() => onSelectLeast(option.id)}
        />
      ))}
    </div>
  );
}
