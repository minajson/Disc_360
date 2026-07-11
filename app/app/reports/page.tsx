import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/guards";
import { insightMap } from "@/data/insight-maps";
import { Eyebrow } from "@/components/ui/Eyebrow";
import type { ArchetypeCode } from "@/lib/types";

export const metadata: Metadata = { title: "Reports" };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default async function ReportsPage() {
  const { supabase, user } = await requireOnboarded();

  const [{ data: results }, { data: exports }] = await Promise.all([
    supabase
      .from("assessment_results")
      .select("id, archetype_code, created_at")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("report_exports")
      .select("id, kind, created_at")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-5 py-12 sm:px-8">
      <div className="flex flex-col gap-2">
        <Eyebrow>Reports</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">Report downloads</h1>
        <p className="max-w-xl text-sm leading-relaxed text-slate">
          Open any report and use Download PDF for a print-quality copy — the
          layout is built for paper as well as the screen.
        </p>
      </div>

      {(results ?? []).length > 0 ? (
        <div className="paper-card divide-y divide-hairline p-0">
          {(results ?? []).map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="flex flex-col">
                <span className="font-display text-sm font-semibold text-ink">
                  {insightMap[row.archetype_code as ArchetypeCode].name}
                </span>
                <span className="text-xs text-faint">{formatDate(row.created_at)}</span>
              </div>
              <Link
                href={`/app/results/${row.id}`}
                className="text-sm font-medium text-botanical hover:underline"
              >
                Open report →
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="paper-card flex flex-col items-start gap-3 p-8">
          <p className="max-w-md text-sm leading-relaxed text-slate">
            Reports appear here after your first completed assessment.
          </p>
          <Link href="/app/assessments" className="text-sm font-medium text-botanical hover:underline">
            Take the assessment →
          </Link>
        </div>
      )}

      {(exports ?? []).length > 0 ? (
        <section className="flex flex-col gap-3" aria-label="Recent exports">
          <h2 className="font-display text-base font-semibold">Recent exports</h2>
          <ul className="flex flex-col gap-1.5">
            {(exports ?? []).map((row) => (
              <li key={row.id} className="font-mono text-xs text-faint">
                {row.kind.replace(/_/g, " ")} · {formatDate(row.created_at)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
