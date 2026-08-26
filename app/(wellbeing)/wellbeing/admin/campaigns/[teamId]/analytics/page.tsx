import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { loadCampaignReporting } from "@/lib/wellbeing/campaign-workspace";
import {
  getWellbeingDimensionProfile,
  getWellbeingSignals,
  getWellbeingWorkspace,
  localFixtureOffered,
} from "@/lib/wellbeing/analytics";
import {
  aggregateWellbeingLevel,
  analyticsPlanFor,
  itemIdsFor,
} from "@/lib/wellbeing/instrument-analytics";
import { CampaignHeader, CampaignNav } from "@/components/wellbeing/campaign/CampaignChrome";
import { CampaignFrame } from "@/components/wellbeing/campaign/CampaignFrame";
import { ReportingUnavailable } from "@/components/wellbeing/campaign/ReportingUnavailable";
import { Section } from "@/components/wellbeing/campaign/Section";
import { DistributionChart } from "@/components/wellbeing/analytics/DistributionChart";
import { DimensionRadar } from "@/components/wellbeing/analytics/DimensionRadar";
import { DimensionBars } from "@/components/wellbeing/analytics/DimensionBars";
import { SignalHeatmap } from "@/components/wellbeing/analytics/SignalHeatmap";
import { StatRow } from "@/components/wellbeing/analytics/StatRow";
import { SourceSwitch } from "@/components/wellbeing/analytics/SourceSwitch";
import { SuppressionNotice } from "@/components/wellbeing/analytics/SuppressionNotice";
import { HowToRead } from "@/components/wellbeing/analytics/HowToRead";

export const metadata: Metadata = { title: "Campaign analytics" };

/**
 * The campaign's instrument analytics.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT DECIDES WHAT APPEARS HERE.
 *
 * The instrument, through `analyticsPlanFor` — not this page. GHQ-12 has one
 * score and no subscales, GHQ-28 has four published domains, WHO-5 has five
 * items and no configured cut-off, and DISC360 Wellbeing has six dimensions on
 * a shared scale. Rendering the same four charts for all of them would mean
 * inventing three constructs, so a section whose instrument supports nothing
 * simply is not here.
 *
 * Every figure is an aggregate that passed suppression on the server before it
 * became a return value. There is no individual view to reach from this page,
 * because no query behind it can produce one.
 * ─────────────────────────────────────────────────────────────────────
 */
export default async function CampaignAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { teamId } = await params;
  if (!z.uuid().safeParse(teamId).success) notFound();
  const { source: sourceParam } = await searchParams;

  const resolved = await loadCampaignReporting(teamId, sourceParam);
  if (!resolved.ok) {
    return (
      <CampaignFrame identity={resolved.identity} tab="analytics">
        <ReportingUnavailable campaignId={teamId} reason={resolved.reason} />
      </CampaignFrame>
    );
  }

  const { identity, instrumentKey, instrument, source, scope, period, headline } =
    resolved.context;
  const plan = analyticsPlanFor(instrumentKey);

  const [workspace, profile, signals] = await Promise.all([
    getWellbeingWorkspace(identity.organizationId, instrumentKey, source, scope),
    getWellbeingDimensionProfile(identity.organizationId, instrumentKey, source, scope),
    plan.itemPatterns
      ? getWellbeingSignals(
          identity.organizationId,
          instrumentKey,
          "department",
          itemIdsFor(instrumentKey),
          source,
          scope,
        )
      : Promise.resolve(null),
  ]);

  const { context, overview } = workspace;
  const level = overview ? aggregateWellbeingLevel(plan, overview.median) : null;

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
        <CampaignNav active="analytics" campaignId={teamId} canReport />
      </div>

      <div className="mt-6">
        <SourceSwitch
          source={source}
          organizationId={identity.organizationId}
          instrumentKey={instrumentKey}
          tab="analytics"
          basePath={`/wellbeing/admin/campaigns/${teamId}/analytics`}
          fixtureOffered={localFixtureOffered()}
        />
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {/* ── 01 · the primary score ───────────────────────────────── */}
        <Section
          index={1}
          title={instrument.primaryScoreLabel}
          lead={`${instrument.descriptor}. ${instrument.itemCount} items, ${instrument.responseOptionCount} response options, scored ${instrument.primaryScoreMin}–${instrument.primaryScoreMax} by ${instrument.scoringMethod}.`}
          aside={`${overview?.completed ?? 0} responses`}
        >
          {overview ? (
            <>
              <StatRow
                stats={[
                  {
                    label: "Participants",
                    value: String(workspace.participants),
                    note: `${overview.completed} response${overview.completed === 1 ? "" : "s"} across all waves`,
                  },
                  {
                    label: "Median",
                    value: String(overview.median),
                    // The level is a sentence, not a figure. Set in the
                    // display face at figure size it wrapped to two lines and
                    // competed with the numbers beside it — and it is already
                    // stated in full under the chart.
                    note: level ? `mean ${overview.mean} · ${level.label.toLowerCase()}` : `mean ${overview.mean}`,
                  },
                  ...(plan.thresholdRate && context.threshold !== null
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

              <div className="border-t border-hairline pt-7">
                <DistributionChart
                  distribution={overview.distribution}
                  threshold={plan.thresholdRate ? context.threshold : null}
                  completed={overview.completed}
                  maxScore={overview.maxScore}
                  bucketSize={overview.bucketSize}
                />
              </div>

              {level && <p className="text-sm leading-relaxed text-slate">{level.detail}</p>}

              <HowToRead
                seeing={`How many responses fell in each part of the ${instrument.primaryScoreMin}–${instrument.primaryScoreMax} ${instrument.primaryScoreLabel.toLowerCase()} range.`}
                matters="An average alone cannot tell you whether people are clustered together or spread far apart. Two workforces with the same median can look completely different here, and the shape is usually the more useful of the two."
                notTelling={
                  plan.thresholdRate
                    ? "It does not explain why the pattern exists, and it identifies nobody. A score at or above the threshold indicates that a fuller conversation may be warranted — it is not a diagnosis of the person or of the group."
                    : "It does not explain why the pattern exists, and it identifies nobody. This instrument has no configured cut-off, so no part of the range means more than the number it shows."
                }
              />
            </>
          ) : (
            <SuppressionNotice
              minCohort={context.minCohort}
              detail="Too few people have completed this campaign for any group figure to be published. No figure has been computed — nothing is being withheld from the page."
            />
          )}
        </Section>

        {/* ── 02 · sub-scores, only where the instrument has them ──── */}
        {plan.dimensionForm && profile.view.dimensions && profile.view.dimensions.length > 0 && (
          <Section
            index={2}
            title={plan.dimensionHeading ?? "Profile"}
            lead={instrument.subscaleDescription}
            aside={`0–${plan.dimensionMax}`}
          >
            {plan.dimensionForm === "radar" ? (
              <DimensionRadar dimensions={profile.view.dimensions} max={plan.dimensionMax} />
            ) : (
              <DimensionBars
                dimensions={profile.view.dimensions}
                max={plan.dimensionMax}
                direction={instrument.scoreDirection}
              />
            )}

            {profile.view.highest && profile.view.lowest && (
              <p className="text-sm leading-relaxed text-slate">
                <strong className="font-medium text-ink">{profile.view.highest.label}</strong>{" "}
                carries the highest median and{" "}
                <strong className="font-medium text-ink">{profile.view.lowest.label}</strong>{" "}
                the lowest. That is a comparison between this workforce&rsquo;s own answers, not
                against a norm, another organisation or a standard.
              </p>
            )}
          </Section>
        )}

        {/* ── 03 · item patterns ───────────────────────────────────── */}
        {signals && signals.organizationWide && (
          <Section
            index={plan.dimensionForm ? 3 : 2}
            title="Response patterns by item"
            lead="How this workforce answered each question, as independent proportions. Nothing here is summed, weighted or combined — this instrument's structure decides what may be aggregated, and single items are not it."
          >
            <ul className="flex flex-col divide-y divide-hairline">
              {signals.organizationWide.map((signal) => (
                <li key={signal.itemId} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
                  <span className="font-mono text-xs text-slate">{signal.itemId}</span>
                  <span className="ml-auto font-mono text-xs text-slate tabular-nums">
                    elevated{" "}
                    <strong className="font-display text-base text-ink">
                      {signal.elevatedShare}%
                    </strong>
                    <span className="text-faint"> of {signal.completed}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── 04 · cohort item heatmap ─────────────────────────────── */}
        {signals && signals.rows.length > 0 && (
          <Section
            index={plan.dimensionForm ? 4 : 3}
            title="Item patterns by function"
            lead="The same proportions, split by Department / Function. Groups below the minimum are withheld and stay withheld here."
            aside={`minimum group ${context.minCohort}`}
          >
            <SignalHeatmap rows={signals.rows} minCohort={context.minCohort} />
          </Section>
        )}

        {/* ── what this instrument does and does not support ───────── */}
        <section className="pulse-card flex flex-col gap-4 p-6 sm:p-9">
          <h2 className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">
            About {instrument.name} analytics
          </h2>
          <ul className="flex flex-col gap-2.5 text-sm leading-relaxed text-slate">
            {plan.notes.map((note) => (
              <li key={note} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-pulse-teal"
                />
                {note}
              </li>
            ))}
            <li className="flex gap-2.5">
              <span
                aria-hidden="true"
                className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-pulse-teal"
              />
              {instrument.name} is {instrument.notClaims.join(", ")}.
            </li>
          </ul>
          {instrument.attribution && (
            <p className="border-t border-hairline pt-4 text-xs leading-relaxed text-faint">
              {instrument.attribution}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
