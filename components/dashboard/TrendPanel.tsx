"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { dimensionMeta } from "@/data/dimension-meta";
import type { HistoryItem } from "@/lib/insights/history";
import { DIMENSION_KEY, DIMENSIONS } from "@/lib/types";

const WIDTH = 220;
const HEIGHT = 48;
const PAD = 4;

function sparkPath(values: number[]): string {
  if (values.length < 2) return "";
  const step = (WIDTH - PAD * 2) / (values.length - 1);
  return values
    .map((value, index) => {
      const x = PAD + index * step;
      const y = PAD + (1 - value / 100) * (HEIGHT - PAD * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

interface TrendPanelProps {
  /** History items in chronological (oldest → newest) order. */
  items: HistoryItem[];
}

/** Per-dimension sparklines across assessment history. */
export function TrendPanel({ items }: TrendPanelProps) {
  return (
    <GlassPanel className="flex flex-col gap-6 p-6 sm:p-7">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-display text-base font-semibold text-ink">
          Dimension trends
        </h3>
        <span className="font-mono text-[11px] text-ink-muted">
          {items.length} assessments
        </span>
      </div>

      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {DIMENSIONS.map((dim) => {
          const meta = dimensionMeta[dim];
          const values = items.map((item) => item.normalized[DIMENSION_KEY[dim]]);
          const latest = values[values.length - 1] ?? 0;
          const first = values[0] ?? 0;
          const delta = latest - first;
          return (
            <div key={dim} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-ink-secondary">{meta.label}</span>
                <span className="font-mono text-xs text-ink">
                  {latest}
                  <span className={delta >= 0 ? "text-disc-s-glow" : "text-disc-d-glow"}>
                    {" "}
                    {delta >= 0 ? "+" : ""}
                    {delta}
                  </span>
                </span>
              </div>
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="h-12 w-full"
                role="img"
                aria-label={`${meta.label} trend: ${values.join(", ")}`}
              >
                <line
                  x1={PAD}
                  x2={WIDTH - PAD}
                  y1={HEIGHT / 2}
                  y2={HEIGHT / 2}
                  stroke="rgba(255,255,255,0.08)"
                  strokeDasharray="2 4"
                />
                <path
                  d={sparkPath(values)}
                  fill="none"
                  stroke={`var(--color-${meta.colorVar})`}
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}
