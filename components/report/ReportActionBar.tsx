"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { DownloadPdfLink } from "@/components/report/DownloadPdfLink";
import { EmailReportControl } from "@/components/report/EmailReportControl";
import { REPORT_BUTTON } from "@/components/report/styles";
import type { ReportProduct } from "@/lib/reports/identity";

interface ReportActionBarProps {
  product: ReportProduct;
  /** Result id for DISC/Focus; combined_session id for the combined report. */
  reportId: string;
  /** `m***@company.com` — resolved server-side; never the full address. */
  maskedEmail: string;
  hasAccountEmail: boolean;
  /**
   * Fully-resolved share URL, built server-side from SITE_URL. Not derived
   * from window.location.origin: the origin the owner happens to be browsing
   * is not necessarily the one other people should receive. DISC only.
   */
  shareUrl?: string;
}

/**
 * The action row above a participant's own report: download the PDF, email it
 * to themselves, and (DISC) copy the name-free share link. Sticky, so on a
 * phone the two actions people came for stay reachable from anywhere in a
 * long report rather than being buried at the bottom.
 */
export function ReportActionBar({
  product,
  reportId,
  maskedEmail,
  hasAccountEmail,
  shareUrl,
}: ReportActionBarProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const pdfHref = `/api/reports/${product}/${reportId}`;

  const share = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("Secure share link copied.");
    } catch {
      setNotice(shareUrl);
    }
    setTimeout(() => setNotice(null), 3000);
  };

  return (
    <div className="sticky top-0 z-30 -mx-5 bg-canvas/92 px-5 py-3 backdrop-blur-sm sm:-mx-8 sm:px-8 print:hidden">
      <div className="flex flex-wrap items-start gap-2">
        <DownloadPdfLink href={pdfHref} />
        <EmailReportControl
          product={product}
          reportId={reportId}
          maskedEmail={maskedEmail}
          hasAccountEmail={hasAccountEmail}
          pdfHref={pdfHref}
          className="max-w-full sm:max-w-md"
        />
        {shareUrl ? (
          <button type="button" onClick={share} className={REPORT_BUTTON}>
            Share
          </button>
        ) : null}
        <Link href="/app" className={cn(REPORT_BUTTON, "ml-auto")}>
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
