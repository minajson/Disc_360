import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { loadCampaignReporting } from "@/lib/wellbeing/campaign-workspace";
import { LIFECYCLE_LABEL } from "@/lib/wellbeing/campaign-lifecycle";
import { buildWellbeingDeck } from "@/lib/wellbeing/presentation";
import { DeckView } from "@/components/wellbeing/present/DeckView";
import { ILLUSTRATIVE_DATA_BANNER } from "@/lib/wellbeing/demo-population";
import { LOCAL_FIXTURE_BANNER } from "@/lib/wellbeing/local-fixture";

export const metadata: Metadata = { title: "Presentation" };

/**
 * Wellbeing Presentation Mode.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THIS IS NOT DISC PRESENTATION MODE.
 *
 * DISC presentation reveals individuals — profiles, a team map, an anchor,
 * people named on a screen in front of their colleagues. That is the point of
 * it, and it is correct there.
 *
 * A wellbeing deck must do the opposite. It shows a workforce and nobody in
 * it. The deck is assembled on the server from aggregates that have already
 * passed suppression, withheld cohorts are filtered out before the props
 * exist, and the client component navigates between finished slides without
 * issuing a query of its own. There is no reveal, no roster and no drill-down,
 * because there is nothing behind these slides to drill into.
 *
 * It also carries no recommendation section. Telling leadership what to DO
 * about a workforce's wellbeing from a screening aggregate is the over-reach
 * this product exists to avoid — and on a slide, in a room, it becomes policy.
 * The last slide asks questions instead.
 * ─────────────────────────────────────────────────────────────────────
 */
export default async function WellbeingPresentationPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ source?: string; by?: string }>;
}) {
  const { teamId } = await params;
  if (!z.uuid().safeParse(teamId).success) notFound();
  const { source: sourceParam } = await searchParams;

  const resolved = await loadCampaignReporting(teamId, sourceParam);
  if (!resolved.ok) {
    // No chrome to fall back into here — this route has no navigation by
    // design — so the refusal is a plain page with one way out.
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-5 px-6 py-16">
        <h1 className="font-display text-h2 font-semibold">Presentation unavailable</h1>
        <p className="text-lead text-slate">
          {resolved.reason === "no_instrument"
            ? "This campaign has no questionnaire selected, so there is nothing to present."
            : "Presenting a campaign's wellbeing figures requires a wellbeing role in its organisation. Administering the campaign does not carry one."}
        </p>
        <Link
          href={`/wellbeing/admin/campaigns/${teamId}`}
          className="pulse-focus w-fit rounded-full border border-hairline px-5 py-2.5 text-sm font-medium text-pulse"
        >
          Back to the campaign
        </Link>
      </div>
    );
  }

  const { identity, instrumentKey, source, scope, period, headline } = resolved.context;

  const deck = await buildWellbeingDeck({
    organizationId: identity.organizationId,
    instrumentKey,
    source,
    scope,
    campaignName: identity.name,
    organisationName: identity.organizationName,
    period: `${period.label} · ${period.period}`,
    status: LIFECYCLE_LABEL[identity.lifecycle],
    invited: headline.invited,
    completedParticipants: headline.completed,
    participationPercent: headline.participation,
  });

  return (
    <DeckView
      deck={deck}
      backHref={`/wellbeing/admin/campaigns/${teamId}`}
      syntheticBanner={
        source === "demo"
          ? ILLUSTRATIVE_DATA_BANNER
          : source === "fixture"
            ? LOCAL_FIXTURE_BANNER
            : null
      }
    />
  );
}
