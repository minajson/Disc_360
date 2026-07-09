"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { Badge } from "@/components/ui/Badge";
import { DimensionPill } from "@/components/ui/DimensionPill";
import { DiscRadarChart } from "@/components/charts/DiscRadarChart";
import { DimensionBarChart } from "@/components/charts/DimensionBarChart";
import type { DiscScores } from "@/lib/types";

/** Illustrative profile rendered in the live report components. */
const previewScores: DiscScores = { d: 82, i: 64, s: 31, c: 48 };

/**
 * Live preview of the results dashboard, built from the same chart
 * components the real report uses. Motion-ready swap point.
 */
export function ResultPreviewPanel() {
  return (
    <GlassPanel raised className="overflow-hidden p-0">
      {/* report chrome */}
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className="size-2 rounded-full bg-disc-d/60" />
          <span aria-hidden className="size-2 rounded-full bg-disc-i/60" />
          <span aria-hidden className="size-2 rounded-full bg-disc-s/60" />
          <span className="ml-2 font-mono text-xs tracking-wide text-ink-muted">
            results / profile
          </span>
        </div>
        <Badge tone="accent">Sample report</Badge>
      </div>

      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col items-center justify-center gap-2">
          <DiscRadarChart scores={previewScores} className="max-w-[300px]" />
        </div>

        <div className="flex flex-col justify-center gap-6">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
              Archetype
            </span>
            <span className="font-display text-2xl font-bold tracking-tight">
              The Catalyst
            </span>
            <div className="flex items-center gap-2">
              <DimensionPill dimension="D" />
              <DimensionPill dimension="I" />
            </div>
            <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
              Drives outcomes through momentum — direct under pressure,
              persuasive in the room, impatient with slow consensus.
            </p>
          </div>

          <DimensionBarChart scores={previewScores} />
        </div>
      </div>
    </GlassPanel>
  );
}
