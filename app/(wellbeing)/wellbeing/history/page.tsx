import type { Metadata } from "next";
import Link from "next/link";
import { getMyWellbeingHistory } from "@/lib/wellbeing/queries";
import { PulseTrend } from "@/components/wellbeing/PulseTrend";
import { WORK_LOCATION_LABEL } from "@/data/wellbeing-taxonomy";
import {
  HISTORY_EMPTY,
  HISTORY_HEADING,
  HISTORY_SINGLE,
  MOVEMENT_CAVEAT,
  MOVEMENT_LABEL,
  movementDetail,
  SCREENING_DISCLAIMER_LONG,
} from "@/data/wellbeing-content";

export const metadata: Metadata = { title: "My Wellbeing History" };

const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

/**
 * My Wellbeing History.
 *
 * Every completed pulse, kept. A retake never replaces the one before it —
 * `wellbeing_results` carries no UPDATE and no DELETE policy, so the four
 * pulses someone completed across a year are four rows and stay four rows.
 *
 * Each row shows the threshold that was in force when it completed, not
 * today's. When policy has changed the page says so, because otherwise two
 * scores either side of a revision would look directly comparable when their
 * outcomes were decided by different lines.
 *
 * There is deliberately no organisational average on this page.
 */
export default async function WellbeingHistoryPage() {
  const { history } = await getMyWellbeingHistory();

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="font-display text-h2 font-semibold tracking-tight">{HISTORY_HEADING}</h1>

      {history.count === 0 ? (
        <div className="pulse-card mt-8 flex flex-col gap-5 p-6 sm:p-9">
          <p className="text-[0.98rem] leading-relaxed text-slate">{HISTORY_EMPTY}</p>
          <Link
            href="/wellbeing"
            className="pulse-focus w-fit rounded-full bg-pulse px-5 py-2.5 text-sm font-medium text-white"
          >
            Take my first Wellbeing Pulse
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-3 text-lead text-slate">
            {history.count === 1
              ? HISTORY_SINGLE
              : `${history.count} completed pulses, oldest first.`}
          </p>

          {history.count > 1 && (
            <section className="pulse-card mt-8 flex flex-col gap-4 p-6 sm:p-9">
              <PulseTrend
                points={history.chronological.map((entry) => ({
                  label: monthLabel(entry.completedAt),
                  score: entry.totalScore,
                  threshold: entry.threshold,
                  atOrAbove: entry.atOrAboveThreshold,
                }))}
              />
              <p className="text-sm leading-relaxed text-slate">{MOVEMENT_CAVEAT}</p>
            </section>
          )}

          {history.thresholdChanged && (
            <p className="mt-6 rounded-2xl border border-[rgba(138,106,47,0.32)] bg-pulse-attention-soft/60 px-5 py-4 text-sm leading-relaxed text-ink">
              The screening threshold has changed since your earliest pulse. Each result below
              shows the threshold that applied on the day it was completed, so older results are
              still read the way they were originally.
            </p>
          )}

          <ol className="mt-8 flex flex-col gap-4">
            {history.records.map((record) => (
              <li key={record.id}>
                <Link
                  href={`/wellbeing/result/${record.id}`}
                  className="pulse-focus block rounded-[28px] border border-[rgba(31,78,95,0.16)] bg-paper p-5 transition-colors hover:border-pulse sm:p-6"
                >
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span
                      className="font-display text-[2rem] leading-none font-semibold tabular-nums"
                      style={{
                        color: record.atOrAboveThreshold
                          ? "var(--color-pulse-attention)"
                          : "var(--color-pulse)",
                      }}
                    >
                      {record.totalScore}
                    </span>
                    <span className="font-mono text-sm text-slate">/ 12</span>
                    <span className="ml-auto text-sm text-slate">
                      {fullDate(record.completedAt)}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-ink">
                    {record.atOrAboveThreshold
                      ? "At or above the screening threshold"
                      : "Below the screening threshold"}
                    <span className="text-slate"> · threshold {record.threshold}</span>
                  </p>

                  {record.comparison && (
                    <p className="mt-1.5 text-sm text-slate">
                      {MOVEMENT_LABEL[record.comparison.movement]} —{" "}
                      {movementDetail(record.comparison.movement, record.comparison.delta)}
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
            ))}
          </ol>
        </>
      )}

      <p className="mt-10 text-xs leading-relaxed text-slate">{SCREENING_DISCLAIMER_LONG}</p>
    </div>
  );
}
