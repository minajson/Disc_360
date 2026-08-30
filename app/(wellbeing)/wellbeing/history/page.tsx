import type { Metadata } from "next";
import Link from "next/link";
import { getMyWellbeingHistory, type WellbeingHistory } from "@/lib/wellbeing/queries";
import { DimensionHistory } from "@/components/wellbeing/DimensionHistory";
import { PersonalTrends } from "@/components/wellbeing/result/PersonalTrends";
import { buildPersonalTrend, headlineOf } from "@/lib/wellbeing/personal-trends";
import { readingState, STATE_VISUAL, thresholdPhrase } from "@/lib/wellbeing/semantics";
import { WORK_LOCATION_LABEL } from "@/data/wellbeing-taxonomy";
import {
  INSTRUMENTS,
  isInstrumentKey,
  type InstrumentKey,
} from "@/data/wellbeing-instruments";
import {
  HISTORY_EMPTY,
  HISTORY_HEADING,
  HISTORY_SINGLE,
  MOVEMENT_CAVEAT,
  MOVEMENT_LABEL,
  movementDetail,
  SCREENING_DISCLAIMER_LONG,
} from "@/data/wellbeing-content";
import {
  DISC_MOVEMENT_CAVEAT,
  DISC_MOVEMENT_LABEL,
  DISC_WELLBEING_DISCLAIMER_LONG,
  indexMovementDetail,
} from "@/data/disc360-wellbeing-content";

export const metadata: Metadata = { title: "My Wellbeing History" };

const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

/**
 * My Wellbeing History, and My Wellbeing Trends.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE PARTICIPANT'S OWN ANALYTICS, AND NOBODY ELSE'S.
 *
 * This is not a smaller version of the organisational dashboard. It shows one
 * person their own longitudinal record and has no access to any other — the
 * module behind it (`lib/wellbeing/personal-trends.ts`) takes a list of the
 * caller's own results and has no parameter for a cohort, a department or
 * another person.
 *
 * ONE QUESTIONNAIRE AT A TIME, ALWAYS.
 *
 * The questionnaires measure different things, on different scales, running in
 * OPPOSITE directions, so they never share a chart, an axis or a movement
 * figure: a WHO-5 of 64 following a GHQ-12 of 3 is not an improvement, it is
 * two unrelated numbers. Switching the selector replaces the scale, the
 * legend and the explanatory language together.
 *
 * Only questionnaires the person has actually completed appear in the selector.
 * ─────────────────────────────────────────────────────────────────────
 */
export default async function WellbeingHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ instrument?: string }>;
}) {
  const { instrument: requested } = await searchParams;
  const { history } = await getMyWellbeingHistory();
  const completed = history.completedInstruments;

  if (completed.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <h1 className="font-display text-h2 font-semibold tracking-tight">{HISTORY_HEADING}</h1>
        <div className="pulse-card mt-8 flex flex-col gap-5 p-6 sm:p-9">
          <p className="text-[0.98rem] leading-relaxed text-slate">{HISTORY_EMPTY}</p>
          <Link
            href="/wellbeing"
            className="pulse-focus w-fit rounded-full bg-pulse px-5 py-2.5 text-sm font-medium text-white"
          >
            Take my first Wellbeing Pulse
          </Link>
        </div>
      </div>
    );
  }

  const active: InstrumentKey =
    requested && isInstrumentKey(requested) && completed.includes(requested)
      ? requested
      : completed[0]!;
  const instrument = INSTRUMENTS[active];
  const series = history[active];
  const isDisc = active === "disc360_wellbeing_v1";

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="font-display text-h2 font-semibold tracking-tight">{HISTORY_HEADING}</h1>

      {completed.length > 1 && (
        <nav
          aria-label="Questionnaire"
          className="-mx-1 mt-5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex min-w-max gap-2">
            {completed.map((key) => (
              <li key={key}>
                <Link
                  href={`/wellbeing/history?instrument=${key}`}
                  aria-current={key === active ? "page" : undefined}
                  className={`pulse-focus block rounded-full border px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    key === active
                      ? "border-pulse bg-pulse text-white"
                      : "border-[rgba(31,78,95,0.24)] text-slate hover:text-pulse"
                  }`}
                >
                  {INSTRUMENTS[key].name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {completed.length > 1 && (
        <p className="mt-3 text-xs leading-relaxed text-faint">
          Each questionnaire has its own scale and its own direction, so they are never plotted
          together. Switching above changes the scale, the labels and the explanation with it.
        </p>
      )}

      <p className="mt-4 text-lead text-slate">
        {series.count === 1
          ? HISTORY_SINGLE
          : `${series.count} completed ${instrument.name} check-ins, oldest first.`}
      </p>

      {/* ── my trends, in this questionnaire's own terms ─────────── */}
      <PersonalTrends trend={buildPersonalTrend(active, series.chronological)} />

      <p className="mt-4 text-sm leading-relaxed text-slate">
        {isDisc ? DISC_MOVEMENT_CAVEAT : MOVEMENT_CAVEAT}
      </p>

      {isDisc && series.count > 1 && <DimensionHistory records={series.chronological} />}

      <HistoryList series={series} isDisc={isDisc} max={instrument.primaryScoreMax} />

      <p className="mt-10 text-xs leading-relaxed text-slate">
        {isDisc ? DISC_WELLBEING_DISCLAIMER_LONG : SCREENING_DISCLAIMER_LONG}
      </p>

      {instrument.attribution && (
        <p className="mt-4 border-t border-[rgba(31,78,95,0.14)] pt-4 text-xs leading-relaxed text-faint">
          {instrument.attribution}
        </p>
      )}
    </div>
  );
}

function HistoryList({
  series,
  isDisc,
  max,
}: {
  series: WellbeingHistory;
  isDisc: boolean;
  max: number;
}) {
  return (
    <ol className="mt-8 flex flex-col gap-4">
      {series.records.map((record) => {
        /*
         * ─────────────────────────────────────────────────────────────
         * THE FLAG IS NOT READ DIRECTLY, AND MUST NOT BE.
         *
         * `at_or_above_threshold` means opposite things on different
         * questionnaires: GHQ counts upward toward reported difficulty, WHO-5
         * counts upward toward wellbeing. This list used to colour the flag
         * warm and label it "At or above the screening threshold" for all of
         * them, so a participant with a healthy WHO-5 score saw it drawn and
         * described as the noteworthy one. `readingState` and
         * `thresholdPhrase` resolve both in the questionnaire's own direction.
         * ─────────────────────────────────────────────────────────────
         */
        const headline = headlineOf(record).value;
        const movement = isDisc ? record.indexComparison : record.comparison;
        const state = readingState(record.instrumentKey, headline, record.threshold);
        const phrase = thresholdPhrase(record.instrumentKey, headline, record.threshold);
        return (
          <li key={record.id}>
            <Link
              href={`/wellbeing/result/${record.id}`}
              className="pulse-focus block rounded-[28px] border border-[rgba(31,78,95,0.16)] bg-paper p-5 transition-colors hover:border-pulse sm:p-6"
            >
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span
                  className="font-display text-[2rem] leading-none font-semibold tabular-nums"
                  style={{
                    color:
                      state === "watch"
                        ? "var(--color-pulse-watch)"
                        : "var(--color-pulse)",
                  }}
                >
                  {headline}
                </span>
                <span className="font-mono text-sm text-slate">/ {max}</span>
                <span className="ml-auto text-sm text-slate">{fullDate(record.completedAt)}</span>
              </div>

              {phrase && (
                <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-ink">
                  {/* Colour is never the only carrier: the phrase itself says
                      which side of the line this is, in this questionnaire's
                      own words. */}
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: STATE_VISUAL[state].color }}
                  />
                  {phrase}
                  <span className="text-slate"> · {record.threshold}</span>
                </p>
              )}

              {movement && (
                <p className="mt-1.5 text-sm text-slate">
                  {isDisc
                    ? `${DISC_MOVEMENT_LABEL[movement.movement as "higher" | "lower" | "similar"]} — ${indexMovementDetail(
                        movement.movement as "higher" | "lower" | "similar",
                        movement.delta,
                      )}`
                    : `${MOVEMENT_LABEL[movement.movement as "lower" | "higher" | "similar"]} — ${movementDetail(
                        movement.movement as "lower" | "higher" | "similar",
                        movement.delta,
                      )}`}
                </p>
              )}

              {(record.departmentAtCompletion || record.workLocationAtCompletion) && (
                <p className="mt-3 text-xs text-faint">
                  {[
                    record.departmentAtCompletion,
                    record.workLocationAtCompletion
                      ? WORK_LOCATION_LABEL[record.workLocationAtCompletion]
                      : null,
                    record.officeLocationAtCompletion,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
