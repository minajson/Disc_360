import type { Metadata } from "next";
import Link from "next/link";
import { getMyWellbeingHistory, type WellbeingHistory } from "@/lib/wellbeing/queries";
import { PulseTrend } from "@/components/wellbeing/PulseTrend";
import { DimensionHistory } from "@/components/wellbeing/DimensionHistory";
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

const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

/**
 * My Wellbeing History.
 *
 * One instrument at a time, always. The instruments measure different things
 * on different scales running in opposite directions, so they never share a
 * chart, an axis or a movement figure — a WHO-5 of 64 following a GHQ-12 of 3
 * is not an improvement, it is two unrelated numbers.
 *
 * Only instruments the person has actually completed appear in the selector.
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
          aria-label="Instrument"
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

      <p className="mt-4 text-lead text-slate">
        {series.count === 1
          ? HISTORY_SINGLE
          : `${series.count} completed ${instrument.name} pulses, oldest first.`}
      </p>

      {series.count > 1 && (
        <section className="pulse-card mt-8 flex flex-col gap-4 p-6 sm:p-9">
          <PulseTrend
            max={instrument.primaryScoreMax}
            points={series.chronological.map((entry) => ({
              label: monthLabel(entry.completedAt),
              score: isDisc ? (entry.indexScore ?? 0) : entry.totalScore,
              threshold: entry.threshold,
              atOrAbove: entry.atOrAboveThreshold === true,
            }))}
          />
          <p className="text-sm leading-relaxed text-slate">
            {isDisc ? DISC_MOVEMENT_CAVEAT : MOVEMENT_CAVEAT}
          </p>
        </section>
      )}

      {isDisc && series.count > 1 && <DimensionHistory records={series.chronological} />}

      {series.thresholdChanged && (
        <p className="mt-6 rounded-2xl border border-[rgba(138,106,47,0.32)] bg-pulse-attention-soft/60 px-5 py-4 text-sm leading-relaxed text-ink">
          The screening threshold has changed since your earliest pulse. Each result below shows
          the threshold that applied on the day it was completed, so older results are still read
          the way they were originally.
        </p>
      )}

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
        const headline = isDisc ? (record.indexScore ?? 0) : record.totalScore;
        const movement = isDisc ? record.indexComparison : record.comparison;
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
                      record.atOrAboveThreshold === true
                        ? "var(--color-pulse-attention)"
                        : "var(--color-pulse)",
                  }}
                >
                  {headline}
                </span>
                <span className="font-mono text-sm text-slate">/ {max}</span>
                <span className="ml-auto text-sm text-slate">{fullDate(record.completedAt)}</span>
              </div>

              {record.threshold !== null && (
                <p className="mt-3 text-sm text-ink">
                  {record.atOrAboveThreshold
                    ? "At or above the screening threshold"
                    : "Below the screening threshold"}
                  <span className="text-slate"> · threshold {record.threshold}</span>
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
