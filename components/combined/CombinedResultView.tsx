"use client";

import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import { displayArchetypeCode } from "@/lib/utils/display";
import { DiscRadarChart } from "@/components/charts/DiscRadarChart";
import { FocusResultView, type FocusResultData } from "@/components/focus/FocusResultView";
import type { ArchetypeCode, Dimension, DiscScores } from "@/lib/types";
import type { CombinedInsights } from "@/lib/insights/combined";

export interface CombinedDiscData {
  scores: DiscScores;
  primary: Dimension;
  secondary: Dimension | null;
  archetypeCode: ArchetypeCode;
  archetypeName: string;
}

interface CombinedResultViewProps {
  disc: CombinedDiscData;
  focus: FocusResultData;
  insights: CombinedInsights;
  presentation?: boolean;
}

/**
 * The integrated result: the DISC profile, the Focus profile, and the
 * behaviour × attention insights that connect them. Used by the individual
 * combined result page and by presentation mode.
 */
export function CombinedResultView({ disc, focus, insights, presentation = false }: CombinedResultViewProps) {
  return (
    <div className={cn("flex flex-col", presentation ? "gap-12" : "gap-10")}>
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal">
          Combined profile · behaviour × attention
        </span>
        <h1
          className={cn(
            "font-display font-semibold text-ink",
            presentation ? "text-[length:var(--text-display)] leading-[1.02]" : "text-h1",
          )}
        >
          {disc.archetypeName} · {displayArchetypeCode(disc.archetypeCode)}
        </h1>
      </header>

      {/* two lenses side by side */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-4" aria-label="Behaviour profile">
          <h2 className="font-display text-h3 font-semibold text-ink">Behaviour</h2>
          <DiscRadarChart scores={disc.scores} className="mx-auto max-w-[320px]" />
          <div className="flex flex-wrap gap-2">
            {([disc.primary, disc.secondary].filter(Boolean) as Dimension[]).map((dim) => (
              <span
                key={dim}
                className="rounded-full px-3 py-1 text-xs font-medium text-mineral"
                style={{ background: `var(--color-${dimensionMeta[dim].colorVar})` }}
              >
                {dimensionMeta[dim].label}
              </span>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4" aria-label="Attention profile">
          <h2 className="font-display text-h3 font-semibold text-ink">Attention</h2>
          <FocusResultView data={focus} />
        </section>
      </div>

      {/* behaviour × attention */}
      <InsightBlock title="Behaviour × attention" items={insights.interactions} accent="botanical" lead />

      <div className="grid gap-6 sm:grid-cols-2">
        <InsightBlock title="Strengths" items={insights.strengths} accent="disc-s" />
        <InsightBlock title="Possible blind spots" items={insights.blindSpots} accent="disc-d" />
        <InsightBlock title="Communication recommendations" items={insights.communicationRecommendations} accent="disc-i" />
        <InsightBlock title="Focus recommendations" items={insights.focusRecommendations} accent="disc-c" />
      </div>

      <InsightBlock title="Manager & colleague support" items={insights.supportSuggestions} accent="teal" />

      <p className="text-xs leading-relaxed text-faint">
        These are possibilities for reflection, not diagnoses. DISC describes
        behavioural preferences; the Focus Pulse describes attention patterns.
      </p>
    </div>
  );
}

function InsightBlock({
  title,
  items,
  accent,
  lead,
}: {
  title: string;
  items: string[];
  accent: string;
  lead?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-hairline bg-paper p-6">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: `var(--color-${accent})` }}>
        {title}
      </h3>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li
            key={item}
            className={cn("flex items-start gap-3 leading-snug text-ink", lead ? "text-lg" : "text-base")}
          >
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full" style={{ background: `var(--color-${accent})` }} />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
