import { WHO5_SUGGESTED_CUTOFF_PERCENTAGE } from "@/data/who5-items";

/**
 * The WHO-5 score on its own 0–100 scale, with the documented cut-off marked.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT `ScoreScale`.
 *
 * `ScoreScale` is GHQ-shaped, and its shape encodes GHQ's direction: it takes
 * `atOrAbove`, tints the bar with the ATTENTION colour when that is true, and
 * says "At or above the threshold" in its screen-reader line. On GHQ that is
 * right — a higher count is more reported distress.
 *
 * WHO-5 runs the other way. At or above 50 is the unremarkable side, and the
 * noteworthy side is BELOW. Passing a WHO-5 score into `ScoreScale` would
 * therefore paint a participant's strong wellbeing in the attention colour and
 * announce it as being above a screening threshold — the interpretation
 * inverted, in the one place a participant reads about themselves.
 *
 * That inversion is not fixable by renaming a prop. The direction has to be
 * built into the component, so it is.
 *
 * NOT COLOUR ALONE. The score, the maximum, the cut-off and which side the
 * score falls on are all present as text, so the meaning survives greyscale,
 * a screen reader, and colour-blindness.
 * ─────────────────────────────────────────────────────────────────────
 */
export function Who5Scale({
  score,
  cutoff = WHO5_SUGGESTED_CUTOFF_PERCENTAGE,
  rawScore,
  rawMax,
}: {
  /** The transformed 0–100 score. */
  score: number;
  cutoff?: number;
  /** The raw 0–25 total, shown alongside because the publication defines both. */
  rawScore?: number;
  rawMax?: number;
}) {
  const max = 100;
  const belowCutoff = score < cutoff;
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  const cutoffPct = Math.max(0, Math.min(100, (cutoff / max) * 100));

  // Below the cut-off is the side worth a second look, so that is where the
  // quieter attention tone goes. Above it is the ordinary product colour —
  // never a "good/bad" green/red pair, which would read as a verdict.
  const tone = belowCutoff ? "var(--color-pulse-attention)" : "var(--color-pulse)";
  const soft = belowCutoff ? "var(--color-pulse-attention-soft)" : "var(--color-pulse-soft)";

  return (
    <div className="flex flex-col gap-3">
      <p className="sr-only">
        WHO-5 Well-Being Score: {score} out of {max}. Higher scores mean better reported
        wellbeing. Suggested threshold {cutoff}.{" "}
        {belowCutoff ? "This score is below the suggested threshold." : "This score is at or above the suggested threshold."}
      </p>

      <div className="flex items-baseline justify-between gap-4">
        <p className="font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
          WHO-5 Well-Being Score
        </p>
        <p className="font-mono text-[11px] text-faint">Higher is better</p>
      </div>

      <p className="font-display text-[clamp(2.4rem,6vw,4rem)] leading-[0.95] font-semibold text-ink tabular-nums">
        {score}
        <span className="ml-1.5 font-mono text-sm font-normal text-faint">/ {max}</span>
      </p>

      {rawScore !== undefined && rawMax !== undefined && (
        <p className="font-mono text-xs text-slate tabular-nums">
          Raw score {rawScore} / {rawMax} · ×4 gives the 0–100 scale
        </p>
      )}

      <div className="relative mt-1" aria-hidden="true">
        <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: soft }}>
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%`, background: tone }}
          />
        </div>
        {/* The cut-off as a marked line, not as a recolouring of everything
            past it — a band of colour reads as a category, and this is not a
            category. */}
        <div
          className="absolute top-[-4px] bottom-[-4px] w-px bg-ink/45"
          style={{ left: `${cutoffPct}%` }}
        />
      </div>

      <div className="flex justify-between font-mono text-[11px] text-faint tabular-nums">
        <span>0</span>
        <span>Suggested threshold {cutoff}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
