"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSIONS } from "@/lib/types";
import type { HeatMap } from "@/lib/insights/analytics";

/**
 * Group × dimension heat map on the light canvas.
 *
 * Colour comes from the DISC identifiers only — each column is tinted with
 * its own dimension colour and intensity rides the alpha channel, so the grid
 * stays inside the palette and a colour never means two things. The numeric
 * value is printed in every cell, so the chart is readable without relying on
 * colour discrimination at all.
 */

interface HeatMapGridProps {
  heat: HeatMap;
  /** Column header for the group axis, e.g. "Department". */
  groupLabel: string;
  className?: string;
}

export function HeatMapGrid({ heat, groupLabel, className }: HeatMapGridProps) {
  const [active, setActive] = useState<string | null>(null);

  if (heat.groups.length === 0) {
    return (
      <p className={cn("text-sm text-slate", className)}>
        No completed profiles to map yet.
      </p>
    );
  }

  const cellFor = (group: string, dimension: (typeof DIMENSIONS)[number]) =>
    heat.cells.find((cell) => cell.group === group && cell.dimension === dimension);

  return (
    <div className={cn("overflow-x-auto", className)}>
      {/* Fixed layout so the four dimension columns stay equal and the label
          column cannot stretch the grid apart on wide screens. */}
      <table className="w-full min-w-105 table-fixed border-separate border-spacing-1 text-left">
        <caption className="sr-only">
          Average DISC intensity by {groupLabel.toLowerCase()}, {heat.min} to {heat.max}
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="w-[32%] px-2 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-faint"
            >
              {groupLabel}
            </th>
            {DIMENSIONS.map((dim) => (
              <th
                key={dim}
                scope="col"
                className="px-2 pb-1 text-center font-mono text-[10px] font-medium uppercase tracking-[0.16em]"
                style={{ color: `var(--color-disc-${dim.toLowerCase()})` }}
              >
                {dimensionMeta[dim].displayCode}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heat.groups.map((group) => (
            <tr
              key={group}
              onMouseEnter={() => setActive(group)}
              onMouseLeave={() => setActive(null)}
            >
              <th
                scope="row"
                className={cn(
                  "max-w-40 truncate px-2 py-1 text-sm font-medium transition-colors",
                  active === group ? "text-ink" : "text-slate",
                )}
                title={group}
              >
                {group}
              </th>
              {DIMENSIONS.map((dim) => {
                const cell = cellFor(group, dim);
                const intensity = cell?.intensity ?? 0;
                return (
                  <td key={dim} className="p-0">
                    <div
                      className="flex h-11 items-center justify-center rounded-lg border border-hairline font-mono text-xs text-ink transition-transform duration-150"
                      style={{
                        // 0.10 floor keeps an empty-looking cell legible as a
                        // cell rather than as a hole in the grid.
                        background: `color-mix(in srgb, var(--color-disc-${dim.toLowerCase()}) ${Math.round(
                          10 + intensity * 55,
                        )}%, var(--color-paper))`,
                        transform: active === group ? "scale(1.03)" : undefined,
                      }}
                    >
                      {cell?.value ?? "—"}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-2 pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
        Intensity {heat.min}–{heat.max} · deeper is stronger
      </p>
    </div>
  );
}
