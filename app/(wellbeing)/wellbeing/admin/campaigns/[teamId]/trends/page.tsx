import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { loadCampaignReporting } from "@/lib/wellbeing/campaign-workspace";
import {
  COMPARE_DIMENSIONS,
  getWellbeingCohortMovement,
  getWellbeingWorkspace,
  localFixtureOffered,
  type CompareDimension,
} from "@/lib/wellbeing/analytics";
import { analyticsPlanFor } from "@/lib/wellbeing/instrument-analytics";
import { CampaignHeader, CampaignNav } from "@/components/wellbeing/campaign/CampaignChrome";
import { CampaignFrame } from "@/components/wellbeing/campaign/CampaignFrame";
import { ReportingUnavailable } from "@/components/wellbeing/campaign/ReportingUnavailable";
import { Section } from "@/components/wellbeing/campaign/Section";
import { AggregateTrend } from "@/components/wellbeing/analytics/AggregateTrend";
import { CohortMovement } from "@/components/wellbeing/analytics/CohortMovement";
import { SourceSwitch } from "@/components/wellbeing/analytics/SourceSwitch";
import { SuppressionNotice } from "@/components/wellbeing/analytics/SuppressionNotice";
import { HowToRead } from "@/components/wellbeing/analytics/HowToRead";
import { THRESHOLD_POLICY_NOTE } from "@/data/wellbeing-content";

export const metadata: Metadata = { title: "Campaign trends" };

/**
 * The longitudinal workspace.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE DISTINCTION THIS PAGE EXISTS TO MAKE.
 *
 * Between two waves, two different things can change: WHO ANSWERED, and WHAT
 * THEY REPORTED. A trend line collapses both into one movement, and a reader
 * with only that line will attribute all of it to the second.
 *
 * So participation is reported as its own series, next to the medians and
 * never on the same axis. Where the composition of respondents shifted enough
 * to matter, the page says so in words rather than leaving it to be inferred
 * from a bar height.
 *
 * TWO RULES ABOUT THRESHOLDS, BOTH PRESERVED.
 *
 * Historical waves are never rescored under a new threshold — each result
 * keeps the threshold that applied when it was completed. And where those
 * thresholds differ between waves, the "% at or above" series is not drawn at
 * all, because a continuous line across a policy change reports a movement in
 * people that was a movement in policy. The median stays comparable and stays
 * drawn.
 * ─────────────────────────────────────────────────────────────────────
 */
export default async function CampaignTrendsPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ source?: string; by?: string }>;
}) {
  const { teamId } = await params;
  if (!z.uuid().safeParse(teamId).success) notFound();
  const { source: sourceParam, by } = await searchParams;

  const resolved = await loadCampaignReporting(teamId, sourceParam);
  if (!resolved.ok) {
    return (
      <CampaignFrame identity={resolved.identity} tab="trends">
        <ReportingUnavailable campaignId={teamId} reason={resolved.reason} />
      </CampaignFrame>
    );
  }

  const { identity, instrumentKey, instrument, source, scope, period, headline } =
    resolved.context;
  const plan = analyticsPlanFor(instrumentKey);

  // Waves are a period, not a division of the workforce — comparing cohorts
  // BY wave here would just redraw the line above.
  const dimensions = COMPARE_DIMENSIONS.filter((entry) => entry.key !== "wave");
  const dimension: CompareDimension = dimensions.some((entry) => entry.key === by)
    ? (by as CompareDimension)
    : "department";

  const [workspace, movement] = await Promise.all([
    getWellbeingWorkspace(identity.organizationId, instrumentKey, source, scope),
    getWellbeingCohortMovement(identity.organizationId, instrumentKey, dimension, source, scope),
  ]);

  const { trend, context } = workspace;
  const base = `/wellbeing/admin/campaigns/${teamId}/trends`;

  const responses = trend.points.map((point) => point.aggregate.completed);
  const compositionShift =
    responses.length >= 2
      ? Math.abs(responses[responses.length - 1]! - responses[responses.length - 2]!)
      : 0;
  const compositionShare =
    responses.length >= 2 && responses[responses.length - 2]! > 0
      ? Math.round((compositionShift / responses[responses.length - 2]!) * 100)
      : 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <CampaignHeader
        identity={identity}
        period={period}
        participation={headline.participation}
        completed={headline.completed}
        invited={headline.invited}
      />

      <div className="mt-7">
        <CampaignNav active="trends" campaignId={teamId} canReport />
      </div>

      <div className="mt-6">
        <SourceSwitch
          source={source}
          organizationId={identity.organizationId}
          instrumentKey={instrumentKey}
          tab="trends"
          basePath={base}
          fixtureOffered={localFixtureOffered()}
        />
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {/* ── 01 · the overall series ──────────────────────────────── */}
        <Section
          index={1}
          title="Across waves"
          lead={`Median ${instrument.primaryScoreLabel.toLowerCase()} for each wave of this campaign, with the number of responses each one received. Waves with too few responses to publish are not plotted at all — a visible gap with a date on it is itself a disclosure about a small wave.`}
          aside={
            trend.points.length > 0
              ? `${trend.points.length} wave${trend.points.length === 1 ? "" : "s"} plotted`
              : undefined
          }
        >
          {trend.points.length === 0 ? (
            <SuppressionNotice
              minCohort={context.minCohort}
              detail="No wave of this campaign has enough responses to publish yet."
            />
          ) : (
            <>
              <AggregateTrend
                trend={trend}
                scoreLabel={instrument.primaryScoreLabel}
                scoreMax={instrument.primaryScoreMax}
                hasThreshold={plan.thresholdRate}
                showParticipation
              />

              {trend.medianChange && (
                <p className="text-lead text-ink">
                  Against the previous comparable wave the median is{" "}
                  <strong className="font-medium">
                    {trend.medianChange.movement === "unchanged"
                      ? "unchanged"
                      : `${Math.abs(trend.medianChange.delta)} ${
                          Math.abs(trend.medianChange.delta) === 1 ? "point" : "points"
                        } ${trend.medianChange.movement}`}
                  </strong>
                  .
                </p>
              )}
            </>
          )}

          {workspace.trendSuppressedWaves > 0 && (
            <p className="font-mono text-xs text-faint">
              {workspace.trendSuppressedWaves} wave
              {workspace.trendSuppressedWaves === 1 ? " is" : "s are"} not plotted — too few
              responses to publish.
            </p>
          )}
        </Section>

        {/* ── 02 · composition vs measurement ──────────────────────── */}
        <Section
          index={2}
          title="Who answered, and what they reported"
          lead="Two different things change between waves. Separating them is the difference between a finding and a coincidence."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-2xl border border-hairline bg-pulse-mist/50 p-5">
              <h3 className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">
                Change in who answered
              </h3>
              <p className="text-sm leading-relaxed text-slate">
                {responses.length < 2 ? (
                  "Only one wave has been published, so there is no change in composition to describe yet."
                ) : compositionShare === 0 ? (
                  "The same number of responses were received in the last two published waves. That does not guarantee the same people answered."
                ) : (
                  <>
                    The number of responses changed by{" "}
                    <strong className="font-medium text-ink">{compositionShare}%</strong> between
                    the last two published waves ({responses[responses.length - 2]} →{" "}
                    {responses[responses.length - 1]}).
                    {compositionShare >= 20 &&
                      " That is a large enough shift that part of any movement above may be a change in who took part rather than a change in what was reported."}
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-col gap-2 rounded-2xl border border-hairline bg-pulse-mist/50 p-5">
              <h3 className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">
                Change in what was reported
              </h3>
              <p className="text-sm leading-relaxed text-slate">
                {trend.medianChange
                  ? trend.medianChange.movement === "unchanged"
                    ? "The median is unchanged between the last two published waves."
                    : `The median moved ${Math.abs(trend.medianChange.delta)} ${Math.abs(trend.medianChange.delta) === 1 ? "point" : "points"} ${trend.medianChange.movement} (${trend.medianChange.previous} → ${trend.medianChange.current}).`
                  : "There is no comparable pair of waves to draw a movement between."}{" "}
                Responses are anonymous and each wave is answered by whoever chose to take part, so
                this describes the responses received — not the same individuals moving.
              </p>
            </div>
          </div>

          {plan.thresholdRate && (
            <p className="rounded-2xl border border-hairline bg-canvas px-5 py-4 text-xs leading-relaxed text-slate">
              {THRESHOLD_POLICY_NOTE}
            </p>
          )}
        </Section>

        {/* ── 03 · cohort movement ─────────────────────────────────── */}
        <Section
          index={3}
          title="Movement by group"
          lead="Each group's own median across the same waves, on one shared scale. Groups are shown alphabetically and are never ordered by their figures."
          aside={movement.view.label}
        >
          <div className="flex flex-wrap gap-2">
            {dimensions.map((entry) => (
              <Link
                key={entry.key}
                href={`${base}?source=${source}&by=${entry.key}`}
                aria-current={entry.key === dimension ? "true" : undefined}
                className={`pulse-focus rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  entry.key === dimension
                    ? "border-pulse bg-pulse text-white"
                    : "border-hairline text-slate hover:border-pulse hover:text-pulse"
                }`}
              >
                {entry.label}
              </Link>
            ))}
          </div>

          <CohortMovement view={movement.view} />

          <HowToRead
            seeing="Each panel is one group's median across the waves of this campaign, drawn on the same scale so the panels can be compared by shape."
            matters="Groups rarely move together. A workforce median that barely shifts can hide one part moving up and another moving down, and only the separate panels show that."
            notTelling="It does not say why a group moved, and it identifies nobody. A group is a different set of respondents in each wave, so a movement is a movement in what was reported — not the same people changing."
          />
        </Section>
      </div>
    </div>
  );
}
