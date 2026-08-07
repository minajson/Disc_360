"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils/cn";
import { emailMyIndividualReport } from "@/lib/actions/reports";
import { REPORT_BUTTON, REPORT_BUTTON_PRIMARY } from "@/components/report/styles";
import type { ReportProduct } from "@/lib/reports/identity";

export interface EmailReportControlProps {
  product: ReportProduct;
  /** Result id for DISC/Focus; combined_session id for the combined report. */
  reportId: string;
  /** `m***@company.com` — resolved server-side; never the full address. */
  maskedEmail: string;
  /** False only when the account genuinely carries no address. */
  hasAccountEmail: boolean;
  /** Offered alongside a failure, so a bad send never blocks the download. */
  pdfHref: string;
  className?: string;
}

type Phase = "idle" | "confirm" | "sent" | "failed";

/**
 * "Email My Report", with an explicit confirmation step.
 *
 * Two things this deliberately does not do. It does not fire on the first
 * click: the address is confirmed first, masked, because this screen is
 * routinely on a laptop borrowed for a workshop. And it does not report
 * success optimistically — "Your report has been sent." appears only when the
 * server says the provider accepted the message, so a silent delivery failure
 * cannot read as a delivered report.
 */
export function EmailReportControl({
  product,
  reportId,
  maskedEmail,
  hasAccountEmail,
  pdfHref,
  className,
}: EmailReportControlProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [pending, startEmail] = useTransition();

  const send = () => {
    startEmail(async () => {
      const result = await emailMyIndividualReport({
        product,
        id: reportId,
        ...(hasAccountEmail ? {} : { fallbackEmail: address.trim() }),
      });
      setMessage(result.message);
      setPhase(result.ok ? "sent" : "failed");
    });
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <button
        type="button"
        onClick={() => setPhase(phase === "confirm" ? "idle" : "confirm")}
        aria-expanded={phase === "confirm"}
        className={REPORT_BUTTON}
      >
        Email My Report
      </button>

      {phase === "confirm" ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-hairline bg-paper p-4">
          {hasAccountEmail ? (
            <p className="text-sm leading-relaxed text-ink">
              Send your DISC360 report to{" "}
              <span className="font-mono text-[13px] text-botanical">{maskedEmail}</span>?
            </p>
          ) : (
            <label className="flex flex-col gap-1.5 text-sm text-ink">
              Where should we send your report?
              <input
                type="email"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                className="min-h-11 rounded-xl border border-hairline bg-mineral px-3 text-sm text-ink outline-none focus:border-botanical"
              />
            </label>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={send}
              disabled={pending || (!hasAccountEmail && address.trim().length === 0)}
              className={cn(REPORT_BUTTON_PRIMARY, "disabled:opacity-50")}
            >
              {pending ? "Sending…" : "Send Report"}
            </button>
            <button type="button" onClick={() => setPhase("idle")} className={REPORT_BUTTON}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {phase === "sent" ? (
        <p role="status" className="text-sm text-botanical">
          {message}
        </p>
      ) : null}

      {phase === "failed" ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-2xl border border-disc-d/30 bg-paper p-4"
        >
          <p className="text-sm leading-relaxed text-ink">{message}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={send}
              disabled={pending}
              className={cn(REPORT_BUTTON, "disabled:opacity-50")}
            >
              {pending ? "Retrying…" : "Retry"}
            </button>
            <a href={pdfHref} download className={REPORT_BUTTON}>
              Download PDF
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
