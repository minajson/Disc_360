import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Team" };

/** Member-facing overview; admins go straight to the working dashboard. */
export default async function TeamOverviewPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { supabase } = await requireOnboarded();

  const [{ data: team }, { data: isAdmin }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, description, session_name, members_can_view_summary, deadline_at")
      .eq("id", teamId)
      .maybeSingle(),
    supabase.rpc("is_team_admin", { team: teamId }),
  ]);
  if (!team) notFound();
  if (isAdmin) redirect(`/app/teams/${teamId}/dashboard`);

  const { count: memberCount } = await supabase
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId);

  return (
    <>
      {team.description ? (
        <p className="max-w-2xl text-sm leading-relaxed text-slate">{team.description}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="paper-card flex flex-col gap-0.5 px-4 py-3">
          <span className="text-xs text-faint">Members</span>
          <span className="font-display text-xl font-semibold text-ink">{memberCount ?? 0}</span>
        </div>
        <div className="paper-card flex flex-col gap-0.5 px-4 py-3">
          <span className="text-xs text-faint">Deadline</span>
          <span className="font-display text-xl font-semibold text-ink">
            {team.deadline_at
              ? new Date(team.deadline_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "None"}
          </span>
        </div>
      </div>
      {team.members_can_view_summary ? (
        <Link
          href={`/app/teams/${teamId}/results`}
          className="self-start rounded-full bg-botanical px-6 py-2.5 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
        >
          View team summary
        </Link>
      ) : (
        <p className="text-sm text-slate">
          The team summary is visible to the team administrator only.
        </p>
      )}
    </>
  );
}
