import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireTeamAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { buildJoinUrl, getPublicBaseUrl } from "@/lib/utils/site-url";
import { getDeck, isDeckType } from "@/lib/presentations/registry";
import { PresentationPlayer } from "@/components/presentations/PresentationPlayer";

export const metadata: Metadata = { title: "Introduction" };

interface PageProps {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ deck?: string }>;
}

/**
 * Team-session introduction deck. The facilitator presents this before opening
 * the assessment — participants never begin automatically; the facilitator
 * controls when it starts.
 *
 * The closing CTA leads to the live presentation (which shows the join QR and
 * live completion), and the join QR is available throughout via the deck's
 * "Show QR" control. `?deck=` lets the facilitator present any of the three
 * introductions for their team.
 */
export default async function TeamIntroductionPage({ params, searchParams }: PageProps) {
  const { teamId } = await params;
  const { deck: deckParam } = await searchParams;

  // Presenter scope: team admins only (redirects otherwise).
  await requireTeamAdmin(teamId);

  const admin = createSupabaseAdminClient();
  const { data: team } = await admin
    .from("teams")
    .select("name, invite_token, team_code, join_enabled")
    .eq("id", teamId)
    .single();
  if (!team) notFound();

  const deckType = deckParam && isDeckType(deckParam) ? deckParam : "disc";
  const deck = getDeck(deckType);
  const base = getPublicBaseUrl();

  return (
    <PresentationPlayer
      deck={deck}
      startLabel="Open live dashboard"
      startHref={`/app/teams/${teamId}/presentation`}
      exitHref={`/app/teams/${teamId}/dashboard`}
      dashboardHref={`/app/teams/${teamId}/dashboard`}
      dashboardLabel="Return to facilitator dashboard"
      qr={{
        joinUrl: buildJoinUrl(base, team.invite_token),
        isLocal: base.isLocal,
        teamCode: team.team_code,
        label: team.name,
      }}
    />
  );
}
