import { GlassPanel } from "@/components/ui/GlassPanel";
import type { ArchetypeInsight } from "@/data/insight-maps";

/** Coaching recommendation — the profile's growth prescription. */
export function GrowthPanel({ coaching }: { coaching: ArchetypeInsight["coaching"] }) {
  return (
    <GlassPanel glow="accent" className="flex flex-col gap-4 p-7 sm:p-9">
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
        Coaching recommendation
      </span>
      <p className="max-w-3xl font-display text-lg font-medium leading-relaxed tracking-tight text-ink">
        {coaching}
      </p>
    </GlassPanel>
  );
}
