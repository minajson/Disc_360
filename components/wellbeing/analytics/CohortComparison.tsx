import type { CohortStats } from "@/lib/wellbeing/analytics";
import type { CohortOutcome } from "@/lib/wellbeing/suppression";
import { describeSpread } from "@/lib/wellbeing/executive";
import { readingState, STATE_VISUAL } from "@/lib/wellbeing/semantics";
import type { InstrumentKey } from "@/data/wellbeing-instruments";
import { SuppressionNotice } from "./SuppressionNotice";
import { ChartReveal } from "./ChartReveal";
import { HowToRead } from "./HowToRead";

/**
 * Cohort comparison, built so that it cannot become a league table.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE THREE DESIGN DECISIONS THAT MATTER.
 *
 *  1 · NO RANK ORDER. Rows are alphabetical, never sorted by figure, and there
 *      is no position number, no medal, no colour scale from good to bad. The
 *      moment a wellbeing comparison is ordered by score it becomes a
 *      performance table, and a department reads its position as a verdict on
 *      its manager.
 *
 *  2 · SPREAD, NOT JUST A POINT. Each cohort is drawn as the band covering its
 *      middle, with the median marked inside it. Two cohorts with the same
 *      median and very different spreads are different situations, and a bar
 *      chart of medians says they are identical. It is also the safer figure:
 *      a band says how varied a group is without placing anybody on the scale.
 *
 *  3 · A WITHHELD COHORT KEEPS ITS ROW. Removing it would tell a reader
 *      exactly which parts of the workforce are small, which is most of what
 *      the suppression was protecting.
 *
 * COLOUR, AND WHY IT IS NEVER ON ITS OWN.
 *
 * A cohort's band and median take their colour from `readingState`, which
 * reads the figure in ITS OWN questionnaire's direction — the same number is
 * on opposite sides of the line for GHQ and WHO-5. The state's own words are
 * always printed beside it, so the row survives greyscale, a projector and a
 * colour-vision difference. There is no scale from good to bad and no tier
 * above "worth a look": none of these questionnaires publishes one.
 *
 * THE STATISTICS ARE LABELLED IN WORDS.
 *
 * The row used to read "median 63 · middle 58–70 · n = 11", which is a correct
 * description of an interquartile range and is not something a facilitator can
 * act on. It now reads "Median: 63 · Typical middle range: 58–70 · Responses:
 * 11", with the statistical explanation behind "How to read this".
 * ─────────────────────────────────────────────────────────────────────
 */

export function CohortComparison({
  cohorts,
  instrumentKey,
  scoreLabel,
  scoreMin,
  scoreMax,
  threshold,
  minCohort,
}: {
  cohorts: CohortOutcome<CohortStats>[];
  /** Decides what a figure MEANS here. Never assumed from the range. */
  instrumentKey: InstrumentKey;
  scoreLabel: string;
  scoreMin: number;
  scoreMax: number;
  /** Null for instruments carrying no governed threshold — no rule is drawn. */
  threshold: number | null;
  minCohort: number;
}) {
  const span = Math.max(1, scoreMax - scoreMin);
  const at = (value: number) => ((value - scoreMin) / span) * 100;
  const published = cohorts.filter((cohort) => !cohort.suppressed);

  if (cohorts.length === 0) {
    return (
      <SuppressionNotice
        minCohort={minCohort}
        detail="No completed responses have been recorded for this way of dividing the workforce."
      />
    );
  }

  // The shared reference line: the median across every published cohort's
  // median. Drawn so a reader can see which cohorts sit either side of the
  // middle WITHOUT being told which end is good.
  const centre =
    published.length > 0
      ? [...published.map((cohort) => cohort.stats!.median)].sort((a, b) => a - b)[
          Math.floor(published.length / 2)
        ]!
      : null;

  return (
    <ChartReveal className="flex flex-col gap-6">
      {/* axis */}
      <div className="flex items-baseline justify-between font-mono text-[10px] tracking-[0.1em] text-faint tabular-nums">
        <span>{scoreMin}</span>
        <span className="tracking-[0.14em] uppercase">{scoreLabel}</span>
        <span>{scoreMax}</span>
      </div>

      <ul className="flex flex-col divide-y divide-hairline">
        {cohorts.map((cohort, index) => {
          const stats = cohort.stats;
          const state = cohort.suppressed
            ? "withheld"
            : readingState(instrumentKey, stats!.median, threshold);
          // `completed` is null exactly when the cohort is suppressed, which
          // is also when no spread is rendered.
          const spread =
            stats && cohort.completed !== null
              ? describeSpread(stats.median, stats.p25, stats.p75, cohort.completed)
              : null;
          return (
          <li key={cohort.key} className="flex flex-col gap-2.5 py-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                {/* Colour and label together, always. */}
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: STATE_VISUAL[state].color }}
                />
                {cohort.label}
              </span>
              {cohort.suppressed ? (
                <span className="ml-auto">
                  <SuppressionNotice compact />
                </span>
              ) : (
                <span className="ml-auto flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-slate tabular-nums">
                  <span className="font-medium text-ink">
                    Median:{" "}
                    <strong className="font-display text-base">{stats!.median}</strong>
                  </span>
                  <span>{spread!.range}</span>
                  {threshold !== null && (
                    <span>
                      {/* The comparator comes from the aggregate, never
                          hard-coded: WHO-5's noteworthy side is BELOW its
                          cut-off, so a fixed "≥" would label the healthy
                          proportion as the concerning one. */}
                      {stats!.thresholdLabel ?? `≥ ${threshold}`}{" "}
                      {stats!.atOrAboveThresholdShare}%
                    </span>
                  )}
                  <span className="text-faint">{spread!.responses}</span>
                  {state === "watch" && (
                    <span style={{ color: STATE_VISUAL.watch.color }}>
                      {STATE_VISUAL.watch.label}
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="relative h-6">
              {/* the scale */}
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[rgba(31,78,95,0.14)]" />

              {centre !== null && (
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 w-px bg-[rgba(31,78,95,0.22)]"
                  style={{ left: `${at(centre)}%` }}
                />
              )}

              {threshold !== null && (
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 w-px border-l border-dashed border-[rgba(138,106,47,0.65)]"
                  style={{ left: `${at(threshold)}%` }}
                />
              )}

              {!cohort.suppressed && (
                <>
                  <div
                    className="chart-appear absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full"
                    style={
                      {
                        left: `${at(stats!.p25)}%`,
                        width: `${Math.max(1, at(stats!.p75) - at(stats!.p25))}%`,
                        background: STATE_VISUAL[state].background,
                        "--chart-index": index,
                      } as React.CSSProperties
                    }
                  />
                  <div
                    className="chart-appear absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={
                      {
                        left: `${at(stats!.median)}%`,
                        background: STATE_VISUAL[state].color,
                        "--chart-index": index,
                      } as React.CSSProperties
                    }
                  />
                </>
              )}
            </div>
          </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-4 border-t border-hairline pt-4">
        <p className="text-xs leading-relaxed text-slate">
          Groups are listed alphabetically and are never ordered by their figures. A difference
          between groups is a difference — not a ranking, not a score for a manager, and not a
          finding about anybody in them.
        </p>

        <HowToRead
          seeing={
            `Each row is one group. The band covers the middle of that group's responses and the ` +
            `upright bar marks its median — the value half the responses sat at or below.` +
            (centre !== null
              ? " The solid vertical line is the middle of the published groups, so you can see which sit either side of it."
              : "") +
            (threshold !== null
              ? ` The dashed line is ${threshold}, the level configured for this questionnaire.`
              : "")
          }
          matters={
            `Two groups can share a median and be very different: a wide band means answers were ` +
            `spread out, a narrow one that they were alike. That is the thing a single figure ` +
            `cannot tell you, and it is why groups are drawn as bands rather than as bars.`
          }
          notTelling={
            `It does not say why any group's responses differ, and it is not a ranking. Each group ` +
            `is a different set of people answering on different days, so a difference between two ` +
            `of them describes their responses and nothing about the people or their managers. ` +
            `Groups too small to publish are withheld and are never named, sized or reconstructable.`
          }
        />
      </div>
    </ChartReveal>
  );
}
