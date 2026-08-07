import Link from "next/link";
import { DownloadPdfLink } from "@/components/report/DownloadPdfLink";
import { EmailReportControl } from "@/components/report/EmailReportControl";
import { REPORT_BUTTON_PRIMARY } from "@/components/report/styles";
import type { ReportProduct } from "@/lib/reports/identity";

interface CompletionActionsProps {
  product: ReportProduct;
  reportId: string;
  /** Canonical web location of the full individual report. */
  resultHref: string;
  maskedEmail: string;
  hasAccountEmail: boolean;
}

/**
 * One primary way forward and two secondary ones. Stacked and full-width on a
 * phone — most people finish an assessment on the device in their hand, and
 * the download and email actions have to be reachable without scrolling past
 * a hero.
 */
export function CompletionActions({
  product,
  reportId,
  resultHref,
  maskedEmail,
  hasAccountEmail,
}: CompletionActionsProps) {
  const pdfHref = `/api/reports/${product}/${reportId}`;

  return (
    <div className="flex flex-col gap-3">
      <Link href={resultHref} className={`${REPORT_BUTTON_PRIMARY} w-full sm:w-auto sm:self-start`}>
        View my results
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <DownloadPdfLink href={pdfHref} className="w-full sm:w-auto" />
        <EmailReportControl
          product={product}
          reportId={reportId}
          maskedEmail={maskedEmail}
          hasAccountEmail={hasAccountEmail}
          pdfHref={pdfHref}
          className="w-full sm:w-auto"
        />
      </div>
    </div>
  );
}
