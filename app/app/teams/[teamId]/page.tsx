import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { CopyButton } from "@/components/ui/CopyButton";

export const metadata: Metadata = { title: "Team overview" };

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
      .select("id, name, description, department, team_code, invite_token, results_named, members_can_view_summary, deadline_at")
      .eq("id", teamId)
      .maybeSingle(),
    supabase.rpc("is_team_admin", { team: teamId }),
  ]);
  if (!team) notFound();

  const [{ data: members }, { data: campaigns }] = await Promise.all([
    supabase
      .from("team_members")
      .select("id, profile_id")
      .eq("team_id", teamId),
    supabase
      .from("assessment_campaigns")
      .select("id, name, status, deadline_at")
      .eq("team_id", teamId)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const totalMembers = members?.length ?? 0;
  const joined = (members ?? []).filter((m) => m.profile_id).length;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const inviteLink = `${siteUrl}/join/${team.invite_token}`;

  return (
    <>
      {team.description ? (
        <p className="max-w-2xl text-sm leading-relaxed text-slate">
          {team.description}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Roster", value: String(totalMembers) },
          { label: "Joined", value: `${joined} of ${totalMembers}` },
          {
            label: "Reporting",
            value: team.results_named ? "Named" : "Anonymized",
          },
          {
            label: "Deadline",
            value: team.deadline_at
              ? new Date(team.deadline_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "None",
          },
        ].map((stat) => (
          <div key={stat.label} className="paper-card flex flex-col gap-1 px-5 py-4">
            <span className="text-xs text-faint">{stat.label}</span>
            <span className="font-display text-lg font-semibold text-ink">
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {isAdmin ? (
        <section aria-label="Invite" className="paper-card flex flex-wrap items-center gap-3 p-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Bring the team in
            </span>
            <span className="truncate text-sm text-slate">{inviteLink}</span>
          </div>
          <CopyButton value={inviteLink} label="Copy invite link" />
          <CopyButton value={team.team_code} label={`Code ${team.team_code}`} />
        </section>
      ) : null}

      <section aria-labelledby="campaigns-overview" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 id="campaigns-overview" className="font-display text-h3 font-semibold">
            Campaigns
          </h2>
          {isAdmin ? (
            <Link
              href={`/app/teams/${teamId}/campaigns`}
              className="text-sm text-slate hover:text-ink"
            >
              Manage
            </Link>
          ) : null}
        </div>
        {(campaigns ?? []).length > 0 ? (
          <div className="paper-card divide-y divide-hairline p-0">
            {(campaigns ?? []).map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <span className="text-sm font-medium text-ink">{campaign.name}</span>
                <span className="font-mono text-[11px] uppercase tracking-wide text-faint">
                  {campaign.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="paper-card p-7 text-sm text-slate">
            No campaigns yet{isAdmin ? " — create one from the Campaigns tab." : "."}
          </div>
        )}
      </section>
    </>
  );
}
