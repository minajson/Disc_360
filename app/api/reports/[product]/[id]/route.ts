import { loadOwnReport, parseReportProduct } from "@/lib/reports/loader";
import { renderReportPdf } from "@/lib/reports/pdf";
import { logReportExport } from "@/lib/actions/reports";

/**
 * The participant's own report as a PDF.
 *
 * A route handler rather than a server action because the platform requires
 * one to stream a file download. Authorization is `loadOwnReport`, which is
 * the same call the email action makes — the PDF and the emailed attachment
 * therefore cannot diverge in either content or permission.
 *
 * Not found and not yours both answer 404: an id that exists but belongs to
 * someone else must be indistinguishable from one that does not exist.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ product: string; id: string }> },
) {
  const { product: productParam, id } = await params;
  const product = parseReportProduct(productParam);
  if (!product) return new Response("Not found", { status: 404 });

  const report = await loadOwnReport(product, id);
  if (!report) return new Response("Not found", { status: 404 });

  const bytes = renderReportPdf(report.document);
  await logReportExport(product, id);

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // The filename is sanitized to ASCII in `reportFilename`, so it cannot
      // carry a quote, newline or path separator into this header.
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
