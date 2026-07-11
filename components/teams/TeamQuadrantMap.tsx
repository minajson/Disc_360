"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { TeamMemberProfile } from "@/lib/insights/team";
import type { Dimension } from "@/lib/types";

const SIZE = 520;
const PAD = 56;
const PLOT = SIZE - PAD * 2;

/**
 * Positions on the DISC plane:
 * x — task-focused (left) vs people-focused (right)
 * y — fast-paced (top) vs reflective (bottom)
 * Quadrants: D top-left, I top-right, S bottom-right, C bottom-left.
 */
function positionFor(profile: TeamMemberProfile): { x: number; y: number } {
  const { d, i, s, c } = profile.scores;
  const people = (i + s - d - c) / 2;
  const pace = (d + i - s - c) / 2;
  return {
    x: PAD + ((people + 100) / 200) * PLOT,
    y: PAD + ((100 - pace) / 200) * PLOT,
  };
}

const quadrantLabels: { dim: Dimension; label: string; x: number; y: number }[] = [
  { dim: "D", label: "Dominant", x: PAD + PLOT * 0.25, y: PAD - 20 },
  { dim: "I", label: "Influence", x: PAD + PLOT * 0.75, y: PAD - 20 },
  { dim: "C", label: "Analytical", x: PAD + PLOT * 0.25, y: SIZE - PAD + 30 },
  { dim: "S", label: "Stable", x: PAD + PLOT * 0.75, y: SIZE - PAD + 30 },
];

const initials = (label: string) =>
  label
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

interface TeamQuadrantMapProps {
  profiles: TeamMemberProfile[];
  /** Larger marks + type for the presentation screen. */
  presentation?: boolean;
  className?: string;
}

/** Interactive member map. Swap-point contract: profiles in, scene out. */
export function TeamQuadrantMap({
  profiles,
  presentation = false,
  className,
}: TeamQuadrantMapProps) {
  const [active, setActive] = useState<TeamMemberProfile | null>(null);

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Team members positioned across the four DISC quadrants: ${profiles
          .map((p) => `${p.label} (${p.archetypeName})`)
          .join(", ")}`}
        className="w-full select-none"
      >
        <rect
          x={PAD}
          y={PAD}
          width={PLOT}
          height={PLOT}
          rx={20}
          fill="var(--color-paper)"
          stroke="var(--color-hairline)"
        />
        <line x1={SIZE / 2} y1={PAD} x2={SIZE / 2} y2={SIZE - PAD} stroke="var(--color-hairline)" strokeDasharray="3 5" />
        <line x1={PAD} y1={SIZE / 2} x2={SIZE - PAD} y2={SIZE / 2} stroke="var(--color-hairline)" strokeDasharray="3 5" />

        {quadrantLabels.map(({ dim, label, x, y }) => (
          <text
            key={dim}
            x={x}
            y={y}
            textAnchor="middle"
            fontSize={presentation ? 15 : 12}
            className="font-mono"
            fill={`var(--color-disc-${dim.toLowerCase()})`}
            letterSpacing="0.1em"
          >
            {label.toUpperCase()}
          </text>
        ))}

        <text x={SIZE / 2} y={16} textAnchor="middle" fontSize={10} fill="var(--color-faint)" className="font-mono" letterSpacing="0.16em">
          FAST-PACED
        </text>
        <text x={SIZE / 2} y={SIZE - 6} textAnchor="middle" fontSize={10} fill="var(--color-faint)" className="font-mono" letterSpacing="0.16em">
          REFLECTIVE
        </text>

        {profiles.map((profile) => {
          const { x, y } = positionFor(profile);
          const color = `var(--color-disc-${profile.primary.toLowerCase()})`;
          const soft = `var(--color-disc-${profile.primary.toLowerCase()}-soft)`;
          const isActive = active?.label === profile.label;
          const radius = presentation ? 17 : 14;
          return (
            <g
              key={profile.label}
              tabIndex={0}
              role="button"
              aria-label={`${profile.label}, ${profile.archetypeName}`}
              onMouseEnter={() => setActive(profile)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(profile)}
              onBlur={() => setActive(null)}
              className="cursor-pointer outline-none"
            >
              <circle cx={x} cy={y} r={radius + 8} fill="transparent" />
              <circle
                cx={x}
                cy={y}
                r={isActive ? radius + 3 : radius}
                fill={soft}
                stroke={color}
                strokeWidth={2}
                style={{ transition: "r 150ms ease" }}
              />
              <text
                x={x}
                y={y + 3.5}
                textAnchor="middle"
                fontSize={presentation ? 12 : 10}
                fontWeight={600}
                fill="var(--color-ink)"
                className="pointer-events-none font-mono"
              >
                {initials(profile.label)}
              </text>
            </g>
          );
        })}
      </svg>

      <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center">
        {active ? (
          <div className="rounded-full border border-hairline bg-paper px-5 py-2 shadow-[0_12px_24px_-16px_rgba(23,32,29,0.4)]">
            <span className="text-sm font-medium text-ink">{active.label}</span>
            <span className="ml-2 font-mono text-xs text-teal">{active.archetypeName}</span>
            {active.department ? (
              <span className="ml-2 text-xs text-faint">{active.department}</span>
            ) : null}
          </div>
        ) : (
          <span className="font-mono text-[11px] text-faint">
            Hover or focus a member to inspect
          </span>
        )}
      </div>
    </div>
  );
}
