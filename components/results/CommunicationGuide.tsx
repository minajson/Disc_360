import { GlassPanel } from "@/components/ui/GlassPanel";
import type { ArchetypeInsight } from "@/data/insight-maps";

function GuideColumn({
  heading,
  tone,
  items,
}: {
  heading: string;
  tone: "do" | "dont";
  items: string[];
}) {
  const markColor = tone === "do" ? "var(--color-disc-s)" : "var(--color-disc-d)";
  return (
    <GlassPanel className="flex flex-col gap-4 p-6">
      <h3
        className={
          tone === "do"
            ? "font-mono text-xs uppercase tracking-[0.14em] text-disc-s-glow"
            : "font-mono text-xs uppercase tracking-[0.14em] text-disc-d-glow"
        }
      >
        {heading}
      </h3>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-ink-secondary">
            <svg
              viewBox="0 0 16 16"
              className="mt-0.5 size-4 shrink-0"
              fill="none"
              stroke={markColor}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {tone === "do" ? (
                <path d="M3 8.5 6.5 12 13 4.5" />
              ) : (
                <>
                  <path d="M4 4l8 8" />
                  <path d="M12 4l-8 8" />
                </>
              )}
            </svg>
            {item}
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}

/** How to work with this archetype — do / don't columns. */
export function CommunicationGuide({
  communication,
}: {
  communication: ArchetypeInsight["communication"];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GuideColumn heading="Do" tone="do" items={communication.do} />
      <GuideColumn heading="Don't" tone="dont" items={communication.dont} />
    </div>
  );
}
