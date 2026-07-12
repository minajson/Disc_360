import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { BrandMark } from "@/components/marketing/BrandMark";
import { DimensionMark } from "@/components/ui/DimensionMark";
import { LinkButton } from "@/components/ui/LinkButton";
import { DiscRadarChart } from "@/components/charts/DiscRadarChart";
import { DimensionBarChart } from "@/components/charts/DimensionBarChart";
import { insightMap } from "@/data/insight-maps";
import { displayArchetypeCode } from "@/lib/utils/display";
import type { ArchetypeCode, Dimension } from "@/lib/types";

export const metadata: Metadata = {
  title: "Shared profile",
  robots: { index: false, follow: false },
};

export default async function SharedResultPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!z.uuid().safeParse(token).success) notFound();

  // Service role: the unguessable token IS the authorization for this
  // deliberately name-free, read-only summary.
  const admin = createSupabaseAdminClient();
  const { data: result } = await admin
    .from("assessment_results")
    .select("archetype_code, score_d, score_i, score_s, score_c, primary_dimension, secondary_dimension, created_at")
    .eq("share_token", token)
    .maybeSingle();
  if (!result) notFound();

  const code = result.archetype_code as ArchetypeCode;
  const insight = insightMap[code];
  const scores = { d: result.score_d, i: result.score_i, s: result.score_s, c: result.score_c };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-[72px] w-full max-w-4xl items-center justify-between px-5 sm:px-8">
        <BrandMark />
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
          Shared profile
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-5 py-10 sm:px-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-teal">
            DISC360 profile · {displayArchetypeCode(code)}
          </span>
          <h1 className="font-display text-h1 font-semibold">{insight.name}</h1>
          <p className="text-lead text-slate">{insight.tagline}</p>
          <div className="flex gap-2">
            <DimensionMark dimension={result.primary_dimension as Dimension} />
            {result.secondary_dimension ? (
              <DimensionMark dimension={result.secondary_dimension as Dimension} />
            ) : null}
          </div>
        </div>

        <div className="paper-card grid gap-8 p-7 sm:grid-cols-2 sm:items-center sm:p-9">
          <DiscRadarChart scores={scores} className="mx-auto max-w-[280px]" />
          <div className="flex flex-col gap-5">
            <DimensionBarChart scores={scores} />
            <p className="text-sm leading-relaxed text-slate">{insight.summary}</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 text-center">
          <p className="max-w-md text-sm text-slate">
            Curious about your own profile? The assessment takes about seven
            minutes and is free.
          </p>
          <LinkButton href="/sign-up">Take the assessment</LinkButton>
          <Link href="/" className="text-xs text-faint hover:text-ink">
            About DISC360
          </Link>
        </div>
      </main>
    </div>
  );
}
