import type { DimensionAggregate } from "@/lib/wellbeing/analytics";
import type { ScoreDirection } from "@/data/wellbeing-instruments";

/**
 * Sub-scores as bars on a shared scale.
 *
 * The form GHQ-28's four subscales get, and the reason they do not get a
 * radar: they run on a distress direction, where a LARGER enclosed shape would
 * read as a better result. Bars carry no such implication — a longer bar is
 * simply a higher number, and the caption below says which direction that is.
 *
 * Every bar is drawn against the same ceiling, so two subscales of different
 * medians are visually comparable. Drawing each against its own maximum makes
 * every profile look identical, which is the failure mode this replaces.
 */
export function DimensionBars({
  dimensions,
  max,
  direction,
}: {
  dimensions: DimensionAggregate[];
  max: number;
  direction: ScoreDirection;
}) {
  const distress = direction === "higher_is_more_distress";

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col divide-y divide-hairline">
        {dimensions.map((dimension) => (
          <li key={dimension.key} className="flex flex-col gap-2 py-3.5">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-sm font-medium text-ink">{dimension.label}</span>
              <span className="ml-auto font-mono text-xs text-slate tabular-nums">
                median{" "}
                <strong className="font-display text-base text-ink">{dimension.median}</strong>
                <span className="text-faint"> of {max}</span>
              </span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-sand">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${Math.max(1.5, Math.min(100, (dimension.median / max) * 100))}%`,
                  background: distress
                    ? "var(--color-pulse-attention)"
                    : "var(--color-pulse)",
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="font-mono text-[11px] leading-relaxed text-faint">
        {distress
          ? `Each subscale is scored 0–${max} on its own items. A higher figure reports more of what that subscale asks about; it carries no threshold and is not separately interpretable.`
          : `Each dimension is scored 0–${max}. A higher figure reports more of the experience described.`}
      </p>
    </div>
  );
}
