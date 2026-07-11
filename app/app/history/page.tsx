import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/guards";
import { insightMap } from "@/data/insight-maps";
import { displayArchetypeCode } from "@/lib/utils/display";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ResultGlyph } from "@/components/charts/ResultGlyph";
import { TrendSparklines } from "@/components/app/TrendSparklines";
import type { ArchetypeCode } from "@/lib/types";

export const metadata: Metadata = { title: "History" };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default async function HistoryPage() {
  const { supabase, user } = await requireOnboarded();

  const { data: results } = await supabase
    .from("assessment_results")
    .select("id, score_d, score_i, score_s, score_c, archetype_code, created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  const items = results ?? [];
  const chronological = [...items].reverse().map((row) => ({
    d: row.score_d,
    i: row.score_i,
    s: row.score_s,
    c: row.score_c,
  }));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-5 py-12 sm:px-8">
      <div className="flex flex-col gap-2">
        <Eyebrow>History</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">
          Your profiles over time
        </h1>
        <p className="text-sm text-slate">
          {items.length} completed assessment{items.length === 1 ? "" : "s"}
        </p>
      </div>

      {items.length >= 2 ? (
        <section className="paper-card flex flex-col gap-6 p-7" aria-label="Behavioral change over time">
          <h2 className="font-display text-base font-semibold">
            Behavioral change over time
          </h2>
          <TrendSparklines series={chronological} />
        </section>
      ) : null}

      {items.length > 0 ? (
        <div className="paper-card divide-y divide-hairline p-0">
          {items.map((row) => {
            const code = row.archetype_code as ArchetypeCode;
            return (
              <div key={row.id} className="flex items-center gap-5 px-6 py-4">
                <ResultGlyph
                  scores={{ d: row.score_d, i: row.score_i, s: row.score_s, c: row.score_c }}
                  size={40}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-display text-sm font-semibold text-ink">
                    {insightMap[code].name}
                  </span>
                  <span className="font-mono text-[11px] text-faint">
                    {displayArchetypeCode(code)} · {formatDate(row.created_at)}
                  </span>
                </div>
                <Link
                  href={`/app/results/${row.id}`}
                  className="text-sm font-medium text-botanical hover:underline"
                >
                  Report →
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="paper-card flex flex-col items-start gap-3 p-8">
          <p className="max-w-md text-sm leading-relaxed text-slate">
            No completed assessments yet — your history builds here after your
            first profile.
          </p>
          <Link href="/app/assessments" className="text-sm font-medium text-botanical hover:underline">
            Take the assessment →
          </Link>
        </div>
      )}
    </div>
  );
}
