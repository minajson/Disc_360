import { loadOwnWellbeingReport } from "@/lib/wellbeing/report";
import { renderReportPdf } from "@/lib/reports/pdf";
import { logWellbeingExport } from "@/lib/actions/wellbeing";

/**
 * The participant's own Wellbeing Pulse report as a PDF.
 *
 * A route handler rather than a server action because the platform requires
 * one to stream a file. Authorization is `loadOwnWellbeingReport` — the same
 * call the email action makes — so the download and the emailed link cannot
 * diverge in content or in permission.
 *
 * Not found and not yours both answer 404: an id that exists but belongs to
 * someone else must be indistinguishable from one that never existed. That
 * matters more here than anywhere else in the product, because the difference
 * between the two answers would itself disclose that a colleague has completed
 * a wellbeing screening.
 *
 * `private, no-store` keeps the file out of shared caches and out of a
 * browser's back-button history on a shared machine.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resultId: string }> },
) {
  const { resultId } = await params;

  const report = await loadOwnWellbeingReport(resultId);
  if (!report) return new Response("Not found", { status: 404 });

  const bytes = renderReportPdf(report.document);
  await logWellbeingExport(resultId);

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // Sanitized to ASCII in `reportFilename`, so it cannot carry a quote,
      // newline or path separator into this header.
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
