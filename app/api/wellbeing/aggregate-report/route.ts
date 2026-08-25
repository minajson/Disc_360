import { z } from "zod";
import { loadWellbeingAggregateReport } from "@/lib/wellbeing/aggregate-report";
import { renderReportPdf } from "@/lib/reports/pdf";
import { parseAnalyticsSource } from "@/lib/wellbeing/analytics";
import { isInstrumentKey } from "@/data/wellbeing-instruments";

/**
 * The management aggregate report as a PDF.
 *
 * A route handler because the platform needs one to stream a file. It performs
 * no authorization of its own and no query of its own: the loader calls the
 * same analytics functions the screen calls, and every one of those authorises
 * through `requireWellbeingAnalyst` and suppresses before returning a figure.
 * That is deliberate — an export with its own query is how a PDF ends up
 * publishing what the page withholds.
 *
 * A caller without a wellbeing role in this organisation is refused by that
 * guard, which throws rather than returning an empty document, so there is no
 * path here that produces a file for someone not entitled to one.
 *
 * `private, no-store` keeps an aggregate wellbeing document out of shared
 * caches and out of a browser's back-button history on a shared machine.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("org") ?? "";
  const instrumentParam = url.searchParams.get("instrument") ?? "";
  const source = parseAnalyticsSource(url.searchParams.get("source") ?? undefined);

  if (!z.uuid().safeParse(organizationId).success) {
    return new Response("Not found", { status: 404 });
  }
  if (!isInstrumentKey(instrumentParam)) {
    return new Response("Not found", { status: 404 });
  }

  let report;
  try {
    report = await loadWellbeingAggregateReport(organizationId, instrumentParam, source);
  } catch {
    // The guard refuses by throwing. Answer 404 rather than 403 so that "you
    // may not read this organisation" and "no such organisation" look
    // identical from outside.
    return new Response("Not found", { status: 404 });
  }

  const bytes = renderReportPdf(report.document);

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
