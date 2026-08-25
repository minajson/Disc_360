import { DISC_INDEX_LABEL } from "@/data/disc360-wellbeing-content";

/**
 * The Wellbeing Index, 0–100.
 *
 * Deliberately a plain scale with no marker, no band and no zone. V1 is not
 * psychometrically validated, so any line drawn across this track — a target,
 * a cut-off, a colour change at 50 — would be a product invention that reads
 * as a finding. The number, the scale it sits on, and nothing else.
 *
 * The fill uses one calm tone at full length regardless of value: a bar that
 * turns warmer as it shortens would be a severity band by another name.
 */
export function IndexHero({
  index,
  rawScore,
  rawMax,
}: {
  index: number;
  rawScore: number;
  rawMax: number;
}) {
  return (
    <figure className="flex flex-col gap-5">
      <figcaption className="sr-only">
        {DISC_INDEX_LABEL}: {index} out of 100, from {rawScore} of {rawMax} points across twelve
        questions.
      </figcaption>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className="font-display text-[clamp(3.4rem,13vw,5.2rem)] leading-none font-semibold tabular-nums"
          style={{ color: "var(--color-pulse)" }}
        >
          {index}
        </span>
        <span className="font-mono text-lg text-slate">/ 100</span>
        <span className="ml-auto text-xs tracking-[0.14em] text-faint uppercase">
          {DISC_INDEX_LABEL}
        </span>
      </div>

      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className="relative h-3 overflow-hidden rounded-full bg-pulse-soft/70">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${Math.max(index, 1.5)}%`,
              background: "var(--color-pulse)",
            }}
          />
        </div>
        <div className="flex justify-between font-mono text-[11px] text-faint">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      <p className="font-mono text-xs text-slate">
        {rawScore} of {rawMax} points across twelve questions
      </p>
    </figure>
  );
}
