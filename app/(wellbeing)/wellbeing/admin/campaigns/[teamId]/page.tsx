import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  loadCampaignIdentity,
  loadCampaignParticipation,
  loadCampaignTally,
  describeCurrentPeriod,
  PARTICIPANT_STATE_LABEL,
  type ParticipantState,
} from "@/lib/wellbeing/campaign-workspace";
import {
  getWellbeingCoverage,
  getWellbeingDimensionProfile,
  getWellbeingSignalPatterns,
  getWellbeingWorkspace,
  localFixtureOffered,
  parseAnalyticsSource,
} from "@/lib/wellbeing/analytics";
import { CampaignHeader, CampaignNav } from "@/components/wellbeing/campaign/CampaignChrome";
import { ReadinessPanel } from "@/components/wellbeing/campaign/ReadinessPanel";
import { LifecyclePanel } from "@/components/wellbeing/campaign/LifecyclePanel";
import { LiveParticipation } from "@/components/wellbeing/campaign/LiveParticipation";
import { JoinAccessPanel } from "@/components/wellbeing/campaign/JoinAccessPanel";
import { checkCampaignReadiness } from "@/lib/wellbeing/readiness";
import { Section } from "@/components/wellbeing/campaign/Section";
import { ParticipationProgress } from "@/components/wellbeing/campaign/ParticipationProgress";
import { CohortCoverage } from "@/components/wellbeing/campaign/CohortCoverage";
import { DistributionChart } from "@/components/wellbeing/analytics/DistributionChart";
import { DimensionRadar } from "@/components/wellbeing/analytics/DimensionRadar";
import { SignalCards } from "@/components/wellbeing/analytics/SignalCards";
import { SourceSwitch } from "@/components/wellbeing/analytics/SourceSwitch";
import { SuppressionNotice } from "@/components/wellbeing/analytics/SuppressionNotice";
import { AGGREGATE_ONLY_NOTICE } from "@/data/wellbeing-content";

export const metadata: Metadata = { title: "Campaign overview" };

/**
 * The campaign overview.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE QUESTION THIS PAGE ANSWERS.
 *
 * "What is happening in this workforce, how confident are we in the data, and
 * where should management look next?" — in that order, and as one argument
 * rather than a grid of tiles.
 *
 * So participation comes first, because it decides whether anything below it
 * is worth reading; the overall pattern second; coverage and confidentiality
 * before the cohort detail rather than as a footnote after it; and the signals
 * last, phrased as places to look rather than findings to act on.
 *
 * WHAT A FACILITATOR SEES WITHOUT A WELLBEING ROLE.
 *
 * Sections 1 and the roster. Nothing else on this page is computed for them —
 * `identity.canReport` gates the analytics calls themselves, so the figures
 * are not fetched and then hidden. Running a campaign and reading its
 * reporting are separate privileges, and this is what that looks like.
 * ─────────────────────────────────────────────────────────────────────
 */
export default async function CampaignOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { teamId } = await params;
  if (!z.uuid().safeParse(teamId).success) notFound();

  const [{ identity }, { source: sourceParam }] = await Promise.all([
    loadCampaignIdentity(teamId),
    searchParams,
  ]);
  const source = parseAnalyticsSource(sourceParam);
  const [participation, readiness, tally] = await Promise.all([
    loadCampaignParticipation(teamId, identity.instrumentKey),
    checkCampaignReadiness(teamId, identity.instrumentKey),
    // Rendered server-side so the panel is complete and correct before any
    // stream opens — and stays correct if one never does.
    loadCampaignTally(teamId, identity.instrumentKey, identity.capacity),
  ]);
  const period = describeCurrentPeriod(
    participation.waves.map((wave) => wave.label),
    new Date(),
  );

  const scope = { campaignId: teamId };
  const reporting =
    identity.canReport && identity.instrumentKey
      ? await Promise.all([
          getWellbeingWorkspace(identity.organizationId, identity.instrumentKey, source, scope),
          getWellbeingCoverage(identity.organizationId, identity.instrumentKey, source, scope),
          getWellbeingDimensionProfile(identity.organizationId, identity.instrumentKey, source, scope),
          getWellbeingSignalPatterns(
            identity.organizationId,
            identity.instrumentKey,
            "department",
            source,
            scope,
          ),
        ])
      : null;

  const [workspace, coverage, profile, patterns] = reporting ?? [null, null, null, null];
  const instrument = identity.instrument;
  const overview = workspace?.overview ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      {/*
        The header reports on whatever population is on screen. A synthetic
        reading gets the synthetic population's participation — a header
        saying "53 of 54 completed" above two hundred synthetic responses puts
        two populations on one page, which is the one confusion this workspace
        cannot afford.
      */}
      <CampaignHeader
        identity={identity}
        period={period}
        participation={workspace ? workspace.participation : participation.participation}
        completed={workspace ? workspace.participants : participation.completed}
        invited={workspace ? workspace.invited : participation.invited}
      />

      <div className="mt-7">
        <CampaignNav active="overview" campaignId={teamId} canReport={identity.canReport} />
      </div>

      {identity.canReport && identity.instrumentKey && (
        <div className="mt-6">
          <SourceSwitch
            source={source}
            organizationId={identity.organizationId}
            instrumentKey={identity.instrumentKey}
            tab="overview"
            basePath={`/wellbeing/admin/campaigns/${teamId}`}
            fixtureOffered={localFixtureOffered()}
          />
        </div>
      )}

      <div className="mt-8 flex flex-col gap-6">
        {/* Before anything else: a campaign nobody can complete. */}
        <ReadinessPanel readiness={readiness} />

        {/*
          The three questions a facilitator opens this page holding: what state
          is the campaign in, can people join, and what do I press. Above every
          figure, because a closed campaign makes the figures below it a report
          on something that has stopped.
        */}
        <LifecyclePanel
          teamId={teamId}
          lifecycle={identity.lifecycle}
          capacity={identity.capacity}
          joined={tally.joined}
          pausedAt={identity.pausedAt}
          closedAt={identity.closedAt}
        />

        {/* ── 01 · participation, live ─────────────────────────────── */}
        <Section
          index={1}
          title="Participants"
          lead={
            source === "live"
              ? "Updating as people join and finish — no refresh needed. Everything below this line is only as good as these numbers: a pattern drawn from a third of a workforce describes that third."
              : "The LIVE campaign's participation. The figures elsewhere on this page describe the synthetic population selected above, so these two counts are deliberately not the same thing."
          }
        >
          <LiveParticipation teamId={teamId} initial={tally} capacity={identity.capacity} />
          <ParticipationProgress participation={participation} capacity={identity.capacity} />
        </Section>

        {/* ── 02 · participant access ──────────────────────────────── */}
        {identity.instrumentKey && identity.joinUrl && (
          <Section
            index={2}
            title="How people join"
            lead="Hold this up, print it, or send the link. It always opens this campaign's own questionnaire."
          >
            <JoinAccessPanel
              campaignName={identity.name}
              joinUrl={identity.joinUrl}
              questionnaireName={identity.instrument?.name ?? null}
              fullscreenHref={`/wellbeing/admin/campaigns/${teamId}/qr`}
              lifecycle={identity.lifecycle}
              capacity={identity.capacity}
              joined={tally.joined}
            />
          </Section>
        )}

        {/* ── 03 · overall pattern ─────────────────────────────────── */}
        {reporting && instrument && (
          <Section
            index={3}
            title="Overall pattern"
            lead={
              instrument.scoreDirection === "higher_is_more_distress"
                ? `How this workforce is spread across the ${instrument.primaryScoreMin}–${instrument.primaryScoreMax} ${instrument.primaryScoreLabel.toLowerCase()}. A higher score reports more of what the instrument screens for; it is not a severity rating and not a diagnosis.`
                : `How this workforce is spread across the ${instrument.primaryScoreMin}–${instrument.primaryScoreMax} ${instrument.primaryScoreLabel.toLowerCase()}. A higher score reports more of the experience described.`
            }
            aside={overview ? `median ${overview.median} · mean ${overview.mean}` : undefined}
          >
            {overview ? (
              <>
                <DistributionChart
                  distribution={overview.distribution}
                  threshold={workspace!.context.threshold}
                  completed={overview.completed}
                  maxScore={overview.maxScore}
                  bucketSize={overview.bucketSize}
                />
                {workspace!.context.threshold !== null && (
                  <p className="font-mono text-xs text-slate tabular-nums">
                    At or above the configured threshold of {workspace!.context.threshold}:{" "}
                    {overview.atOrAboveThresholdShare}% ({overview.atOrAboveThreshold} of{" "}
                    {overview.completed} responses)
                  </p>
                )}
              </>
            ) : (
              <SuppressionNotice
                minCohort={workspace!.context.minCohort}
                detail="Too few people have completed this campaign for any group figure to be published yet. Nothing is being hidden from this page — no figure has been computed."
              />
            )}
          </Section>
        )}

        {/* ── 04 · dimension profile, where the questionnaire has one ─ */}
        {reporting && profile!.view.dimensions && profile!.view.dimensions.length > 0 && (
          <Section
            index={4}
            title={instrument!.subscales.length > 0 ? "Subscale profile" : "Dimension profile"}
            lead={
              instrument!.key === "disc360_wellbeing_v1"
                ? "The six dimensions this instrument measures, as medians across everyone who completed. They share one scale and no rank order — the shape is the reading, not the total."
                : instrument!.subscaleDescription
            }
          >
            {instrument!.key === "disc360_wellbeing_v1" ? (
              <DimensionRadar dimensions={profile!.view.dimensions} max={100} />
            ) : (
              <ul className="flex flex-col divide-y divide-hairline">
                {profile!.view.dimensions.map((dimension) => (
                  <li key={dimension.key} className="flex flex-col gap-2 py-3.5">
                    <div className="flex flex-wrap items-baseline gap-x-4">
                      <span className="text-sm font-medium text-ink">{dimension.label}</span>
                      <span className="ml-auto font-mono text-xs text-slate tabular-nums">
                        median{" "}
                        <strong className="font-display text-base text-ink">
                          {dimension.median}
                        </strong>
                      </span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-sand">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-pulse"
                        style={{
                          width: `${Math.min(100, (dimension.median / (instrument!.subscales[0]?.itemCount ?? 100)) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {instrument!.subscales.length > 0 && (
              <p className="text-xs leading-relaxed text-faint">
                Each subscale is a profile dimension only. None carries a threshold of its own,
                and none is reported as a finding about any group or person.
              </p>
            )}
          </Section>
        )}

        {/* ── 05 · movement ────────────────────────────────────────── */}
        {reporting && (
          <Section
            index={5}
            title="Movement"
            lead="How this campaign compares with its own previous wave. Composition changes between waves — different people answer — so a shift describes the responses received, not the same group of individuals moving."
            aside={
              workspace!.trend.points.length > 0
                ? `${workspace!.trend.points.length} wave${workspace!.trend.points.length === 1 ? "" : "s"}`
                : undefined
            }
          >
            {workspace!.trend.medianChange ? (
              <div className="flex flex-col gap-3">
                <p className="text-lead text-ink">
                  Median {instrument!.primaryScoreLabel.toLowerCase()} is{" "}
                  <strong className="font-medium">
                    {workspace!.trend.medianChange.movement === "unchanged"
                      ? "unchanged"
                      : `${Math.abs(workspace!.trend.medianChange.delta)} ${
                          Math.abs(workspace!.trend.medianChange.delta) === 1 ? "point" : "points"
                        } ${workspace!.trend.medianChange.movement}`}
                  </strong>{" "}
                  than the previous comparable wave.
                </p>
                <Link
                  href={`/wellbeing/admin/campaigns/${teamId}/trends?source=${source}`}
                  className="pulse-focus w-fit text-sm font-medium text-pulse underline underline-offset-4"
                >
                  Open the full trend →
                </Link>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-slate">
                {workspace!.trend.points.length <= 1
                  ? "Only one comparable wave has been recorded, so there is nothing to compare it against yet. A second wave makes this section meaningful."
                  : "No comparison is being drawn between these waves. Where the configured threshold changed between them, a rate comparison would describe the change in policy rather than a change in the workforce."}
              </p>
            )}
            {workspace!.trendSuppressedWaves > 0 && (
              <p className="font-mono text-xs text-faint">
                {workspace!.trendSuppressedWaves} wave
                {workspace!.trendSuppressedWaves === 1 ? " is" : "s are"} not plotted — too few
                responses to publish.
              </p>
            )}
          </Section>
        )}

        {/* ── 06 · coverage and confidentiality ────────────────────── */}
        {reporting && (
          <Section
            index={6}
            title="Coverage and confidentiality"
            lead="How much of this workforce can be reported on, before any comparison is read. Groups below the minimum are withheld and are never named, sized or reconstructable."
            aside={`minimum group ${coverage!.coverage.minCohort}`}
          >
            <CohortCoverage coverage={coverage!.coverage} />
            <p className="rounded-2xl border border-hairline bg-pulse-mist/50 px-5 py-4 text-sm leading-relaxed text-slate">
              {AGGREGATE_ONLY_NOTICE}
            </p>
          </Section>
        )}

        {/* ── 07 · where to look next ──────────────────────────────── */}
        {reporting && patterns!.signals.length > 0 && (
          <Section
            index={7}
            title="Where to look next"
            lead="Patterns the evidence layer found in the aggregate figures above. Each names the figures it is built from. None is a finding about a person, a cause, or a risk."
          >
            <SignalCards signals={patterns!.signals} />
          </Section>
        )}

        {/* ── roster ───────────────────────────────────────────────── */}
        <Section
          index={identity.canReport ? 8 : 3}
          title="Who is on the roster"
          lead="Administrative status only. Individual wellbeing scores and answers are not available on this page, in this workspace, or to any role in this product. Completing the questionnaire does not make anybody's result visible."
          aside={`${participation.invited} on the roster`}
        >
          {participation.participants.length === 0 ? (
            <p className="text-sm text-slate">
              Nobody has joined yet. Share the QR code or link above.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {participation.participants.map((participant) => (
                <li key={participant.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="text-sm font-medium text-ink">{participant.name}</span>
                  <span className="ml-auto">
                    <StateChip state={participant.state} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

const STATE_TONE: Record<ParticipantState, { background: string; color: string }> = {
  completed: { background: "var(--color-pulse-soft)", color: "var(--color-pulse-deep)" },
  started: { background: "var(--color-pulse-mist)", color: "var(--color-pulse-teal)" },
  opened: { background: "var(--color-sand)", color: "var(--color-slate)" },
  pending: { background: "transparent", color: "var(--color-faint)" },
};

function StateChip({ state }: { state: ParticipantState }) {
  const tone = STATE_TONE[state];
  return (
    <span
      className="rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: tone.background, color: tone.color }}
    >
      {PARTICIPANT_STATE_LABEL[state]}
    </span>
  );
}
