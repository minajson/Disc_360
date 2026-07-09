import { GlassPanel } from "@/components/ui/GlassPanel";
import type { ArchetypeInsight } from "@/data/insight-maps";

const columns = [
  { key: "triggers", heading: "Triggers", accent: "text-disc-d-glow" },
  { key: "behaviors", heading: "Under pressure", accent: "text-disc-i-glow" },
  { key: "recovery", heading: "Recovery", accent: "text-disc-s-glow" },
] as const;

export function StressResponsePanel({
  stressResponse,
}: {
  stressResponse: ArchetypeInsight["stressResponse"];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {columns.map((column) => (
        <GlassPanel key={column.key} className="flex flex-col gap-4 p-6">
          <h3
            className={`font-mono text-xs uppercase tracking-[0.14em] ${column.accent}`}
          >
            {column.heading}
          </h3>
          <ul className="flex flex-col gap-3">
            {stressResponse[column.key].map((item) => (
              <li
                key={item}
                className="border-l border-line pl-3 text-sm leading-relaxed text-ink-secondary"
              >
                {item}
              </li>
            ))}
          </ul>
        </GlassPanel>
      ))}
    </div>
  );
}
