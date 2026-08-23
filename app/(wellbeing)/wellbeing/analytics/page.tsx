import type { Metadata } from "next";
import Link from "next/link";
import { resolveWellbeingScope } from "@/lib/wellbeing/access";
import {
  COMPARE_DIMENSIONS,
  getWellbeingComparison,
  getWellbeingSignals,
  getWellbeingWorkspace,
  type CompareDimension,
} from "@/lib/wellbeing/analytics";
import { WELLBEING_ITEM_STRUCTURE } from "@/data/wellbeing-items";
import {
  AGGREGATE_ONLY_NOTICE,
  NO_COMBINATION_NOTICE,
  THRESHOLD_POLICY_NOTE,
  WELLBEING_PRODUCT_DESCRIPTION,
} from "@/data/wellbeing-content";
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

export const metadata: Metadata = { title: "Wellbeing analytics" };

const ITEM_IDS = WELLBEING_ITEM_STRUCTURE.map((item) => item.externalId);

/** Which comparison dimension each tab drives. */
const TAB_DIMENSION: Partial<Record<string, CompareDimension>> = {
  compare: "department",
  teams: "team",
  locations: "work_location",
  signals: "department",
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
  searchParams: Promise<{ org?: string; tab?: string; by?: string }>;
}) {
  const { org, tab: tabParam, by } = await searchParams;
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

  const workspace = await getWellbeingWorkspace(organizationId);
  const { context, overview, trend } = workspace;

  const dimension: CompareDimension =
    (by as CompareDimension | undefined) ?? TAB_DIMENSION[tab] ?? "department";

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
          {WELLBEING_PRODUCT_DESCRIPTION}
        </p>
        <h1 className="font-display text-h2 font-semibold tracking-tight">Wellbeing Pulse</h1>
        <p className="text-sm text-slate">
          {context.organizationName} ·{" "}
          <span className="font-mono">
            threshold {context.threshold} · minimum group {context.minCohort}
          </span>
        </p>
      </header>

      {scope.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {scope.map((entry) => (
            <Link
              key={entry.organizationId}
              href={`/wellbeing/analytics?org=${entry.organizationId}&tab=${tab}`}
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

      <div className="mt-7">
        <WorkspaceNav active={tab} organizationId={organizationId} />
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
                      { label: "Completed", value: String(overview.completed) },
                      {
                        label: "Participation",
                        value:
                          overview.participation === null ? "—" : `${overview.participation}%`,
                        note:
                          overview.participation === null && workspace.invited > 0
                            ? "more completions than roster places — the invited list is incomplete"
                            : undefined,
                      },
                      {
                        label: "Median GHQ-12",
                        value: String(overview.median),
                        note: `mean ${overview.mean}`,
                      },
                      {
                        label: `At or above ${context.threshold}`,
                        value: `${overview.atOrAboveThresholdShare}%`,
                        note: `${overview.atOrAboveThreshold} of ${overview.completed}`,
                      },
                    ]}
                  />

                  <div className="border-t border-[rgba(31,78,95,0.14)] pt-8">
                    <h2 className="font-display text-h3 font-semibold">Score distribution</h2>
                    <p className="mt-1.5 mb-6 text-sm text-slate">
                      How the workforce is spread across the 0–12 screening range.
                    </p>
                    <DistributionChart
                      distribution={overview.distribution}
                      threshold={context.threshold}
                      completed={overview.completed}
                    />
                  </div>

                  {trend.medianChange && (
                    <div className="border-t border-[rgba(31,78,95,0.14)] pt-6">
                      <p className="text-sm text-slate">
                        Median GHQ-12 is{" "}
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

            <aside className="flex flex-col gap-3 rounded-2xl border border-[rgba(31,78,95,0.16)] bg-pulse-mist/60 p-5 text-sm leading-relaxed text-slate">
              <p>{AGGREGATE_ONLY_NOTICE}</p>
              <p>{NO_COMBINATION_NOTICE}</p>
              <p>{THRESHOLD_POLICY_NOTE}</p>
            </aside>
          </>
        )}

        {/* ── Compare / Teams / Locations ──────────────────────────── */}
        {(tab === "compare" || tab === "teams" || tab === "locations") && (
          <CompareSection
            organizationId={organizationId}
            tab={tab}
            dimension={dimension}
            threshold={context.threshold}
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
              <AggregateTrend trend={trend} />
            ) : (
              <SuppressionNotice minCohort={context.minCohort} />
            )}
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

        {/* ── Signals ──────────────────────────────────────────────── */}
        {tab === "signals" && (
          <SignalsSection
            organizationId={organizationId}
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
  tab,
  dimension,
  threshold,
  minCohort,
}: {
  organizationId: string;
  tab: string;
  dimension: CompareDimension;
  threshold: number;
  minCohort: number;
}) {
  const { view } = await getWellbeingComparison(organizationId, dimension);
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
          <h2 className="font-display text-h3 font-semibold">{view.label}</h2>
          <p className="mt-1.5 text-sm text-slate">
            Median GHQ-12 and the share at or above the threshold, by group.
          </p>
        </div>

        {showPicker && (
          <div className="flex flex-wrap gap-2">
            {choices.map((entry) => (
              <Link
                key={entry.key}
                href={`/wellbeing/analytics?org=${organizationId}&tab=${tab}&by=${entry.key}`}
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
        <CohortStrip cohorts={view.cohorts} threshold={threshold} minCohort={minCohort} />
      )}

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
  dimension,
  minCohort,
}: {
  organizationId: string;
  dimension: CompareDimension;
  minCohort: number;
}) {
  const { rows } = await getWellbeingSignals(organizationId, dimension, ITEM_IDS);

  return (
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
              href={`/wellbeing/analytics?org=${organizationId}&tab=signals&by=${entry.key}`}
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
    </section>
  );
}
