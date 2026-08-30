import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  describeCurrentPeriod,
  loadCampaignIdentity,
  loadCampaignParticipation,
  loadCampaignTally,
} from "@/lib/wellbeing/campaign-workspace";
import {
  INSTRUMENT_KEYS,
  INSTRUMENTS,
  canServeToParticipants,
  unavailableReason,
} from "@/data/wellbeing-instruments";
import { isProductionEnvironment, isWellbeingDemoEnabled } from "@/lib/wellbeing/environment";
import { InstrumentPicker, type InstrumentOption } from "@/components/wellbeing/InstrumentPicker";
import { CampaignHeader, CampaignNav } from "@/components/wellbeing/campaign/CampaignChrome";
import { LifecyclePanel } from "@/components/wellbeing/campaign/LifecyclePanel";
import { ReadinessPanel } from "@/components/wellbeing/campaign/ReadinessPanel";
import { checkCampaignReadiness } from "@/lib/wellbeing/readiness";
import { Section } from "@/components/wellbeing/campaign/Section";
import { JoinAccessPanel } from "@/components/wellbeing/campaign/JoinAccessPanel";

export const metadata: Metadata = { title: "Campaign settings" };

/**
 * Status label for a questionnaire's availability, in words a facilitator can
 * act on. The registry's own status values (`demo_restricted`,
 * `structure_only`) name a mechanism; these name a consequence.
 */
const AVAILABILITY_LABEL: Record<string, string> = {
  active: "Available",
  demo_restricted: "Awaiting licence",
  structure_only: "Wording not yet loaded",
  licensed: "Licensed, not yet switched on",
  retired: "Retired",
};

/**
 * Campaign settings — status, questionnaire and participant access.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT WAS REMOVED FROM THIS PAGE, AND WHY.
 *
 * It had grown into a commentary on its own implementation. A facilitator
 * running an Occupational Health programme was reading:
 *
 *   · "Derived from the campaign's own state rather than stored separately —
 *      a stored status drifts from the join link…"
 *   · "The link carries the campaign's own opaque token…"
 *   · "…resolves to this campaign's pinned questionnaire version"
 *   · a team code — PIPEL-7666 — printed as the section's identifier
 *   · "changeable" as a status word
 *
 * Every one of those is true, and none of them is the facilitator's business.
 * The team code in particular is a DISC join credential that has no meaning in
 * a wellbeing campaign and must not be read as one. The reasoning it all
 * described now lives where reasoning belongs — in the modules that implement
 * it — and this page says what is true for the person running the campaign.
 *
 * Nothing on this page reads a score.
 * ─────────────────────────────────────────────────────────────────────
 */
export default async function CampaignSettingsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  if (!z.uuid().safeParse(teamId).success) notFound();

  const { identity } = await loadCampaignIdentity(teamId);
  const [participation, readiness, tally] = await Promise.all([
    loadCampaignParticipation(teamId, identity.instrumentKey),
    checkCampaignReadiness(teamId, identity.instrumentKey),
    // The same counting rule as the overview's live panel — see the note there.
    loadCampaignTally(teamId, identity.instrumentKey, identity.capacity),
  ]);
  const period = describeCurrentPeriod(
    participation.waves.map((wave) => wave.label),
    new Date(),
  );

  const isProduction = isProductionEnvironment();
  const demoEnabled = isWellbeingDemoEnabled();

  const options: InstrumentOption[] = INSTRUMENT_KEYS.map((key) => {
    const decision = canServeToParticipants(key, { isProduction, demoEnabled });
    return {
      key,
      status: INSTRUMENTS[key].status,
      selectable: decision.allowed,
      statusLabel: AVAILABILITY_LABEL[INSTRUMENTS[key].status] ?? unavailableReason(key),
      contentLoaded: INSTRUMENTS[key].status !== "structure_only",
      releaseScope: INSTRUMENTS[key].releaseScope,
      releaseScopeNote: INSTRUMENTS[key].releaseScopeNote,
    };
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <CampaignHeader
        identity={identity}
        period={period}
        participation={tally.completionRate}
        completed={tally.completed}
        invited={tally.joined}
      />

      <div className="mt-7">
        <CampaignNav active="settings" campaignId={teamId} canReport={identity.canReport} />
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <ReadinessPanel readiness={readiness} />

        {/* ── the campaign's operational state, and the control ────── */}
        <LifecyclePanel
          teamId={teamId}
          lifecycle={identity.lifecycle}
          capacity={identity.capacity}
          joined={tally.joined}
          pausedAt={identity.pausedAt}
          closedAt={identity.closedAt}
        />

        {/* ── 01 · questionnaire ───────────────────────────────────── */}
        <Section index={1} title="Questionnaire">
          <InstrumentPicker
            teamId={teamId}
            options={options}
            current={identity.instrumentKey}
            locked={identity.questionnaireLocked}
            currentName={identity.instrument?.name ?? null}
            currentItemCount={identity.instrument?.itemCount ?? null}
          />
        </Section>

        {/* ── 02 · participant access ──────────────────────────────── */}
        {/* A campaign with no join token has nothing to hand out, and showing
            the roster team's invite link instead would give participants a
            DISC credential that resolves to a different product entirely. */}
        {identity.instrumentKey && identity.joinUrl && (
          <Section
            index={2}
            title="Participant access"
            lead="What participants scan or open to take part. It always opens this campaign's own questionnaire."
          >
            <JoinAccessPanel
              campaignName={identity.name}
              joinUrl={identity.joinUrl}
              questionnaireName={identity.instrument?.name ?? null}
              fullscreenHref={`/wellbeing/admin/campaigns/${teamId}/qr`}
              lifecycle={identity.lifecycle}
              capacity={identity.capacity}
              joined={tally.joined}
              size="compact"
            />
          </Section>
        )}

        <nav className="flex flex-wrap gap-3">
          <Link
            href="/wellbeing/admin/campaigns"
            className="pulse-focus rounded-full border border-hairline px-5 py-2.5 text-sm font-medium text-slate transition-colors hover:text-pulse-deep"
          >
            ← All campaigns
          </Link>
          <Link
            href="/wellbeing/admin/instruments"
            className="pulse-focus rounded-full border border-hairline px-5 py-2.5 text-sm font-medium text-slate transition-colors hover:text-pulse-deep"
          >
            Compare questionnaires
          </Link>
        </nav>
      </div>
    </div>
  );
}
