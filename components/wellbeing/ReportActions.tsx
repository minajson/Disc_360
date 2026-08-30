"use client";

import { useState, useTransition } from "react";
import { emailMyWellbeingReport } from "@/lib/actions/wellbeing";

/**
 * Download, and the opt-in email.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE OUTCOME SHOWN IS THE OUTCOME THAT HAPPENED.
 *
 * A message that was recorded but never dispatched — no provider key, or a
 * real address outside production — reports as NOT delivered, with the
 * download still offered. "Your report has been sent" in front of somebody
 * whose report is not coming is the one failure this control must not have,
 * and it is why the server action returns the provider's own verdict rather
 * than the fact that a request was accepted.
 *
 * Success names the address, masked. "Sent" without a destination leaves
 * somebody wondering which of their addresses it went to, and the masked form
 * answers that without printing an email address onto a screen that may be
 * projected or shoulder-read.
 *
 * DOUBLE-TAP. The button is disabled for as long as a send is in flight, so a
 * second tap on a slow connection cannot queue a second message.
 * ─────────────────────────────────────────────────────────────────────
 */
export function ReportActions({ resultId }: { resultId: string }) {
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<{
    ok: boolean;
    message: string;
    maskedRecipient?: string;
  } | null>(null);

  function sendReport() {
    setOutcome(null);
    startTransition(async () => {
      const result = await emailMyWellbeingReport(resultId);
      setOutcome(result);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <a
          href={`/api/wellbeing/report/${resultId}`}
          className="pulse-focus rounded-full bg-pulse px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pulse-deep"
        >
          Download my report
        </a>
        <button
          type="button"
          onClick={sendReport}
          disabled={pending}
          className="pulse-focus rounded-full border border-[rgba(31,78,95,0.24)] px-5 py-2.5 text-sm font-medium text-pulse transition-colors hover:border-pulse disabled:opacity-60"
        >
          {pending ? "Sending…" : outcome?.ok ? "Send it again" : "Email my report"}
        </button>
      </div>

      {outcome && (
        <div role="status" className="flex flex-col gap-2">
          <p className={`text-sm ${outcome.ok ? "text-pulse" : "text-pulse-watch"}`}>
            {outcome.ok && outcome.maskedRecipient
              ? `Report sent. We've sent a copy to ${outcome.maskedRecipient}.`
              : outcome.message}
          </p>
          {!outcome.ok && (
            <button
              type="button"
              onClick={sendReport}
              disabled={pending}
              className="pulse-focus w-fit rounded-full border border-hairline px-4 py-2 text-xs font-medium text-slate transition-colors hover:text-pulse-deep disabled:opacity-60"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
