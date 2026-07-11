import { GlassPanel } from "@/components/ui/GlassPanel";
import type { ArchetypeInsight } from "@/data/insight-maps";

export function ConflictResponsePanel({
  conflictResponse,
}: {
  conflictResponse: ArchetypeInsight["conflictResponse"];
}) {
  return (
    <GlassPanel className="flex flex-col gap-5 p-7 sm:p-9">
      <div className="flex flex-col gap-2">
        <h3 className="font-display text-xl font-semibold tracking-tight">
          {conflictResponse.headline}
        </h3>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-secondary">
          {conflictResponse.description}
        </p>
      </div>
      <div className="flex flex-col gap-2.5 border-t border-line pt-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
          Handling it better
        </span>
        <ul className="flex flex-col gap-2.5">
          {conflictResponse.tips.map((tip) => (
            <li
              key={tip}
              className="flex items-start gap-3 text-sm leading-relaxed text-ink-secondary"
            >
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
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </GlassPanel>
  );
}
