import { GlassPanel } from "@/components/ui/GlassPanel";
import { DiscRadarChart } from "@/components/charts/DiscRadarChart";
import { DimensionBarChart } from "@/components/charts/DimensionBarChart";
import { dimensionMeta } from "@/data/dimension-meta";
import { intensityLabels } from "@/lib/scoring/intensity";
import { DIMENSIONS, type Result } from "@/lib/types";

interface ScoreBreakdownProps {
  result: Result;
}

export function ScoreBreakdown({ result }: ScoreBreakdownProps) {
  return (
    <GlassPanel className="grid gap-10 p-7 sm:p-10 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="flex items-center justify-center">
        <DiscRadarChart scores={result.normalized} className="max-w-[320px]" />
      </div>

      <div className="flex flex-col justify-center gap-7">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            Dimension intensity
          </span>
          <p className="text-sm leading-relaxed text-ink-secondary">
            Normalized scores across all four dimensions. 50 is neutral —
            distance from the midline is how strongly the dimension shapes
            your behavior.
          </p>
        </div>

        <DimensionBarChart scores={result.normalized} />

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DIMENSIONS.map((dim) => (
            <div
              key={dim}
              className="flex flex-col gap-1 rounded-xl border border-line bg-white/[0.03] px-3 py-2.5"
            >
              <dt className="text-xs text-ink-muted">
                {dimensionMeta[dim].label}
              </dt>
              <dd className="font-mono text-xs text-ink">
                {intensityLabels[result.intensity[dim]]}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </GlassPanel>
  );
}
