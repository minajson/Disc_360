import Link from "next/link";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { DimensionPill } from "@/components/ui/DimensionPill";
import { DiscRadarChart } from "@/components/charts/DiscRadarChart";
import { insightMap } from "@/data/insight-maps";
import type { Result } from "@/lib/types";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export function LatestResultCard({ result }: { result: Result }) {
  const insight = insightMap[result.archetypeCode];

  return (
    <GlassPanel raised className="grid gap-8 p-7 sm:p-8 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="mx-auto flex w-full max-w-[260px] items-center justify-center">
        <DiscRadarChart scores={result.normalized} />
      </div>

      <div className="flex flex-col justify-center gap-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
          Latest profile · {formatDate(result.createdAt)}
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            {insight.name}
          </h2>
          <p className="text-sm text-ink-secondary">{insight.tagline}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DimensionPill dimension={result.primaryDimension} />
          {result.secondaryDimension ? (
            <DimensionPill dimension={result.secondaryDimension} />
          ) : null}
        </div>
        <div>
          <Link
            href={`/results/${result.id}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-accent transition-colors hover:text-ink"
          >
            View full report
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </Link>
        </div>
      </div>
    </GlassPanel>
  );
}
