"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { emailMyReport, logReportExport } from "@/lib/actions/reports";

interface ReportActionBarProps {
  resultId: string;
  /**
   * Fully-resolved share URL, built server-side from SITE_URL. Not derived
   * from window.location.origin: the origin the owner happens to be browsing
   * is not necessarily the one other people should receive.
   */
  shareUrl: string;
  /** Auto-open the print dialog on mount (dashboard "Download PDF"). */
  autoprint?: boolean;
}

export function ReportActionBar({
  resultId,
  shareUrl,
  autoprint = false,
}: ReportActionBarProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const [emailPending, startEmail] = useTransition();
  const printed = useRef(false);

  useEffect(() => {
    if (!autoprint || printed.current) return;
    printed.current = true;
    void logReportExport(resultId);
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [autoprint, resultId]);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 3000);
  };

  const download = () => {
    void logReportExport(resultId);
    window.print();
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      flash("Secure share link copied.");
    } catch {
      flash(shareUrl);
    }
  };

  const email = () => {
    startEmail(async () => {
      const result = await emailMyReport(resultId);
      flash(result.message);
    });
  };

  const buttonClass =
    "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-hairline bg-paper px-4 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical";

  return (
    <div className="sticky top-16 z-30 -mx-5 bg-canvas/90 px-5 py-3 backdrop-blur-sm sm:-mx-8 sm:px-8 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <a href="#report-sections" className={buttonClass}>
          View details
        </a>
        <button type="button" onClick={download} className={buttonClass}>
          Download PDF
        </button>
        <button
          type="button"
          onClick={email}
          disabled={emailPending}
          className={cn(buttonClass, "disabled:opacity-50")}
        >
          {emailPending ? "Sending…" : "Email report"}
        </button>
        <button type="button" onClick={share} className={buttonClass}>
          Share
        </button>
        <Link href="/app" className={cn(buttonClass, "ml-auto")}>
          Back to dashboard
        </Link>
      </div>
      {notice ? (
        <p role="status" className="pt-2 text-xs text-botanical">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
