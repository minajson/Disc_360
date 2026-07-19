import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireTeamAdmin } from "@/lib/auth/guards";
import { buildJoinUrl, displayJoinUrl, getPublicBaseUrl } from "@/lib/utils/site-url";
import { FullscreenQr } from "@/components/teams/FullscreenQr";

export const metadata: Metadata = {
  title: "Join QR",
  robots: { index: false, follow: false },
};

/**
 * Projection view: DISC360 · Join <team> · large QR · fallback URL · team
 * code. White page, maximum contrast, print/Save-as-PDF friendly — made to
 * be thrown onto a conference-room screen.
 */
export default async function TeamQrPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { supabase } = await requireTeamAdmin(teamId);

  const { data: team } = await supabase
    .from("teams")
    .select("name, team_code, invite_token")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) notFound();

  const base = getPublicBaseUrl();
  return (
    <FullscreenQr
      teamName={team.name}
      teamCode={team.team_code}
      joinUrl={buildJoinUrl(base, team.invite_token)}
      displayUrl={displayJoinUrl(base, team.invite_token)}
    />
  );
}
