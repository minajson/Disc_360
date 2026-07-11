import { GlassPanel } from "@/components/ui/GlassPanel";
import type { CommunicationGap } from "@/lib/insights/team";

export function CommunicationGapsPanel({ gaps }: { gaps: CommunicationGap[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {gaps.map((gap) => (
        <GlassPanel key={gap.between.join("-")} className="flex flex-col gap-4 p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-semibold text-ink">
              {gap.between[0]}
            </span>
            <svg
              viewBox="0 0 24 12"
              className="h-3 w-6 shrink-0"
              fill="none"
              stroke="var(--color-ink-muted)"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M2 6h20M18 2l4 4-4 4M6 2 2 6l4 4" />
            </svg>
            <span className="font-display text-sm font-semibold text-ink">
              {gap.between[1]}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-ink-secondary">
            {gap.friction}
          </p>
          <div className="flex flex-col gap-1.5 border-t border-line pt-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
              The bridge
            </span>
            <p className="text-sm leading-relaxed text-ink-secondary">
              {gap.bridge}
            </p>
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}
