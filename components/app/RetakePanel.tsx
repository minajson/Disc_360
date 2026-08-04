"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { startAssessment } from "@/lib/actions/assessment";
import { Button } from "@/components/ui/Button";

/**
 * Retake confirmation.
 *
 * A participant who already holds a completed result has to pass through this
 * before another attempt starts, so "start again" can never be mistaken for
 * "redo the one I have". The notice states plainly that the earlier result is
 * kept, and the reason travels with the new attempt so the history entry can
 * explain itself later.
 */

const REASONS = [
  { value: "new_role", label: "New role" },
  { value: "new_team", label: "New team" },
  { value: "annual_reassessment", label: "Annual reassessment" },
  { value: "leadership_programme", label: "Leadership programme" },
  { value: "personal_review", label: "Personal review" },
  { value: "other", label: "Other" },
] as const;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export function RetakePanel({
  lastCompletedAt,
  teamId,
}: {
  lastCompletedAt: string;
  teamId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("annual_reassessment");
  const [note, setNote] = useState("");

  if (!open) {
    return (
      <div className="paper-card flex flex-col items-start gap-3 p-7">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
          Take it again
        </span>
        <p className="max-w-xl text-sm leading-relaxed text-slate">
          You already completed this assessment on{" "}
          <span className="font-medium text-ink">{formatDate(lastCompletedAt)}</span>.
          Starting again will create a new result and preserve your earlier
          result.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-hairline-strong px-5 py-2 text-sm font-medium text-ink transition-colors hover:border-botanical hover:text-botanical"
        >
          Start a new assessment
        </button>
      </div>
    );
  }

  return (
    <form action={startAssessment} className="paper-card flex flex-col gap-5 p-7">
      {teamId ? <input type="hidden" name="team_id" value={teamId} /> : null}

      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
          New assessment
        </span>
        <p className="max-w-xl text-sm leading-relaxed text-slate">
          Your result from {formatDate(lastCompletedAt)} stays in your history
          and remains readable. This creates a separate, new result.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="pb-2 text-sm font-medium text-ink">
          What prompted this reassessment?
        </legend>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                "cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors",
                reason === option.value
                  ? "border-botanical bg-sage/25 text-botanical"
                  : "border-hairline text-slate hover:border-botanical hover:text-botanical",
              )}
            >
              <input
                type="radio"
                name="retake_reason"
                value={option.value}
                checked={reason === option.value}
                onChange={(event) => setReason(event.target.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">
          Context <span className="font-normal text-faint">(optional)</span>
        </span>
        <input
          type="text"
          name="retake_note"
          value={note}
          onChange={(event) => setNote(event.target.value.slice(0, 280))}
          placeholder="e.g. moved into the platform team"
          maxLength={280}
          className="w-full rounded-full border border-hairline bg-mineral px-4 py-2.5 text-sm text-ink placeholder:text-faint focus:border-botanical focus:outline-none"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">Start the assessment</Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate transition-colors hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
