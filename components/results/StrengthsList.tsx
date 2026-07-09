import { GlassPanel } from "@/components/ui/GlassPanel";
import type { ArchetypeInsight } from "@/data/insight-maps";

export function StrengthsList({
  strengths,
}: {
  strengths: ArchetypeInsight["strengths"];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {strengths.map((strength, index) => (
        <GlassPanel key={strength.title} className="flex flex-col gap-2.5 p-5">
          <span className="font-mono text-xs text-disc-s-glow">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="font-display text-sm font-semibold text-ink">
            {strength.title}
          </h3>
          <p className="text-sm leading-relaxed text-ink-secondary">
            {strength.detail}
          </p>
        </GlassPanel>
      ))}
    </div>
  );
}
