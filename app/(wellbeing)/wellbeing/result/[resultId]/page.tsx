import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOwnWellbeingResult, type WellbeingHistoryRecord } from "@/lib/wellbeing/queries";
import { WELLBEING_MAX_SCORE } from "@/lib/scoring/wellbeing";
import { DISC_WELLBEING_MAX_RAW, rankDimensions } from "@/lib/scoring/disc360-wellbeing";
import { ScoreScale } from "@/components/wellbeing/ScoreScale";
import { Who5Scale } from "@/components/wellbeing/Who5Scale";
import { hasPositiveSectionD } from "@/lib/wellbeing/ghq28-section-d";
import {
  GHQ28_SUPPORT_APPROVED,
  GHQ28_SUPPORT_BODY,
  GHQ28_SUPPORT_HEADING,
  GHQ28_SUPPORT_NEXT_STEPS,
  GHQ28_SUPPORT_PRIVACY_NOTE,
} from "@/data/ghq28-support-content";
import { WHO5_RAW_MAX, WHO5_SUGGESTED_CUTOFF_PERCENTAGE } from "@/data/who5-items";
import {
  who5CutoffCopy,
  WHO5_CUTOFF_SOURCE_NOTE,
  WHO5_MOVEMENT_CAVEAT,
  WHO5_NEXT_STEPS_BODY,
  WHO5_NEXT_STEPS_HEADING,
  WHO5_RESULT_HEADING,
  WHO5_SCORE_MEANING,
  WHO5_TREND_HEADING,
} from "@/data/who5-content";
import { PulseTrend } from "@/components/wellbeing/PulseTrend";
import { IndexHero } from "@/components/wellbeing/IndexHero";
import { DimensionProfile } from "@/components/wellbeing/DimensionProfile";
import { ReportActions } from "@/components/wellbeing/ReportActions";
import { WORK_LOCATION_LABEL } from "@/data/wellbeing-taxonomy";
import { DIMENSION_META } from "@/data/disc360-wellbeing-items";
import type { InstrumentMetadata } from "@/data/wellbeing-instruments";
import {
  MOVEMENT_CAVEAT,
  MOVEMENT_LABEL,
  movementDetail,
  outcomeCopy,
  RESULT_HEADING,
  SCORE_LABEL,
  SCORE_MEANING,
  participantDisclaimerFor,
} from "@/data/wellbeing-content";
import {
  DISC_DIMENSION_HEADING,
  DISC_DIMENSION_LEAD,
  DISC_INDEX_MEANING,
  DISC_LOWEST_HEADING,
  DISC_MOVEMENT_CAVEAT,
  DISC_MOVEMENT_LABEL,
  DISC_NO_BANDS_NOTE,
  DISC_PATTERN_NOTE,
  DISC_RESULT_HEADING,
  DISC_STRONGEST_HEADING,
  indexMovementDetail,
  lowestLine,
  sinceFirstDetail,
  strongestLine,
} from "@/data/disc360-wellbeing-content";

export const metadata: Metadata = { title: "Your result" };

const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

/**
 * The participant's own result.
 *
 * Dispatches on the instrument. The two result experiences share the shell,
 * the privacy model and the report actions, and share no numbers: a GHQ result
 * is a 0–12 count against a configured threshold, a DISC360 Wellbeing result
 * is a 0–100 index with six dimensions and no threshold at all.
 *
 * Calm by construction in both cases. Nothing organisational appears — no
 * cohort median, no team average, no percentile.
 */
export default async function WellbeingResultPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const { resultId } = await params;
  const loaded = await loadOwnWellbeingResult(resultId);
  if (!loaded) notFound();

  const { record, history, instrument } = loaded;
  const upToHere = history.chronological.filter(
    (entry) => entry.completedAt <= record.completedAt,
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
        {fullDate(record.completedAt)} · {instrument.name}
      </p>

      {record.instrumentKey === "disc360_wellbeing_v1" ? (
        <DiscWellbeingResult record={record} upToHere={upToHere} />
      ) : record.instrumentKey === "who5" ? (
        <Who5Result record={record} upToHere={upToHere} />
      ) : (
        <GhqResult record={record} upToHere={upToHere} />
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

      <ResultContext record={record} instrument={instrument} />

      <p className="mt-8 text-xs leading-relaxed text-slate">
        {/* Resolved from the instrument, exhaustively. The chain this replaced
            sent GHQ-28 to GHQ-12's text, which names GHQ-12 in its opening
            words — so a participant was told which questionnaire they had
            taken, incorrectly, on their own result. */}
        {participantDisclaimerFor(record.instrumentKey)}
      </p>

      {instrument.attribution && (
        <p className="mt-4 border-t border-[rgba(31,78,95,0.14)] pt-4 text-xs leading-relaxed text-faint">
          {instrument.attribution}
        </p>
      )}
    </div>
  );
}

/* ── DISC360 Wellbeing ──────────────────────────────────────────────── */

function DiscWellbeingResult({
  record,
  upToHere,
}: {
  record: WellbeingHistoryRecord;
  upToHere: WellbeingHistoryRecord[];
}) {
  const ranked = rankDimensions(
    record.dimensions.map((d) => ({ key: d.key, raw: d.raw, index: d.index })),
  );
  const strongest = ranked.slice(0, 2);
  const lowest = ranked.slice(-2).reverse();
  const first = upToHere[0];
  const sinceFirst =
    first && first.id !== record.id && record.indexScore !== null && first.indexScore !== null
      ? sinceFirstDetail(record.indexScore - first.indexScore)
      : null;

  return (
    <>
      <h1 className="mt-3 font-display text-h2 font-semibold tracking-tight">
        {DISC_RESULT_HEADING}
      </h1>

      <section className="pulse-card mt-8 flex flex-col gap-7 p-6 sm:p-9">
        <IndexHero
          index={record.indexScore ?? 0}
          rawScore={record.totalScore}
          rawMax={DISC_WELLBEING_MAX_RAW}
        />
        <div className="flex flex-col gap-3 border-t border-[rgba(31,78,95,0.14)] pt-6">
          <p className="text-[0.95rem] leading-relaxed text-slate">{DISC_INDEX_MEANING}</p>
          <p className="rounded-2xl bg-pulse-mist px-5 py-4 text-sm leading-relaxed text-slate">
            {DISC_NO_BANDS_NOTE}
          </p>
        </div>
      </section>

      <section className="pulse-card mt-6 flex flex-col gap-5 p-6 sm:p-9">
        <div>
          <h2 className="font-display text-h3 font-semibold">{DISC_DIMENSION_HEADING}</h2>
          <p className="mt-1.5 text-sm text-slate">{DISC_DIMENSION_LEAD}</p>
        </div>
        <DimensionProfile
          dimensions={record.dimensions}
          highlight={[strongest[0]?.key, lowest[0]?.key].filter(Boolean) as never}
        />
      </section>

      <section className="pulse-card mt-6 flex flex-col gap-4 p-6 sm:p-9">
        <h2 className="font-display text-h3 font-semibold">Your pattern</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-xs tracking-[0.12em] text-faint uppercase">
              {DISC_STRONGEST_HEADING}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              {strongestLine(strongest.map((d) => DIMENSION_META[d.key].label))}
            </p>
          </div>
          <div>
            <p className="text-xs tracking-[0.12em] text-faint uppercase">{DISC_LOWEST_HEADING}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              {lowestLine(lowest.map((d) => DIMENSION_META[d.key].label))}
            </p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-slate">{DISC_PATTERN_NOTE}</p>
      </section>

      {record.indexComparison && (
        <section className="pulse-card mt-6 flex flex-col gap-3 p-6 sm:p-9">
          <h2 className="font-display text-h3 font-semibold">
            {DISC_MOVEMENT_LABEL[record.indexComparison.movement]}
          </h2>
          <p className="text-[0.95rem] leading-relaxed text-ink">
            {indexMovementDetail(record.indexComparison.movement, record.indexComparison.delta)}
          </p>
          {sinceFirst && <p className="text-[0.95rem] text-ink">{sinceFirst}</p>}
          <p className="text-sm leading-relaxed text-slate">{DISC_MOVEMENT_CAVEAT}</p>
        </section>
      )}

      {upToHere.length > 1 && (
        <section className="pulse-card mt-6 flex flex-col gap-4 p-6 sm:p-9">
          <h2 className="font-display text-h3 font-semibold">Your pulses over time</h2>
          <PulseTrend
            max={100}
            points={upToHere
              .filter((entry) => entry.indexScore !== null)
              .map((entry) => ({
                label: monthLabel(entry.completedAt),
                score: entry.indexScore!,
                threshold: null,
                atOrAbove: false,
              }))}
          />
        </section>
      )}
    </>
  );
}

/* ── WHO-5 ──────────────────────────────────────────────────────────── */
//
// Shares the shell, the privacy model and the report actions with the other
// instruments, and shares NO numbers and NO sentences with GHQ. WHO-5 counts
// upward toward wellbeing on 0–100 and its cut-off is a floor; GHQ counts
// upward toward distress and its threshold is a ceiling. Every string here
// comes from data/who5-content.ts for that reason.

function Who5Result({
  record,
  upToHere,
}: {
  record: WellbeingHistoryRecord;
  upToHere: WellbeingHistoryRecord[];
}) {
  // The published percentage is the principal WHO-5 figure. `index_score`
  // holds it; `total_score` holds the raw 0–25 the transform came from.
  const score = record.indexScore ?? 0;
  const cutoff = record.threshold ?? WHO5_SUGGESTED_CUTOFF_PERCENTAGE;
  const atOrAboveCutoff = score >= cutoff;
  const outcome = who5CutoffCopy(atOrAboveCutoff);

  const trend = upToHere.filter((entry) => entry.indexScore !== null);

  return (
    <>
      <h1 className="mt-3 font-display text-h2 font-semibold tracking-tight">
        {WHO5_RESULT_HEADING}
      </h1>

      <section className="pulse-card mt-8 flex flex-col gap-7 p-6 sm:p-9">
        <Who5Scale
          score={score}
          cutoff={cutoff}
          rawScore={record.totalScore}
          rawMax={WHO5_RAW_MAX}
        />

        <div className="flex flex-col gap-3 border-t border-[rgba(31,78,95,0.14)] pt-6">
          <p className="text-[0.95rem] leading-relaxed text-ink">{WHO5_SCORE_MEANING}</p>
        </div>

        <div className="flex flex-col gap-3 border-t border-[rgba(31,78,95,0.14)] pt-6">
          <h2 className="font-display text-h3 font-semibold">{outcome.headline}</h2>
          <p className="text-[0.95rem] leading-relaxed text-ink">{outcome.body}</p>
          {/* The cut-off never appears without saying whose it is. */}
          <p className="text-sm leading-relaxed text-slate">{WHO5_CUTOFF_SOURCE_NOTE}</p>
        </div>
      </section>

      {record.indexComparison && (
        <section className="pulse-card mt-6 flex flex-col gap-3 p-6 sm:p-9">
          <h2 className="font-display text-h3 font-semibold">
            {DISC_MOVEMENT_LABEL[record.indexComparison.movement]}
          </h2>
          <p className="text-[0.95rem] leading-relaxed text-ink">
            {who5MovementDetail(record.indexComparison.movement, record.indexComparison.delta)}
          </p>
          <p className="text-sm leading-relaxed text-slate">{WHO5_MOVEMENT_CAVEAT}</p>
        </section>
      )}

      {trend.length > 1 && (
        <section className="pulse-card mt-6 flex flex-col gap-4 p-6 sm:p-9">
          <h2 className="font-display text-h3 font-semibold">{WHO5_TREND_HEADING}</h2>
          <PulseTrend
            max={100}
            points={trend.map((entry) => ({
              label: monthLabel(entry.completedAt),
              score: entry.indexScore!,
              // The cut-off is drawn, but `atOrAbove` is left false: on this
              // chart that flag means "highlight as noteworthy", and WHO-5's
              // noteworthy side is below the line, not above it. Marking the
              // line is honest; reusing GHQ's highlight would not be.
              threshold: entry.threshold,
              atOrAbove: false,
            }))}
          />
          <p className="text-sm leading-relaxed text-slate">{WHO5_MOVEMENT_CAVEAT}</p>
        </section>
      )}

      <section className="pulse-card mt-6 flex flex-col gap-3 p-6 sm:p-9">
        <h2 className="font-display text-h3 font-semibold">{WHO5_NEXT_STEPS_HEADING}</h2>
        <p className="text-[0.95rem] leading-relaxed text-ink">{WHO5_NEXT_STEPS_BODY}</p>
      </section>
    </>
  );
}

/**
 * Direction and size, and nothing about health.
 *
 * "Improved" and "deteriorated" would be clinical claims derived from
 * arithmetic on five questions, so the movement is described as what it
 * literally is: the score is higher, lower, or the same.
 */
function who5MovementDetail(movement: "higher" | "lower" | "similar", delta: number): string {
  const points = Math.abs(delta) === 1 ? "1 point" : `${Math.abs(delta)} points`;
  if (movement === "similar") return "Your score is the same as it was last time.";
  return movement === "higher"
    ? `Your score is ${points} higher than your previous check-in.`
    : `Your score is ${points} lower than your previous check-in.`;
}

/* ── GHQ ────────────────────────────────────────────────────────────── */

function GhqResult({
  record,
  upToHere,
}: {
  record: WellbeingHistoryRecord;
  upToHere: WellbeingHistoryRecord[];
}) {
  const outcome = outcomeCopy(record.atOrAboveThreshold === true);
  const threshold = record.threshold ?? 4;

  // GHQ-28 only, and only on the participant's own result.
  //
  // Section D asks directly about not wanting to live. The supplied guide
  // requires professional evaluation after a positive answer there; this
  // product cannot notify anybody, because an individual result is private by
  // design. So the support information goes to the one person who can act on
  // it. Derived here and discarded — never stored, never sent, never counted.
  //
  // ENABLED under the interim approval recorded on 2026-08-29 by the
  // engagement's Occupational Health facilitator, for internal user testing.
  // `GHQ28_SUPPORT_APPROVED` is the switch; the approval it stands for is
  // NOT clinical-governance sign-off, and `GHQ28_SUPPORT_APPROVAL_STATE`
  // carries that distinction — see data/ghq28-support-content.ts.
  //
  // The same flag is now a precondition of serving GHQ-28 at all: if the
  // wording were withdrawn, `canServeToParticipants` would refuse the
  // questionnaire rather than let a participant answer Section D and reach a
  // result page with nothing to show them.
  const showSectionDSupport =
    GHQ28_SUPPORT_APPROVED &&
    record.instrumentKey === "ghq28" &&
    hasPositiveSectionD(record.itemPositions);

  return (
    <>
      <h1 className="mt-3 font-display text-h2 font-semibold tracking-tight">{RESULT_HEADING}</h1>

      {showSectionDSupport && (
        <section className="pulse-card mt-8 flex flex-col gap-3 border-l-2 border-l-pulse p-6 sm:p-9">
          <h2 className="font-display text-h3 font-semibold">{GHQ28_SUPPORT_HEADING}</h2>
          <p className="text-[0.95rem] leading-relaxed text-ink">{GHQ28_SUPPORT_BODY}</p>
          <p className="text-[0.95rem] leading-relaxed text-ink">{GHQ28_SUPPORT_NEXT_STEPS}</p>
          <p className="text-sm leading-relaxed text-slate">{GHQ28_SUPPORT_PRIVACY_NOTE}</p>
        </section>
      )}

      <section className="pulse-card mt-8 flex flex-col gap-7 p-6 sm:p-9">
        <ScoreScale
          score={record.totalScore}
          threshold={threshold}
          atOrAbove={record.atOrAboveThreshold === true}
          label={SCORE_LABEL}
          max={record.instrumentKey === "ghq28" ? 28 : WELLBEING_MAX_SCORE}
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
            max={record.instrumentKey === "ghq28" ? 28 : WELLBEING_MAX_SCORE}
            points={upToHere.map((entry) => ({
              label: monthLabel(entry.completedAt),
              score: entry.totalScore,
              threshold: entry.threshold,
              atOrAbove: entry.atOrAboveThreshold === true,
            }))}
          />
        </section>
      )}
    </>
  );
}

function ResultContext({
  record,
  instrument,
}: {
  record: WellbeingHistoryRecord;
  instrument: InstrumentMetadata;
}) {
  const rows = [
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
    {
      label: "Scale",
      value: `${instrument.primaryScoreMin} – ${instrument.primaryScoreMax}`,
    },
    {
      label: "Questionnaire",
      value: `Version ${record.questionnaireVersion} · scoring ${record.scoringVersion}`,
    },
  ].filter((row): row is { label: string; value: string } => row !== null);

  return (
    <dl className="mt-10 grid gap-x-8 gap-y-3 border-t border-[rgba(31,78,95,0.14)] pt-6 text-sm sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-0.5">
          <dt className="text-xs tracking-wide text-faint uppercase">{row.label}</dt>
          <dd className="text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
