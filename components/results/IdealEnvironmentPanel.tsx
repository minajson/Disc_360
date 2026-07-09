import { GlassPanel } from "@/components/ui/GlassPanel";
import type { ArchetypeInsight } from "@/data/insight-maps";

export function IdealEnvironmentPanel({
  idealEnvironment,
}: {
  idealEnvironment: ArchetypeInsight["idealEnvironment"];
}) {
  return (
    <GlassPanel className="p-7 sm:p-9">
      <ul className="grid gap-x-10 gap-y-3.5 sm:grid-cols-2">
        {idealEnvironment.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-ink-secondary">
            <svg
              viewBox="0 0 16 16"
              className="mt-0.5 size-4 shrink-0"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 8.5 6.5 12 13 4.5" />
            </svg>
            {item}
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
