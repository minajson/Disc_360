import { WELLBEING_MAX_SCORE } from "@/lib/scoring/wellbeing";

/**
 * The 0–12 screening score, as one clean scale.
 *
 * Deliberately not a gauge or a dial. A dial implies a range with a good end
 * and a bad end; this is a count of areas a person described as harder than
 * usual, and the scale should read as a scale. The threshold is marked as a
 * line with a label rather than by recolouring everything past it, because the
 * point is "here is where the configured prompt sits", not "you are in the red".
 *
 * Accessibility: the score, the maximum and the threshold all appear as text.
 * Colour marks which cells are filled; it never carries the meaning alone.
 */
export function ScoreScale({
  score,
  threshold,
  atOrAbove,
  label = "GHQ-12 screening score",
}: {
  score: number;
  threshold: number;
  atOrAbove: boolean;
  label?: string;
}) {
  const cells = Array.from({ length: WELLBEING_MAX_SCORE + 1 }, (_, index) => index);
  const tone = atOrAbove ? "var(--color-pulse-attention)" : "var(--color-pulse)";
  const soft = atOrAbove ? "var(--color-pulse-attention-soft)" : "var(--color-pulse-soft)";

  return (
    <figure className="flex flex-col gap-5">
      <figcaption className="sr-only">
        {label}: {score} out of {WELLBEING_MAX_SCORE}. Screening threshold {threshold}.{" "}
        {atOrAbove ? "At or above the threshold." : "Below the threshold."}
      </figcaption>

      <div className="flex items-baseline gap-3">
        <span
          className="font-display text-[clamp(3.4rem,12vw,5rem)] leading-none font-semibold tabular-nums"
          style={{ color: tone }}
        >
          {score}
        </span>
        <span className="font-mono text-lg text-slate">/ {WELLBEING_MAX_SCORE}</span>
      </div>

      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className="flex gap-[3px]">
          {cells.map((cell) => {
            const filled = cell <= score && score > 0;
            const isThreshold = cell === threshold;
            return (
              <div key={cell} className="flex flex-1 flex-col gap-1.5">
                <div
                  className="h-11 rounded-[4px] transition-colors sm:h-14"
                  style={{
                    background: filled ? tone : soft,
                    opacity: filled ? 1 : 0.55,
                    // The threshold cell keeps a visible edge even when unfilled.
                    boxShadow: isThreshold ? `inset 0 0 0 1.5px ${tone}` : undefined,
                  }}
                />
                <span className="text-center font-mono text-[10px] text-slate sm:text-[11px]">
                  {cell}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ background: soft, color: "var(--color-pulse-deep)" }}
        >
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: tone }} />
          Current screening threshold: {threshold}
        </span>
      </p>
    </figure>
  );
}
