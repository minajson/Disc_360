"use client";

import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSION_KEY, DIMENSIONS, type DiscScores } from "@/lib/types";

const WIDTH = 220;
const HEIGHT = 48;
const PAD = 5;

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

interface TrendSparklinesProps {
  /** Chronological (oldest → newest) score sets. */
  series: DiscScores[];
  className?: string;
}

/** Behavioral change over time — one sparkline per dimension. */
export function TrendSparklines({ series, className }: TrendSparklinesProps) {
  return (
    <div className={cn("grid gap-x-10 gap-y-5 sm:grid-cols-2", className)}>
      {DIMENSIONS.map((dim) => {
        const meta = dimensionMeta[dim];
        const values = series.map((scores) => scores[DIMENSION_KEY[dim]]);
        const latest = values[values.length - 1] ?? 0;
        const first = values[0] ?? 0;
        const delta = latest - first;
        return (
          <div key={dim} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate">{meta.label}</span>
              <span className="font-mono text-xs text-ink">
                {latest}
                <span className={delta >= 0 ? "text-disc-s" : "text-disc-d"}>
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
              aria-label={`${meta.label} over time: ${values.join(", ")}`}
            >
              <line
                x1={PAD}
                x2={WIDTH - PAD}
                y1={HEIGHT / 2}
                y2={HEIGHT / 2}
                stroke="var(--color-hairline)"
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
  );
}
