"use client";

import { useState, useTransition } from "react";
import { emailMyWellbeingReport } from "@/lib/actions/wellbeing";

/**
 * Download, and the opt-in email.
 *
 * The email is never sent because an address exists — it is sent because this
 * button was pressed. And the outcome shown is the outcome that happened: a
 * message that was recorded but never dispatched reports as not delivered,
 * with the download still offered, rather than as a cheerful "sent".
 */
export function ReportActions({ resultId }: { resultId: string }) {
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null);

  function sendReport() {
    setOutcome(null);
    startTransition(async () => {
      const result = await emailMyWellbeingReport(resultId);
      setOutcome({ ok: result.ok, message: result.message });
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
          {pending ? "Sending…" : "Email my report"}
        </button>
      </div>

      {outcome && (
        <p
          role="status"
          className={`text-sm ${outcome.ok ? "text-pulse" : "text-pulse-attention"}`}
        >
          {outcome.message}
        </p>
      )}
    </div>
  );
}
