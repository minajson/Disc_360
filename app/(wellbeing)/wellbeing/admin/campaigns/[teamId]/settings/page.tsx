import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  CAMPAIGN_STATUS_DETAIL,
  CAMPAIGN_STATUS_LABEL,
  describeCurrentPeriod,
  loadCampaignIdentity,
  loadCampaignParticipation,
} from "@/lib/wellbeing/campaign-workspace";
import { getPublicBaseUrl } from "@/lib/utils/site-url";
import {
  INSTRUMENT_KEYS,
  INSTRUMENTS,
  canServeToParticipants,
  unavailableReason,
} from "@/data/wellbeing-instruments";
import { isProductionEnvironment, isWellbeingDemoEnabled } from "@/lib/wellbeing/environment";
import { InstrumentPicker, type InstrumentOption } from "@/components/wellbeing/InstrumentPicker";
import { PilotPanel } from "@/components/wellbeing/PilotPanel";
import { CampaignHeader, CampaignNav } from "@/components/wellbeing/campaign/CampaignChrome";
import { ReadinessPanel } from "@/components/wellbeing/campaign/ReadinessPanel";
import { checkCampaignReadiness } from "@/lib/wellbeing/readiness";
import { Section } from "@/components/wellbeing/campaign/Section";

export const metadata: Metadata = { title: "Campaign settings" };

const STATUS_LABEL: Record<string, string> = {
  active: "Available",
  demo_restricted: "Awaiting digital-use licence",
  structure_only: "Content verification required",
  licensed: "Licensed, not yet activated",
  retired: "Retired",
};

/**
 * Campaign settings — the instrument, the join route and the pilot limit.
 *
 * The instrument is the consequential one. A campaign's QR code and join link
 * are printed, projected and forwarded, so they have to mean one thing
 * permanently: 00029 locks the instrument the moment anybody answers, and the
 * picker below reflects that lock rather than reimplementing it.
 *
 * Nothing on this page reads a score. The pilot panel receives four integers
 * and a link, and the roster lives on Overview as administrative status only.
 */
export default async function CampaignSettingsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  if (!z.uuid().safeParse(teamId).success) notFound();

  const { identity, pilot } = await loadCampaignIdentity(teamId);
  const [participation, readiness] = await Promise.all([
    loadCampaignParticipation(teamId, identity.instrumentKey),
    checkCampaignReadiness(teamId, identity.instrumentKey),
  ]);
  const period = describeCurrentPeriod(
    participation.waves.map((wave) => wave.label),
    new Date(),
  );

  const isProduction = isProductionEnvironment();
  const demoEnabled = isWellbeingDemoEnabled();
  const locked = pilot.joined > 0 || participation.opened > 0;

  const options: InstrumentOption[] = INSTRUMENT_KEYS.map((key) => {
    const decision = canServeToParticipants(key, { isProduction, demoEnabled });
    return {
      key,
      status: INSTRUMENTS[key].status,
      selectable: decision.allowed,
      statusLabel: STATUS_LABEL[INSTRUMENTS[key].status] ?? unavailableReason(key),
      contentLoaded: key === "disc360_wellbeing_v1",
    };
  });

  const joinUrl = `${getPublicBaseUrl().url}/wellbeing/join/${identity.inviteToken}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <CampaignHeader
        identity={identity}
        period={period}
        participation={participation.participation}
        completed={participation.completed}
        invited={participation.invited}
      />

      <div className="mt-7">
        <CampaignNav active="settings" campaignId={teamId} canReport={identity.canReport} />
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <ReadinessPanel readiness={readiness} />

        {/* ── 01 · status ──────────────────────────────────────────── */}
        <Section
          index={1}
          title="Campaign status"
          lead="Derived from the campaign's own state rather than stored separately — a stored status drifts from the join link and the capacity limit the moment one of them changes without it."
          aside={identity.teamCode}
        >
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
                Status
              </dt>
              <dd className="text-sm font-medium text-ink">
                {CAMPAIGN_STATUS_LABEL[identity.status]}
              </dd>
              <p className="text-xs leading-relaxed text-slate">
                {CAMPAIGN_STATUS_DETAIL[identity.status]}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
                Organisation
              </dt>
              <dd className="text-sm font-medium text-ink">{identity.organizationName}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
                Wave
              </dt>
              <dd className="text-sm font-medium text-ink">
                {period.label} · {period.period}
              </dd>
              <p className="text-xs leading-relaxed text-slate">
                {participation.waves.length === 0
                  ? "No wave has recorded a completion yet."
                  : `${participation.waves.length} wave${participation.waves.length === 1 ? "" : "s"} recorded so far.`}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
                Reporting access
              </dt>
              <dd className="text-sm font-medium text-ink">
                {identity.canReport ? "Granted to you" : "Not granted to you"}
              </dd>
              <p className="text-xs leading-relaxed text-slate">
                Wellbeing reporting is a separate privilege from administering this campaign. It is
                granted explicitly, per organisation, and recorded.
              </p>
            </div>
          </dl>
        </Section>

        {/* ── 02 · instrument ──────────────────────────────────────── */}
        <Section
          index={2}
          title="Questionnaire"
          lead="One instrument per campaign, fixed as soon as the first person answers. Participants are never asked to choose — they scan a code and answer the instrument chosen here."
          aside={locked ? "locked" : "changeable"}
        >
          <InstrumentPicker
            teamId={teamId}
            options={options}
            current={identity.instrumentKey}
            locked={locked}
            attemptCount={pilot.joined}
          />
        </Section>

        {/* ── 03 · joining ─────────────────────────────────────────── */}
        {identity.instrumentKey && (
          <Section
            index={3}
            title="Join link and QR code"
            lead="What participants scan or open. The link carries an opaque token, never an internal id, and it resolves to this campaign's instrument and to nothing else."
          >
            <PilotPanel
              campaignName={identity.name}
              joinUrl={joinUrl}
              fullscreenHref={`/wellbeing/admin/campaigns/${teamId}/qr`}
              capacity={pilot.capacity}
              joined={pilot.joined}
              completed={pilot.completed}
              inProgress={pilot.inProgress}
              remaining={pilot.remaining}
              isFull={pilot.isFull}
            />
          </Section>
        )}

        <nav className="flex flex-wrap gap-3">
          <Link
            href="/wellbeing/admin/instruments"
            className="pulse-focus rounded-full border border-hairline px-5 py-2.5 text-sm font-medium text-slate transition-colors hover:text-pulse-deep"
          >
            Compare instruments
          </Link>
          <Link
            href="/wellbeing/admin/pilot"
            className="pulse-focus rounded-full border border-hairline px-5 py-2.5 text-sm font-medium text-slate transition-colors hover:text-pulse-deep"
          >
            All campaigns
          </Link>
        </nav>
      </div>
    </div>
  );
}
