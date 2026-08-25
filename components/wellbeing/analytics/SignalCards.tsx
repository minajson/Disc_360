import {
  SIGNAL_PRIORITY_LABEL,
  type SignalPriority,
  type WellbeingSignal,
} from "@/lib/wellbeing/signals";

/**
 * Evidence-first signal cards.
 *
 * Four labelled parts in a fixed order, so a reader always meets the
 * observation before the interpretation and the evidence before either. The
 * ordering is not decoration: a card that led with "what this may mean" would
 * invite the reader to accept a reading before seeing the figures it rests on.
 *
 * The deterministic weight that orders these cards is never rendered. A number
 * printed beside a wellbeing pattern is read as a severity within seconds,
 * whatever the caption says, so it stays in the sort and out of the page.
 */

const TIER_STYLE: Record<SignalPriority, string> = {
  priority: "border-[rgba(31,78,95,0.32)] bg-pulse-mist/70 text-pulse-deep",
  emerging: "border-hairline bg-pulse-mist/40 text-slate",
  stable: "border-hairline bg-canvas text-slate",
};

export function SignalCards({ signals }: { signals: WellbeingSignal[] }) {
  if (signals.length === 0) {
    return (
      <p className="rounded-2xl border border-hairline bg-canvas px-5 py-4 text-sm leading-relaxed text-slate">
        No aggregate pattern stood out this wave. That is a finding in itself — it means nothing
        moved far enough, or persisted long enough, to be worth putting in front of you.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {signals.map((signal) => (
        <li
          key={signal.key}
          className="flex flex-col gap-4 rounded-2xl border border-[rgba(31,78,95,0.16)] bg-paper p-5 sm:p-6"
        >
          <span
            className={`w-fit rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.14em] uppercase ${TIER_STYLE[signal.priority]}`}
          >
            {SIGNAL_PRIORITY_LABEL[signal.priority]}
          </span>

          {(
            [
              { label: "Observation", body: signal.observation, strong: true },
              { label: "Evidence", body: signal.evidence, mono: true },
              { label: "What this may mean", body: signal.mayMean },
              { label: "Consider exploring", body: signal.considerExploring },
            ] as const
          ).map((part) => (
            <div key={part.label} className="flex flex-col gap-1.5">
              <p className="font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
                {part.label}
              </p>
              <p
                className={
                  "strong" in part && part.strong
                    ? "text-[0.98rem] leading-relaxed font-medium text-ink"
                    : "mono" in part && part.mono
                      ? "font-mono text-sm text-pulse-deep tabular-nums"
                      : "text-sm leading-relaxed text-slate"
                }
              >
                {part.body}
              </p>
            </div>
          ))}
        </li>
      ))}
    </ul>
  );
}
