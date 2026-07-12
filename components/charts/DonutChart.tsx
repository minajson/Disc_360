"use client";

import { cn } from "@/lib/utils/cn";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

const SIZE = 200;
const RADIUS = 80;
const STROKE = 26;

/** Simple SVG donut with a center total and direct legend. */
export function DonutChart({
  segments,
  centerLabel,
  className,
}: {
  segments: DonutSegment[];
  centerLabel: string;
  className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const circumference = 2 * Math.PI * RADIUS;
  let offset = 0;

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`${centerLabel}: ${segments
          .map((segment) => `${segment.label} ${segment.value}`)
          .join(", ")}`}
        className="w-full max-w-[220px]"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--color-hairline)"
          strokeWidth={STROKE}
        />
        {total > 0
          ? segments.map((segment) => {
              const fraction = segment.value / total;
              const dash = fraction * circumference;
              const element = (
                <circle
                  key={segment.label}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${Math.max(0, dash - 3)} ${circumference - dash + 3}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                />
              );
              offset += dash;
              return element;
            })
          : null}
        <text
          x={SIZE / 2}
          y={SIZE / 2 - 4}
          textAnchor="middle"
          className="font-display"
          fontSize={30}
          fontWeight={600}
          fill="var(--color-ink)"
        >
          {total}
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 18}
          textAnchor="middle"
          className="font-mono"
          fontSize={9}
          letterSpacing="0.14em"
          fill="var(--color-faint)"
        >
          {centerLabel.toUpperCase()}
        </text>
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {segments.map((segment) => (
          <span key={segment.label} className="flex items-center gap-1.5 text-xs text-slate">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: segment.color }} />
            {segment.label}
            <span className="font-mono text-faint">{segment.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
