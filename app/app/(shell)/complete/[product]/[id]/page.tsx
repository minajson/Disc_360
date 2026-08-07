import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { loadOwnReport, parseReportProduct } from "@/lib/reports/loader";
import { maskEmail } from "@/lib/reports/identity";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { CompletionActions } from "@/components/report/CompletionActions";

export const metadata: Metadata = { title: "Assessment complete" };

/**
 * The screen a participant lands on the moment they submit.
 *
 * It exists so completion has an ending: one obvious way into the full report,
 * and the two things people actually want from a workshop — a PDF and a copy
 * in their inbox — without hunting for them. It is reachable only by the owner
 * of the result, and it never waits on a facilitator.
 */
export default async function AssessmentCompletePage({
  params,
}: {
  params: Promise<{ product: string; id: string }>;
}) {
  const { product: productParam, id } = await params;
  const product = parseReportProduct(productParam);
  if (!product) notFound();

  const { profile } = await requireOnboarded();
  const report = await loadOwnReport(product, id);
  if (!report) notFound();

  const firstName = profile.preferred_name?.trim() || report.document.participantName.split(" ")[0];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-12 sm:px-8 sm:py-20">
      <div className="flex flex-col gap-4">
        <Eyebrow>{report.document.productLabel}</Eyebrow>
        <h1 className="font-display text-h1 font-semibold text-balance text-ink">
          Your assessment is complete{firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="text-lead text-slate">Your individual report is ready.</p>
      </div>

      <div className="paper-card flex flex-col gap-5 p-6 sm:p-8">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            Your profile
          </span>
          <p className="font-display text-h3 font-semibold text-ink">{report.document.headline}</p>
        </div>

        <CompletionActions
          product={product}
          reportId={id}
          resultHref={report.webPath}
          maskedEmail={maskEmail(report.accountEmail)}
          hasAccountEmail={Boolean(report.accountEmail)}
        />
      </div>

      <p className="text-xs leading-relaxed text-faint">{report.document.disclaimer}</p>
    </div>
  );
}
