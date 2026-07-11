import { GlassPanel } from "@/components/ui/GlassPanel";
import type { TeamInsight } from "@/lib/insights/team";

const kindStyles: Record<TeamInsight["kind"], { label: string; className: string }> = {
  strength: { label: "Strength", className: "text-disc-s-glow" },
  gap: { label: "Watch out", className: "text-disc-d-glow" },
  balance: { label: "Balance", className: "text-disc-c-glow" },
};

export function TeamInsightsPanel({ insights }: { insights: TeamInsight[] }) {
  return (
    <div className="grid gap-4">
      {insights.map((insight) => {
        const kind = kindStyles[insight.kind];
        return (
          <GlassPanel key={insight.title} className="flex flex-col gap-3 p-6">
            <span
              className={`font-mono text-[11px] uppercase tracking-[0.14em] ${kind.className}`}
            >
              {kind.label}
            </span>
            <h3 className="font-display text-base font-semibold text-ink">
              {insight.title}
            </h3>
            <p className="text-sm leading-relaxed text-ink-secondary">
              {insight.detail}
            </p>
          </GlassPanel>
        );
      })}
    </div>
  );
}
