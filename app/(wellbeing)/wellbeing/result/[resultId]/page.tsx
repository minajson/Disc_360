import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOwnWellbeingResult } from "@/lib/wellbeing/queries";
import { WELLBEING_MAX_SCORE } from "@/lib/scoring/wellbeing";
import { ScoreScale } from "@/components/wellbeing/ScoreScale";
import { PulseTrend } from "@/components/wellbeing/PulseTrend";
import { ReportActions } from "@/components/wellbeing/ReportActions";
import { WORK_LOCATION_LABEL } from "@/data/wellbeing-taxonomy";
import {
  MOVEMENT_CAVEAT,
  MOVEMENT_LABEL,
  movementDetail,
  outcomeCopy,
  RESULT_HEADING,
  SCORE_LABEL,
  SCORE_MEANING,
  SCREENING_DISCLAIMER_LONG,
} from "@/data/wellbeing-content";

export const metadata: Metadata = { title: "Your result" };

const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

/**
 * The participant's own result.
 *
 * Calm by construction. There is no red state, no warning banner and no
 * escalation prompt: an at-or-above-threshold score is presented in the same
 * layout as a below-threshold one, in warm attention tone rather than alarm,
 * because the difference between the two is where a configured line sits — not
 * a finding about the person.
 *
 * Nothing organisational appears here. No cohort median, no team average, no
 * percentile. A private result is the person's own numbers.
 */
export default async function WellbeingResultPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const { resultId } = await params;
  const loaded = await loadOwnWellbeingResult(resultId);
  if (!loaded) notFound();

  const { record, history } = loaded;
  const outcome = outcomeCopy(record.atOrAboveThreshold);

  const upToHere = history.chronological.filter(
    (entry) => entry.completedAt <= record.completedAt,
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
        {fullDate(record.completedAt)}
      </p>
      <h1 className="mt-3 font-display text-h2 font-semibold tracking-tight">{RESULT_HEADING}</h1>

      <section className="pulse-card mt-8 flex flex-col gap-7 p-6 sm:p-9">
        <ScoreScale
          score={record.totalScore}
          threshold={record.threshold}
          atOrAbove={record.atOrAboveThreshold}
          label={SCORE_LABEL}
        />

        <div className="flex flex-col gap-3 border-t border-[rgba(31,78,95,0.14)] pt-6">
          <h2 className="font-display text-h3 font-semibold">{outcome.headline}</h2>
          <p className="text-[0.98rem] leading-relaxed text-ink">{outcome.body}</p>
          <p className="text-[0.95rem] leading-relaxed text-slate">{outcome.detail}</p>
        </div>

        <p className="rounded-2xl bg-pulse-mist px-5 py-4 text-sm leading-relaxed text-slate">
          {SCORE_MEANING}
        </p>
      </section>

      {record.comparison && (
        <section className="pulse-card mt-6 flex flex-col gap-3 p-6 sm:p-9">
          <h2 className="font-display text-h3 font-semibold">
            {MOVEMENT_LABEL[record.comparison.movement]}
          </h2>
          <p className="text-[0.95rem] leading-relaxed text-ink">
            {movementDetail(record.comparison.movement, record.comparison.delta)}
          </p>
          <p className="text-sm leading-relaxed text-slate">{MOVEMENT_CAVEAT}</p>
        </section>
      )}

      {upToHere.length > 1 && (
        <section className="pulse-card mt-6 flex flex-col gap-4 p-6 sm:p-9">
          <h2 className="font-display text-h3 font-semibold">Your pulses over time</h2>
          <PulseTrend
            points={upToHere.map((entry) => ({
              label: monthLabel(entry.completedAt),
              score: entry.totalScore,
              threshold: entry.threshold,
              atOrAbove: entry.atOrAboveThreshold,
            }))}
          />
        </section>
      )}

      <section className="mt-8 flex flex-col gap-5">
        <ReportActions resultId={record.id} />
        <Link
          href="/wellbeing/history"
          className="pulse-focus w-fit rounded text-sm font-medium text-pulse underline underline-offset-4"
        >
          See my full history →
        </Link>
      </section>

      <dl className="mt-10 grid gap-x-8 gap-y-3 border-t border-[rgba(31,78,95,0.14)] pt-6 text-sm sm:grid-cols-2">
        {[
          record.departmentAtCompletion
            ? { label: "Department / Function", value: record.departmentAtCompletion }
            : null,
          record.workLocationAtCompletion
            ? {
                label: "Work location",
                value: record.officeLocationAtCompletion
                  ? `${WORK_LOCATION_LABEL[record.workLocationAtCompletion]} · ${record.officeLocationAtCompletion}`
                  : WORK_LOCATION_LABEL[record.workLocationAtCompletion],
              }
            : null,
          { label: "Score range", value: `0 – ${WELLBEING_MAX_SCORE}` },
          {
            label: "Questionnaire",
            value: `Version ${record.questionnaireVersion} · scoring ${record.scoringVersion}`,
          },
        ]
          .filter((row): row is { label: string; value: string } => row !== null)
          .map((row) => (
            <div key={row.label} className="flex flex-col gap-0.5">
              <dt className="text-xs tracking-wide text-faint uppercase">{row.label}</dt>
              <dd className="text-ink">{row.value}</dd>
            </div>
          ))}
      </dl>

      <p className="mt-8 text-xs leading-relaxed text-slate">{SCREENING_DISCLAIMER_LONG}</p>
    </div>
  );
}
