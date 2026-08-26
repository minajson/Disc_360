import type { InstrumentMetadata } from "@/data/wellbeing-instruments";

/**
 * The instrument and the metric, printed beside the figure.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY EVERY SCORE-BEARING SURFACE CARRIES THIS.
 *
 * WHO-5 reports a transformed 0–100 score. DISC360 Wellbeing reports a 0–100
 * index. Both count upward, so on screen they are two identical-looking
 * numbers produced by different formulas from different questions measuring
 * different things.
 *
 * A caption of "Wellbeing Score 72" is therefore not merely vague — it is
 * wrong about half the time, and there is nothing in the figure to reveal it.
 * The instrument is not decoration here; it is half the meaning of the number.
 *
 *   WHO-5 Well-Being Score        DISC360 Wellbeing Index
 *   72 / 100                      72 / 100
 *
 * Rendered as a single unit so a figure cannot be copied, screenshotted or
 * laid out away from the name of what it measures.
 * ─────────────────────────────────────────────────────────────────────
 */
export function ScoreIdentity({
  instrument,
  value,
  note,
  size = "medium",
}: {
  instrument: InstrumentMetadata;
  /** The figure itself. A string so "—" and percentages are expressible. */
  value: number | string;
  note?: string;
  size?: "small" | "medium" | "large";
}) {
  const figure =
    size === "large"
      ? "font-display text-[clamp(2.4rem,6vw,4.2rem)] leading-[0.95] font-semibold"
      : size === "small"
        ? "font-display text-lg font-semibold"
        : "font-display text-[clamp(1.6rem,4vw,2.1rem)] leading-none font-semibold";

  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
        {instrument.metricName}
      </p>
      <p className={`${figure} text-ink tabular-nums`}>
        {value}
        <span className="ml-1.5 font-mono text-sm font-normal text-faint">
          / {instrument.primaryScoreMax}
        </span>
      </p>
      {note && <p className="text-xs leading-snug text-slate">{note}</p>}
    </div>
  );
}

/**
 * The one-line form, for a chart caption or an axis.
 *
 * Carries the direction as well as the name, because "higher is better" is not
 * guessable: a rising GHQ score and a rising Wellbeing Index mean opposite
 * things about the same workforce.
 */
export function ScoreScaleCaption({
  instrument,
  className = "",
}: {
  instrument: InstrumentMetadata;
  className?: string;
}) {
  return (
    <p className={`font-mono text-[11px] leading-relaxed text-faint ${className}`}>
      {instrument.metricName} · {instrument.primaryScoreMin}–{instrument.primaryScoreMax} ·{" "}
      {instrument.scoreDirection === "higher_is_more_distress"
        ? "higher = more reported distress"
        : "higher = stronger reported wellbeing"}
    </p>
  );
}
