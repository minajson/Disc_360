import type { Metadata } from "next";
import Link from "next/link";
import { resolveWellbeingScope } from "@/lib/wellbeing/access";
import {
  COMPARE_DIMENSIONS,
  getWellbeingComparison,
  getWellbeingDimensionProfile,
  getWellbeingSignals,
  getWellbeingSignalPatterns,
  getWellbeingWorkspace,
  parseAnalyticsSource,
  type AnalyticsSource,
  type CompareDimension,
} from "@/lib/wellbeing/analytics";
import {
  INSTRUMENT_KEYS,
  INSTRUMENTS,
  isInstrumentKey,
  type InstrumentKey,
} from "@/data/wellbeing-instruments";
import {
  DISC_ANALYTICS_NOTE,
  DISC_HIGHEST_DIMENSION_LABEL,
  DISC_LOWER_DIMENSION_NOTE,
  DISC_LOWEST_DIMENSION_LABEL,
  DISC_NO_BANDS_ANALYTICS_NOTE,
} from "@/data/disc360-wellbeing-content";
import {
  AGGREGATE_ONLY_NOTICE,
  NO_COMBINATION_NOTICE,
  THRESHOLD_POLICY_NOTE,
} from "@/data/wellbeing-content";
import { itemIdsFor } from "@/lib/wellbeing/instrument-analytics";
import { DistributionChart } from "@/components/wellbeing/analytics/DistributionChart";
import { AggregateTrend } from "@/components/wellbeing/analytics/AggregateTrend";
import { CohortStrip } from "@/components/wellbeing/analytics/CohortStrip";
import { SignalHeatmap } from "@/components/wellbeing/analytics/SignalHeatmap";
import { StatRow } from "@/components/wellbeing/analytics/StatRow";
import { SuppressionNotice } from "@/components/wellbeing/analytics/SuppressionNotice";
import {
  parseWorkspaceTab,
  WorkspaceNav,
} from "@/components/wellbeing/analytics/WorkspaceNav";
import { SourceSwitch } from "@/components/wellbeing/analytics/SourceSwitch";
import { HowToRead } from "@/components/wellbeing/analytics/HowToRead";
import { SignalCards } from "@/components/wellbeing/analytics/SignalCards";
import { ReportsPanel } from "@/components/wellbeing/analytics/ReportsPanel";
import { TwoCohortCompare } from "@/components/wellbeing/analytics/TwoCohortCompare";

export const metadata: Metadata = { title: "Wellbeing analytics" };

/** Which comparison dimension each tab drives. */
const TAB_DIMENSION: Partial<Record<string, CompareDimension>> = {
  compare: "department",
  teams: "team",
  locations: "work_location",
  signals: "department",
  // Dedicated surfaces, each pinned to one dimension. Pinning rather than
  // offering a picker is the point: these tabs answer one question each.
  field: "work_location",
  functions: "department",
};

/**
 * The Wellbeing Pulse analytics workspace.
 *
 * Access is a wellbeing role held explicitly in this organisation — not team
 * administration, and not platform administration. A facilitator who runs the
 * session, and a super administrator who can open every other dashboard in the
 * product, both land on the "no access" state here unless a wellbeing role was
 * granted to them and recorded.
 *
 * Everything on every tab is aggregate and has already passed cohort
 * suppression on the server. There is no individual view to navigate to,
 * because no query in this workspace can return one.
 */
export default async function WellbeingAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    org?: string;
    tab?: string;
    by?: string;
    instrument?: string;
    source?: string;
  }>;
}) {
  const {
    org,
    tab: tabParam,
    by,
    instrument: instrumentParam,
    source: sourceParam,
  } = await searchParams;
  const source: AnalyticsSource = parseAnalyticsSource(sourceParam);
  const { scope } = await resolveWellbeingScope();

  if (scope.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
        <h1 className="font-display text-h2 font-semibold">Wellbeing analytics</h1>
        <p className="mt-4 text-lead text-slate">
          You do not hold a Wellbeing Pulse analytics role in any organisation.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-slate">
          Wellbeing reporting is governed separately from the rest of the platform. Team
          administration and platform administration do not grant it — it is assigned explicitly,
          per organisation, and recorded. Your wellbeing governance contact can arrange access.
        </p>
        <Link
          href="/wellbeing"
          className="pulse-focus mt-8 inline-block rounded-full border border-[rgba(31,78,95,0.24)] px-5 py-2.5 text-sm font-medium text-pulse"
        >
          Back to Wellbeing Pulse
        </Link>
      </div>
    );
  }

  const organizationId =
    scope.find((entry) => entry.organizationId === org)?.organizationId ??
    scope[0]!.organizationId;
  const tab = parseWorkspaceTab(tabParam);

  // Exactly one instrument drives every metric on the page. Defaulting rather
  // than aggregating is the point: there is no "all instruments" view, because
  // there is no number that would mean anything across them.
  const instrumentKey: InstrumentKey =
    instrumentParam && isInstrumentKey(instrumentParam)
      ? instrumentParam
      : "disc360_wellbeing_v1";

  const workspace = await getWellbeingWorkspace(organizationId, instrumentKey, source);
  const { context, overview, trend } = workspace;
  const instrument = context.instrument;
  const isDisc = instrumentKey === "disc360_wellbeing_v1";

  const dimension: CompareDimension =
    (by as CompareDimension | undefined) ?? TAB_DIMENSION[tab] ?? "department";

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
          {instrument.descriptor}
        </p>
        <h1 className="font-display text-h2 font-semibold tracking-tight">Wellbeing Pulse</h1>
        <p className="text-sm text-slate">
          {context.organizationName} ·{" "}
          <span className="font-mono">
            {context.threshold !== null
              ? `threshold ${context.threshold} · `
              : "no threshold · "}
            minimum group {context.minCohort}
          </span>
        </p>
      </header>

      {/* Instrument switcher. Selecting one replaces every metric below. */}
      <nav
        aria-label="Instrument"
        className="-mx-1 mt-5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ul className="flex min-w-max gap-2">
          {INSTRUMENT_KEYS.map((key) => (
            <li key={key}>
              <Link
                href={`/wellbeing/analytics?org=${organizationId}&instrument=${key}&tab=${tab}&source=${source}`}
                aria-current={key === instrumentKey ? "page" : undefined}
                className={`pulse-focus block rounded-full border px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  key === instrumentKey
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

      {scope.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {scope.map((entry) => (
            <Link
              key={entry.organizationId}
              href={`/wellbeing/analytics?org=${entry.organizationId}&instrument=${instrumentKey}&tab=${tab}&source=${source}`}
              className={`pulse-focus rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                entry.organizationId === organizationId
                  ? "border-pulse bg-pulse text-white"
                  : "border-[rgba(31,78,95,0.24)] text-slate hover:text-pulse"
              }`}
            >
              {entry.organizationName}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        <SourceSwitch
          source={source}
          organizationId={organizationId}
          instrumentKey={instrumentKey}
          tab={tab}
        />
      </div>

      <div className="mt-7">
        <WorkspaceNav
          active={tab}
          organizationId={organizationId}
          instrumentKey={instrumentKey}
          source={source}
        />
      </div>

      <div className="mt-8 flex flex-col gap-8">
        {/* ── Overview ─────────────────────────────────────────────── */}
        {tab === "overview" && (
          <>
            <section className="pulse-card flex flex-col gap-8 p-6 sm:p-9">
              {overview ? (
                <>
                  <StatRow
                    stats={[
                      { label: "Invited", value: String(workspace.invited) },
                      {
                        // People, matching what suppression counts. Responses
                        // are reported beside the distribution they plot.
                        label: "Participants",
                        value: String(workspace.participants),
                        note: `${overview.completed} ${
                          overview.completed === 1 ? "response" : "responses"
                        } across all waves`,
                      },
                      {
                        label: "Participation",
                        value:
                          workspace.participation === null
                            ? "—"
                            : `${workspace.participation}%`,
                        note:
                          workspace.participation === null && workspace.invited > 0
                            ? "more participants than roster places — the invited list is incomplete"
                            : undefined,
                      },
                      {
                        label: `Median ${instrument.primaryScoreLabel}`,
                        value: String(overview.median),
                        note: `mean ${overview.mean}`,
                      },
                      ...(context.threshold !== null
                        ? [
                            {
                              label: `At or above ${context.threshold}`,
                              value: `${overview.atOrAboveThresholdShare}%`,
                              note: `${overview.atOrAboveThreshold} of ${overview.completed}`,
                            },
                          ]
                        : []),
                    ]}
                  />

                  <div className="border-t border-[rgba(31,78,95,0.14)] pt-8">
                    <h2 className="font-display text-h3 font-semibold">Score distribution</h2>
                    <p className="mt-1.5 mb-6 text-sm text-slate">
                      How the workforce is spread across the {instrument.primaryScoreMin}–
                      {instrument.primaryScoreMax} {instrument.primaryScoreLabel.toLowerCase()}{" "}
                      range.
                    </p>
                    <DistributionChart
                      distribution={overview.distribution}
                      threshold={context.threshold}
                      completed={overview.completed}
                      maxScore={overview.maxScore}
                      bucketSize={overview.bucketSize}
                    />

                    <div className="mt-6">
                      <HowToRead
                        seeing={`How many people scored in each part of the ${instrument.primaryScoreMin}–${instrument.primaryScoreMax} ${instrument.primaryScoreLabel.toLowerCase()} range, for everyone who completed this pulse.`}
                        matters="An average alone cannot tell you whether people are clustered together or spread far apart. Two workforces with the same median can look completely different here, and the shape is usually the more useful of the two."
                        notTelling={
                          context.threshold !== null
                            ? "It does not explain why the pattern exists, and it does not identify anyone. A score at or above the threshold indicates that a fuller conversation may be warranted — it is not a diagnosis of the person or of the group."
                            : "It does not explain why the pattern exists, and it does not identify anyone. This instrument has no validated cut-off, so no part of the range means more than the number it shows."
                        }
                      />
                    </div>
                  </div>

                  {trend.medianChange && (
                    <div className="border-t border-[rgba(31,78,95,0.14)] pt-6">
                      <p className="text-sm text-slate">
                        Median {instrument.primaryScoreLabel} is{" "}
                        <strong className="font-medium text-ink">
                          {trend.medianChange.movement === "unchanged"
                            ? "unchanged"
                            : `${Math.abs(trend.medianChange.delta)} ${
                                Math.abs(trend.medianChange.delta) === 1 ? "point" : "points"
                              } ${trend.medianChange.movement}`}
                        </strong>{" "}
                        than the previous comparable pulse.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <SuppressionNotice minCohort={context.minCohort} />
              )}
            </section>

            {isDisc && (
              <DimensionProfileSection
                organizationId={organizationId}
                instrumentKey={instrumentKey}
                source={source}
              />
            )}

            <aside className="flex flex-col gap-3 rounded-2xl border border-[rgba(31,78,95,0.16)] bg-pulse-mist/60 p-5 text-sm leading-relaxed text-slate">
              <p>{AGGREGATE_ONLY_NOTICE}</p>
              <p>{NO_COMBINATION_NOTICE}</p>
              <p>{isDisc ? DISC_ANALYTICS_NOTE : THRESHOLD_POLICY_NOTE}</p>
              {isDisc && <p>{DISC_NO_BANDS_ANALYTICS_NOTE}</p>}
              {instrument.attribution && (
                <p className="text-xs text-faint">{instrument.attribution}</p>
              )}
            </aside>
          </>
        )}

        {/* ── Compare / Teams / Locations ──────────────────────────── */}
        {(tab === "compare" || tab === "teams" || tab === "locations") && (
          <CompareSection
            organizationId={organizationId}
            instrumentKey={instrumentKey}
            source={source}
            tab={tab}
            dimension={dimension}
            threshold={context.threshold}
            maxScore={instrument.primaryScoreMax}
            minCohort={context.minCohort}
          />
        )}

        {/* ── Trends ───────────────────────────────────────────────── */}
        {tab === "trends" && (
          <section className="pulse-card flex flex-col gap-6 p-6 sm:p-9">
            <div>
              <h2 className="font-display text-h3 font-semibold">Movement across pulses</h2>
              <p className="mt-1.5 text-sm text-slate">
                Quarterly waves. Only waves with enough completed responses to protect
                confidentiality are shown.
              </p>
            </div>
            {trend.points.length > 0 ? (
              <AggregateTrend
                trend={trend}
                scoreLabel={instrument.primaryScoreLabel}
                scoreMax={instrument.primaryScoreMax}
                hasThreshold={instrument.hasThreshold}
                showParticipation
              />
            ) : (
              <SuppressionNotice minCohort={context.minCohort} />
            )}

            <HowToRead
              seeing="The median score for each wave of this pulse, in date order, for the organisation as a whole."
              matters="A single wave is a snapshot. Movement across several waves is what distinguishes a persistent pattern from ordinary variation, and it is usually the more actionable of the two."
              notTelling="It does not attribute the movement to any cause, and the people completing each wave are not necessarily the same people. A change between waves can reflect who answered as much as how they feel."
            />
            {workspace.trendSuppressedWaves > 0 && (
              <p className="text-xs text-faint">
                {workspace.trendSuppressedWaves}{" "}
                {workspace.trendSuppressedWaves === 1 ? "wave is" : "waves are"} not shown because
                too few people completed a pulse in{" "}
                {workspace.trendSuppressedWaves === 1 ? "it" : "them"}.
              </p>
            )}
          </section>
        )}

        {/* ── Field vs Office ──────────────────────────────────────── */}
        {tab === "field" && (
          <FieldVsOfficeSection
            organizationId={organizationId}
            instrumentKey={instrumentKey}
            source={source}
            threshold={context.threshold}
            maxScore={instrument.primaryScoreMax}
            scoreLabel={instrument.primaryScoreLabel}
            minCohort={context.minCohort}
          />
        )}

        {/* ── Sub Teams / Functions ────────────────────────────────── */}
        {tab === "functions" && (
          <CompareSection
            organizationId={organizationId}
            instrumentKey={instrumentKey}
            source={source}
            tab={tab}
            dimension="department"
            threshold={context.threshold}
            maxScore={instrument.primaryScoreMax}
            minCohort={context.minCohort}
          />
        )}

        {/* ── Reports ──────────────────────────────────────────────── */}
        {tab === "reports" && (
          <ReportsPanel
            organizationId={organizationId}
            instrumentKey={instrumentKey}
            instrumentName={instrument.name}
            source={source}
            suppressed={overview === null}
            minCohort={context.minCohort}
          />
        )}

        {/* ── Signals ──────────────────────────────────────────────── */}
        {tab === "signals" && (
          <SignalsSection
            organizationId={organizationId}
            instrumentKey={instrumentKey}
            source={source}
            dimension={dimension}
            minCohort={context.minCohort}
          />
        )}
      </div>
    </div>
  );
}

async function CompareSection({
  organizationId,
  instrumentKey,
  source,
  tab,
  dimension,
  threshold,
  maxScore,
  minCohort,
}: {
  organizationId: string;
  instrumentKey: InstrumentKey;
  source: AnalyticsSource;
  tab: string;
  dimension: CompareDimension;
  threshold: number | null;
  maxScore: number;
  minCohort: number;
}) {
  const { view } = await getWellbeingComparison(
    organizationId,
    instrumentKey,
    dimension,
    source,
  );
  const scoreLabel = INSTRUMENTS[instrumentKey].primaryScoreLabel;
  // A pinned tab answers one question; offering a dimension picker on it
  // would let the reader change the question without changing the heading.
  const showPicker = tab === "compare" || tab === "locations";
  const choices =
    tab === "locations"
      ? COMPARE_DIMENSIONS.filter((entry) =>
          ["work_location", "office_location"].includes(entry.key),
        )
      : COMPARE_DIMENSIONS;

  return (
    <section className="pulse-card flex flex-col gap-6 p-6 sm:p-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-h3 font-semibold">
            {tab === "functions" ? "Sub Teams / Functions" : view.label}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate">
            {tab === "functions"
              ? "Read from this organisation's own Department / Function catalogue. This is not the same thing as a DISC360 team — a person belongs to one of each."
              : `Median ${scoreLabel.toLowerCase()}${
                  threshold !== null ? " and the share at or above the threshold" : ""
                }, by group.`}
          </p>
        </div>

        {showPicker && (
          <div className="flex flex-wrap gap-2">
            {choices.map((entry) => (
              <Link
                key={entry.key}
                href={`/wellbeing/analytics?org=${organizationId}&instrument=${instrumentKey}&tab=${tab}&by=${entry.key}&source=${source}`}
                className={`pulse-focus rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  entry.key === dimension
                    ? "border-pulse bg-pulse text-white"
                    : "border-[rgba(31,78,95,0.24)] text-slate hover:text-pulse"
                }`}
              >
                {entry.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {view.fullySuppressed ? (
        <SuppressionNotice minCohort={minCohort} />
      ) : (
        <CohortStrip
          cohorts={view.cohorts}
          threshold={threshold}
          maxScore={maxScore}
          minCohort={minCohort}
        />
      )}

      <HowToRead
        seeing={`The median ${scoreLabel.toLowerCase()} for each group, alongside how many people are in it.`}
        matters="A single organisation-wide figure can hide a group whose experience differs markedly from everyone else's. Comparing groups is how that becomes visible."
        notTelling="It does not rank people, and it does not say one group is doing better or worse as a place to work. Groups differ in size, role and circumstance, and a difference between them is a starting point for a conversation rather than a conclusion."
      />

      {view.suppressedCount > 0 && !view.fullySuppressed && (
        <p className="text-xs leading-relaxed text-faint">
          {view.suppressedCount} of {view.cohorts.length} groups are withheld. Where only one group
          would fall below the minimum, a second is withheld alongside it — otherwise the hidden
          group could be worked out by subtraction.
        </p>
      )}
    </section>
  );
}

async function SignalsSection({
  organizationId,
  instrumentKey,
  source,
  dimension,
  minCohort,
}: {
  organizationId: string;
  instrumentKey: InstrumentKey;
  source: AnalyticsSource;
  dimension: CompareDimension;
  minCohort: number;
}) {
  const [{ rows }, { signals }] = await Promise.all([
    getWellbeingSignals(organizationId, instrumentKey, dimension, itemIdsFor(instrumentKey), source),
    getWellbeingSignalPatterns(organizationId, instrumentKey, dimension, source),
  ]);

  return (
    <>
    {/* The evidence-first patterns lead: they are what a facilitator acts on.
        The item grid below is the supporting detail behind them. */}
    <section className="pulse-card flex flex-col gap-6 p-6 sm:p-9">
      <div>
        <h2 className="font-display text-h3 font-semibold">Areas to explore</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate">
          Aggregate patterns worth a conversation, strongest evidence first. Every figure below is
          computed from responses that already passed cohort suppression — none of it describes an
          individual, and none of it explains why a pattern exists.
        </p>
      </div>
      <SignalCards signals={signals} />
      <HowToRead
        seeing="Patterns detected across waves and groups, each with the figures behind it."
        matters="A single number rarely tells you where to look. A pattern that persists across several waves, or separates one group from another, is the kind of thing worth asking about."
        notTelling="It does not establish a cause, and it is not a clinical finding. These describe what a group reported — never why, and never about any individual."
      />
    </section>

    <section className="pulse-card flex flex-col gap-6 p-6 sm:p-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-h3 font-semibold">Item-level signal</h2>
          <p className="mt-1.5 text-sm text-slate">
            Share of responses on each questionnaire item indicating more difficulty than usual.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {COMPARE_DIMENSIONS.map((entry) => (
            <Link
              key={entry.key}
              href={`/wellbeing/analytics?org=${organizationId}&instrument=${instrumentKey}&tab=signals&by=${entry.key}&source=${source}`}
              className={`pulse-focus rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                entry.key === dimension
                  ? "border-pulse bg-pulse text-white"
                  : "border-[rgba(31,78,95,0.24)] text-slate hover:text-pulse"
              }`}
            >
              {entry.label}
            </Link>
          ))}
        </div>
      </div>

      <SignalHeatmap rows={rows} minCohort={minCohort} />

      <HowToRead
        seeing="For each questionnaire item, the share of responses in each group indicating more difficulty than usual."
        matters="A total score can be steady while one specific item moves underneath it. Reading items separately is how a pattern worth discussing becomes visible before it shows up in the headline figure."
        notTelling="An item is not a diagnosis and not a subscale. A high share on one item describes a group's answers to one question — it does not identify anyone, and it does not establish why they answered that way."
      />
    </section>
    </>
  );
}


/**
 * The organisation-wide six-dimension profile.
 *
 * A hero visual for DISC360 Wellbeing. The lowest-scoring dimension is named
 * as an AREA FOR ATTENTION — never a risk, never a finding, and never given a
 * cause.
 */
async function DimensionProfileSection({
  organizationId,
  instrumentKey,
  source,
}: {
  organizationId: string;
  instrumentKey: InstrumentKey;
  source: AnalyticsSource;
}) {
  const { context, view } = await getWellbeingDimensionProfile(
    organizationId,
    instrumentKey,
    source,
  );
  if (!view.dimensions || view.dimensions.length === 0) {
    return (
      <section className="pulse-card flex flex-col gap-5 p-6 sm:p-9">
        <h2 className="font-display text-h3 font-semibold">Dimension profile</h2>
        <SuppressionNotice minCohort={context.minCohort} />
      </section>
    );
  }

  return (
    <section className="pulse-card flex flex-col gap-6 p-6 sm:p-9">
      <div>
        <h2 className="font-display text-h3 font-semibold">Dimension profile</h2>
        <p className="mt-1.5 text-sm text-slate">
          Median score for each dimension across everyone who completed this pulse.
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {view.dimensions.map((entry) => (
          <li key={entry.key} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-sm font-medium text-ink">{entry.label}</span>
              <span className="ml-auto font-mono text-sm tabular-nums text-pulse-deep">
                {entry.median}
                <span className="text-faint"> / 100</span>
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-pulse-soft/60">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(entry.median, 1.5)}%`,
                  background: "var(--color-pulse)",
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      {view.highest && view.lowest && (
        <div className="grid gap-4 border-t border-[rgba(31,78,95,0.14)] pt-5 sm:grid-cols-2">
          <div>
            <p className="text-xs tracking-[0.12em] text-faint uppercase">
              {DISC_HIGHEST_DIMENSION_LABEL}
            </p>
            <p className="mt-1.5 text-sm text-ink">
              {view.highest.label} · {view.highest.median}
            </p>
          </div>
          <div>
            <p className="text-xs tracking-[0.12em] text-faint uppercase">
              {DISC_LOWEST_DIMENSION_LABEL}
            </p>
            <p className="mt-1.5 text-sm text-ink">
              {view.lowest.label} · {view.lowest.median}
            </p>
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed text-slate">{DISC_LOWER_DIMENSION_NOTE}</p>
    </section>
  );
}

/**
 * Field Based vs Office Based.
 *
 * Its own surface rather than a row in the generic comparison, because it is
 * the split management most often asks about and a two-group question deserves
 * a two-group composition. The work-location values come from the stored
 * taxonomy, not a hard-coded pair — an organisation that configures a third
 * value gets it here without a deployment.
 */
async function FieldVsOfficeSection({
  organizationId,
  instrumentKey,
  source,
  threshold,
  maxScore,
  scoreLabel,
  minCohort,
}: {
  organizationId: string;
  instrumentKey: InstrumentKey;
  source: AnalyticsSource;
  threshold: number | null;
  maxScore: number;
  scoreLabel: string;
  minCohort: number;
}) {
  const { view } = await getWellbeingComparison(
    organizationId,
    instrumentKey,
    "work_location",
    source,
  );

  return (
    <section className="pulse-card flex flex-col gap-7 p-6 sm:p-9">
      <div>
        <h2 className="font-display text-h3 font-semibold">Field vs Office</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate">
          Where people work is one of the few splits that reliably describes a different working
          day. Both groups are shown identically — neither is a benchmark for the other.
        </p>
      </div>

      <TwoCohortCompare
        cohorts={view.cohorts.map((cohort) => ({
          label: cohort.label,
          suppressed: cohort.suppressed,
          stats: cohort.stats ?? null,
        }))}
        scoreLabel={scoreLabel}
        scoreMax={maxScore}
        threshold={threshold}
        minCohort={minCohort}
      />

      <HowToRead
        seeing="The median score for each work-location group, with how many people are in each."
        matters="A field-based and an office-based working day differ in ways an organisation-wide average cannot show. Splitting them is often the fastest way to see whether one group's experience is diverging."
        notTelling="It does not say that working in the field or the office caused the difference, and it does not describe anyone individually. Group size, role and circumstance all differ alongside location."
      />
    </section>
  );
}
