"use client";

import { LinkButton } from "@/components/ui/LinkButton";
import { logReportExport } from "@/lib/actions/reports";

export function ReportActions({ resultId }: { resultId: string }) {
  const handleDownload = () => {
    void logReportExport(resultId);
    window.print();
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 print:hidden">
      <button
        type="button"
        onClick={handleDownload}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-botanical px-6 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10 3v9M6.5 8.5 10 12l3.5-3.5" />
          <path d="M4 14.5V16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.5" />
        </svg>
        Download PDF
      </button>
      <LinkButton href="/app" variant="outline">
        Back to dashboard
      </LinkButton>
    </div>
  );
}
