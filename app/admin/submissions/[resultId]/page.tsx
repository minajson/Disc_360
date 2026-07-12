import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { resendReportEmail } from "@/lib/actions/admin";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DimensionMark } from "@/components/ui/DimensionMark";
import { DiscRadarChart } from "@/components/charts/DiscRadarChart";
import { DimensionBarChart } from "@/components/charts/DimensionBarChart";
import { insightMap } from "@/data/insight-maps";
import { displayArchetypeCode } from "@/lib/utils/display";
import type { ArchetypeCode, Dimension } from "@/lib/types";

export const metadata: Metadata = { title: "Submission · Admin" };

export default async function AdminSubmissionDetailPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  await requireSuperAdmin();
  const { resultId } = await params;
  const admin = createSupabaseAdminClient();

  // Authorized detail view: the computed summary — never raw answers.
  const { data: result } = await admin
    .from("assessment_results")
    .select(
      "id, archetype_code, score_d, score_i, score_s, score_c, primary_dimension, secondary_dimension, created_at, profiles (email, full_name)",
    )
    .eq("id", resultId)
    .maybeSingle();
  if (!result) notFound();

  const profile = Array.isArray(result.profiles) ? result.profiles[0] : result.profiles;
  const code = result.archetype_code as ArchetypeCode;
  const scores = {
    d: result.score_d,
    i: result.score_i,
    s: result.score_s,
    c: result.score_c,
  };

  const { data: reportEmails } = await admin
    .from("notification_logs")
    .select("status, created_at")
    .eq("template", "report_ready")
    .eq("email", profile?.email ?? "")
    .order("created_at", { ascending: false })
    .limit(3);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Submission</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">
          {insightMap[code].name}
        </h1>
        <p className="font-mono text-xs text-faint">
          {profile?.full_name} · {profile?.email} ·{" "}
          {new Date(result.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="paper-card grid gap-8 p-7 sm:grid-cols-[0.8fr_1.2fr] sm:items-center">
        <DiscRadarChart scores={scores} className="mx-auto max-w-[260px]" />
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-faint">
              {displayArchetypeCode(code)}
            </span>
            <DimensionMark dimension={result.primary_dimension as Dimension} />
            {result.secondary_dimension ? (
              <DimensionMark dimension={result.secondary_dimension as Dimension} />
            ) : null}
          </div>
          <DimensionBarChart scores={scores} />
          <p className="text-xs leading-relaxed text-faint">
            Raw assessment answers are not exposed in administration views —
            this summary is what the participant&rsquo;s report is built from.
          </p>
        </div>
      </div>

      <div className="paper-card flex flex-wrap items-center gap-4 p-6">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Report delivery
          </span>
          {(reportEmails ?? []).length > 0 ? (
            <span className="text-sm text-slate">
              Last: {reportEmails![0]!.status} ·{" "}
              {new Date(reportEmails![0]!.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          ) : (
            <span className="text-sm text-slate">Never emailed</span>
          )}
        </div>
        <form action={resendReportEmail.bind(null, result.id)} className="ml-auto">
          <button
            type="submit"
            className="rounded-full bg-botanical px-5 py-2 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
          >
            Resend report email
          </button>
        </form>
      </div>
    </div>
  );
}
