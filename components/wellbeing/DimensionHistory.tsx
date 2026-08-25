"use client";

import { useState } from "react";
import { PulseTrend } from "@/components/wellbeing/PulseTrend";
import {
  DISC360_WELLBEING_DIMENSIONS,
  DIMENSION_META,
  type DimensionKey,
} from "@/data/disc360-wellbeing-items";
import {
  DISC_DIMENSION_HISTORY_HEADING,
  DISC_DIMENSION_HISTORY_LEAD,
} from "@/data/disc360-wellbeing-content";
import type { WellbeingHistoryRecord } from "@/lib/wellbeing/queries";

const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

/**
 * Dimension movement over time.
 *
 * One dimension at a time, chosen from a selector. Six lines on one chart is
 * unreadable on a phone and barely better on a laptop — and the question a
 * person actually asks is "how has Recovery & Demand been going?", not "show
 * me every series at once".
 *
 * The selector is a real control on every breakpoint rather than a
 * desktop-only affordance, because the participant journey is phone-first.
 */
export function DimensionHistory({ records }: { records: WellbeingHistoryRecord[] }) {
  const [active, setActive] = useState<DimensionKey>("capacity");

  const points = records
    .map((record) => {
      const dimension = record.dimensions.find((entry) => entry.key === active);
      return dimension
        ? {
            label: monthLabel(record.completedAt),
            score: dimension.index,
            threshold: null,
            atOrAbove: false,
          }
        : null;
    })
    .filter((point): point is NonNullable<typeof point> => point !== null);

  if (points.length < 2) return null;

  return (
    <section className="pulse-card mt-6 flex flex-col gap-5 p-6 sm:p-9">
      <div>
        <h2 className="font-display text-h3 font-semibold">{DISC_DIMENSION_HISTORY_HEADING}</h2>
        <p className="mt-1.5 text-sm text-slate">{DISC_DIMENSION_HISTORY_LEAD}</p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs tracking-[0.12em] text-faint uppercase">Dimension</span>
        <select
          value={active}
          onChange={(event) => setActive(event.target.value as DimensionKey)}
          className="w-full rounded-xl border border-[rgba(31,78,95,0.22)] bg-paper px-4 py-3 text-[0.95rem] text-ink focus:border-pulse focus:outline-none sm:max-w-xs"
        >
          {DISC360_WELLBEING_DIMENSIONS.map((dimension) => (
            <option key={dimension.key} value={dimension.key}>
              {dimension.label}
            </option>
          ))}
        </select>
      </label>

      <PulseTrend max={100} points={points} />
      <p className="text-xs leading-relaxed text-slate">{DIMENSION_META[active].description}</p>
    </section>
  );
}
