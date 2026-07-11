import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireTeamAdmin } from "@/lib/auth/guards";
import {
  TeamDangerZone,
  TeamSettingsForm,
} from "@/components/teams/TeamSettingsForm";

export const metadata: Metadata = { title: "Team settings" };

export default async function TeamSettingsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { supabase } = await requireTeamAdmin(teamId);

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, description, department, timezone, logo_url, results_named, members_can_view_summary, deadline_at")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) notFound();

  return (
    <>
      <TeamSettingsForm team={team} />
      <TeamDangerZone teamId={teamId} />
    </>
  );
}
