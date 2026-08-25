import { DIMENSION_META, type DimensionKey } from "@/data/disc360-wellbeing-items";

export interface DimensionValue {
  key: DimensionKey;
  index: number;
  raw?: number;
}

/**
 * The six-dimension profile.
 *
 * Horizontal bars rather than a radar: a radar with six axes reads as a shape
 * to be judged, invites "my hexagon is smaller than yours", and is unreadable
 * at 320px. Bars on a shared 0–100 scale answer the actual question — which of
 * my own dimensions sat higher and lower over the past two weeks — and stay
 * legible on a phone.
 *
 * One tone throughout. Colouring low bars warm would be a severity band, which
 * V1 does not have and must not imply.
 */
export function DimensionProfile({
  dimensions,
  highlight = [],
}: {
  dimensions: DimensionValue[];
  /** Keys to mark as the participant's own currently higher/lower areas. */
  highlight?: DimensionKey[];
}) {
  return (
    <ul className="flex flex-col gap-4">
      {dimensions.map((dimension) => {
        const meta = DIMENSION_META[dimension.key];
        const marked = highlight.includes(dimension.key);
        return (
          <li key={dimension.key} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-sm font-medium text-ink">{meta.label}</span>
              <span
                className="ml-auto font-mono text-sm tabular-nums"
                style={{ color: "var(--color-pulse-deep)" }}
              >
                {dimension.index}
                <span className="text-faint"> / 100</span>
              </span>
            </div>

            <div
              className="relative h-2.5 overflow-hidden rounded-full bg-pulse-soft/60"
              role="img"
              aria-label={`${meta.label}: ${dimension.index} out of 100`}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${Math.max(dimension.index, 1.5)}%`,
                  background: marked ? "var(--color-pulse-deep)" : "var(--color-pulse)",
                  opacity: marked ? 1 : 0.78,
                }}
              />
            </div>

            <p className="text-xs leading-relaxed text-slate">{meta.description}</p>
          </li>
        );
      })}
    </ul>
  );
}
