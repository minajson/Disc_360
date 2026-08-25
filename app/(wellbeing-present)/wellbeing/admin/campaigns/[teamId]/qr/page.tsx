import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireTeamAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { getPublicBaseUrl } from "@/lib/utils/site-url";
import { INSTRUMENTS, isInstrumentKey } from "@/data/wellbeing-instruments";
import { readPilotStatus } from "@/lib/wellbeing/pilot";
import { PresentationQr } from "@/components/wellbeing/PresentationQr";

export const metadata: Metadata = { title: "Campaign QR" };

/**
 * The conference-room QR for a Wellbeing Pulse campaign.
 *
 * Sized to the viewport rather than to a card, because this is projected: the
 * code is min(70vmin) on a white ground with its own quiet zone, so it scans
 * from the back of a room and survives a projector's contrast.
 *
 * It shows the campaign name, the instrument and the places remaining — and no
 * participant name, no identifier and no score. A room full of people can see
 * this screen, so it carries only what a room may see.
 */
export default async function WellbeingCampaignQrPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  if (!z.uuid().safeParse(teamId).success) notFound();
  await requireTeamAdmin(teamId);

  const admin = createSupabaseAdminClient();
  const { data: team } = await admin
    .from("teams")
    .select("id, name, session_name, wellbeing_instrument_key, invite_token")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) notFound();

  const key = team.wellbeing_instrument_key;
  const instrument = key && isInstrumentKey(key) ? INSTRUMENTS[key].name : null;
  const joinUrl = `${getPublicBaseUrl().url}/wellbeing/join/${team.invite_token}`;
  const status = await readPilotStatus(teamId);
  const campaignName = (team.session_name as string) || (team.name as string);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-[3vmin] bg-white px-6 py-10 text-center print:min-h-0">
      <p className="font-mono text-[clamp(0.7rem,1.3vmin,0.95rem)] tracking-[0.22em] text-pulse-teal uppercase">
        Wellbeing Pulse
      </p>

      <h1 className="font-display text-[clamp(1.8rem,4.4vmin,3.4rem)] leading-tight font-semibold text-ink">
        {campaignName}
      </h1>
      {instrument && (
        <p className="-mt-[1.5vmin] text-[clamp(0.95rem,1.9vmin,1.5rem)] text-slate">{instrument}</p>
      )}

      <div className="rounded-[3vmin] border border-hairline bg-white p-[3vmin] shadow-[0_24px_64px_-40px_rgba(23,32,29,0.4)] print:border-0 print:shadow-none">
        <PresentationQr value={joinUrl} />
      </div>

      <p className="text-[clamp(1rem,2.2vmin,1.7rem)] font-medium text-ink">
        Scan to join the Wellbeing Pulse
      </p>

      {/* The link is the fallback for anyone whose camera will not focus, so
          it stays on screen — but quietly, at the size of a footnote rather
          than competing with the instruction above the code. */}
      <p className="font-mono text-[clamp(0.65rem,1.15vmin,0.9rem)] break-all text-faint">
        {joinUrl}
      </p>

      {status.capacity !== null && (
        <p className="text-[clamp(0.9rem,1.8vmin,1.35rem)] font-medium text-ink">
          {status.isFull
            ? "This pilot has reached its participant capacity."
            : `${status.remaining} of ${status.capacity} places remaining`}
        </p>
      )}

      <Link
        href={`/wellbeing/admin/campaigns/${teamId}`}
        className="text-sm text-slate underline underline-offset-4 print:hidden hover:text-pulse-deep"
      >
        Back to the campaign
      </Link>
    </div>
  );
}
