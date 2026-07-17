"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { emailMyReport } from "@/lib/actions/reports";

interface ResultQuickActionsProps {
  resultId: string;
  /**
   * Fully-resolved share URL, built server-side from SITE_URL. Not derived
   * from window.location.origin: the origin the owner happens to be browsing
   * is not necessarily the one other people should receive.
   */
  shareUrl: string;
}

/** Compact action row for a result card (dashboard, history). */
export function ResultQuickActions({ resultId, shareUrl }: ResultQuickActionsProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 3000);
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      flash("Share link copied.");
    } catch {
      flash(shareUrl);
    }
  };

  const email = () => {
    startTransition(async () => {
      const result = await emailMyReport(resultId);
      flash(result.message);
    });
  };

  const chip =
    "inline-flex min-h-9 items-center rounded-full border border-hairline bg-paper px-3.5 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        <Link
          href={`/app/results/${resultId}`}
          className="inline-flex min-h-9 items-center rounded-full bg-botanical px-4 text-xs font-medium text-mineral transition-colors hover:bg-botanical-deep"
        >
          View details
        </Link>
        <Link href={`/app/results/${resultId}?autoprint=1`} className={chip}>
          Download PDF
        </Link>
        <button type="button" onClick={email} disabled={pending} className={cn(chip, "disabled:opacity-50")}>
          {pending ? "Sending…" : "Email report"}
        </button>
        <button type="button" onClick={share} className={chip}>
          Share
        </button>
      </div>
      {notice ? (
        <p role="status" className="text-xs text-botanical">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
