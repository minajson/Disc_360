"use client";

import { useState } from "react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { insightMap } from "@/data/insight-maps";
import {
  DIMENSION_KEY,
  DIMENSIONS,
  type Dimension,
  type TeamMember,
} from "@/lib/types";

const SIZE = 520;
const PAD = 56;
const PLOT = SIZE - PAD * 2;

/**
 * Position members on the DISC plane:
 * x — task-focused (left) vs people-focused (right)
 * y — fast-paced (top) vs reflective (bottom)
 * Quadrants: D top-left, I top-right, S bottom-right, C bottom-left.
 */
function positionFor(member: TeamMember): { x: number; y: number } {
  const { d, i, s, c } = member.normalized;
  const people = (i + s - d - c) / 2; // −100 … +100
  const pace = (d + i - s - c) / 2;
  return {
    x: PAD + ((people + 100) / 200) * PLOT,
    y: PAD + ((100 - pace) / 200) * PLOT,
  };
}

const primaryOf = (member: TeamMember): Dimension =>
  member.archetypeCode === "BAL"
    ? ([...DIMENSIONS].sort(
        (a, b) =>
          member.normalized[DIMENSION_KEY[b]] -
          member.normalized[DIMENSION_KEY[a]],
      )[0] as Dimension)
    : (member.archetypeCode[0] as Dimension);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

const quadrantLabels = [
  { dim: "D" as const, x: PAD + PLOT * 0.25, y: PAD - 24 },
  { dim: "I" as const, x: PAD + PLOT * 0.75, y: PAD - 24 },
  { dim: "C" as const, x: PAD + PLOT * 0.25, y: SIZE - PAD + 32 },
  { dim: "S" as const, x: PAD + PLOT * 0.75, y: SIZE - PAD + 32 },
];

const dimLabel: Record<Dimension, string> = {
  D: "Dominant",
  I: "Influence",
  S: "Stable",
  C: "Analytical",
};

/**
 * Team scatter across the DISC quadrants. Motion-ready swap point:
 * the members-in, positions-out contract stays stable if internals
 * become a 3D scene.
 */
export function TeamQuadrantMap({ members }: { members: TeamMember[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = members.find((m) => m.id === activeId) ?? null;

  return (
    <GlassPanel className="relative p-5 sm:p-8">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Team members positioned across the four DISC quadrants"
        className="w-full"
      >
        {/* plot frame */}
        <rect
          x={PAD}
          y={PAD}
          width={PLOT}
          height={PLOT}
          rx={16}
          fill="rgba(255,255,255,0.02)"
          stroke="rgba(255,255,255,0.08)"
        />
        {/* quadrant dividers */}
        <line
          x1={SIZE / 2}
          y1={PAD}
          x2={SIZE / 2}
          y2={SIZE - PAD}
          stroke="rgba(255,255,255,0.08)"
          strokeDasharray="3 5"
        />
        <line
          x1={PAD}
          y1={SIZE / 2}
          x2={SIZE - PAD}
          y2={SIZE / 2}
          stroke="rgba(255,255,255,0.08)"
          strokeDasharray="3 5"
        />

        {/* quadrant labels */}
        {quadrantLabels.map((label) => (
          <text
            key={label.dim}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            fontSize={12}
            className="font-mono"
            fill={`var(--color-disc-${label.dim.toLowerCase()})`}
          >
            {dimLabel[label.dim]}
          </text>
        ))}

        {/* axis captions */}
        <text x={PAD - 34} y={SIZE / 2} textAnchor="middle" fontSize={10} fill="var(--color-ink-muted)" transform={`rotate(-90 ${PAD - 34} ${SIZE / 2})`} className="font-mono">
          reflective ← pace → fast
        </text>
        <text x={SIZE / 2} y={SIZE - 10} textAnchor="middle" fontSize={10} fill="var(--color-ink-muted)" className="font-mono">
          task-focused ← orientation → people-focused
        </text>

        {/* members */}
        {members.map((member) => {
          const { x, y } = positionFor(member);
          const primary = primaryOf(member);
          const color = `var(--color-disc-${primary.toLowerCase()})`;
          const isActive = activeId === member.id;
          return (
            <g
              key={member.id}
              tabIndex={0}
              role="button"
              aria-label={`${member.displayName}, ${member.roleTitle}, ${insightMap[member.archetypeCode].name}`}
              onMouseEnter={() => setActiveId(member.id)}
              onMouseLeave={() => setActiveId(null)}
              onFocus={() => setActiveId(member.id)}
              onBlur={() => setActiveId(null)}
              className="cursor-pointer outline-none"
            >
              {/* generous hit target */}
              <circle cx={x} cy={y} r={22} fill="transparent" />
              <circle
                cx={x}
                cy={y}
                r={isActive ? 16 : 13}
                fill={color}
                fillOpacity={0.16}
                stroke={color}
                strokeWidth={2}
                style={{ transition: "r 150ms ease" }}
              />
              <text
                x={x}
                y={y + 3.5}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fill="var(--color-ink)"
                className="pointer-events-none font-mono"
              >
                {initials(member.displayName)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* tooltip */}
      <div
        aria-live="polite"
        className="pointer-events-none absolute inset-x-5 bottom-5 flex justify-center sm:inset-x-8 sm:bottom-8"
      >
        {active ? (
          <div className="glass-panel glass-panel-raised flex items-center gap-4 rounded-2xl px-5 py-3">
            <span className="font-display text-sm font-semibold text-ink">
              {active.displayName}
            </span>
            <span className="text-xs text-ink-muted">{active.roleTitle}</span>
            <span className="font-mono text-xs text-accent">
              {insightMap[active.archetypeCode].name}
            </span>
          </div>
        ) : (
          <span className="font-mono text-[11px] text-ink-muted">
            Hover or focus a member to inspect
          </span>
        )}
      </div>
    </GlassPanel>
  );
}
