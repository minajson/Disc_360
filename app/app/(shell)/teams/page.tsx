import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/guards";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = { title: "Teams" };

interface TeamRow {
  role: string;
  teams: {
    id: string;
    name: string;
    description: string;
    department: string | null;
    team_code: string;
    archived_at: string | null;
  } | null;
}

export default async function TeamsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const { denied } = await searchParams;
  const { supabase, user } = await requireOnboarded();

  const { data: memberships } = await supabase
    .from("team_members")
    .select("role, teams (id, name, description, department, team_code, archived_at)")
    .eq("profile_id", user.id);

  const teams = ((memberships ?? []) as unknown as TeamRow[])
    .filter((row) => row.teams && !row.teams.archived_at)
    .map((row) => ({ ...row.teams!, memberRole: row.role }));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-12 sm:px-8">
      {denied ? (
        <p role="alert" className="rounded-xl bg-sand/60 px-4 py-3 text-sm text-ink">
          {denied === "admin"
            ? "You don't have admin access to that team. Ask the team's facilitator to promote you, or open one of your own teams below."
            : "You're not a member of that team, so its pages aren't available to you."}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Eyebrow>Teams</Eyebrow>
          <h1 className="font-display text-h2 font-semibold">Your teams</h1>
        </div>
        <div className="flex gap-3">
          <Link
            href="/app/invitations"
            className="inline-flex min-h-11 items-center rounded-full border border-hairline-strong px-6 text-sm font-medium text-ink transition-colors hover:border-botanical hover:text-botanical"
          >
            Invitations
          </Link>
          <Link
            href="/app/teams/new"
            className="inline-flex min-h-11 items-center rounded-full bg-botanical px-6 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
          >
            Create a team
          </Link>
        </div>
      </div>

      {teams.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((team) => (
            <Link key={team.id} href={`/app/teams/${team.id}`} className="group">
              <article className="paper-card flex h-full flex-col gap-3 p-7 transition-all duration-200 group-hover:-translate-y-0.5">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-display text-lg font-semibold text-ink">
                    {team.name}
                  </span>
                  <span className="font-mono text-[11px] text-faint">
                    {team.memberRole === "team_admin" ? "ADMIN" : "MEMBER"}
                  </span>
                </div>
                {team.description ? (
                  <p className="text-sm leading-relaxed text-slate">{team.description}</p>
                ) : null}
                <span className="mt-auto pt-1 text-xs text-faint">
                  {team.department ?? "No department"} · code {team.team_code}
                </span>
              </article>
            </Link>
          ))}
        </div>
      ) : (
        <div className="paper-card flex flex-col items-start gap-3 p-8">
          <p className="max-w-md text-sm leading-relaxed text-slate">
            No teams yet. Create one, accept an invitation, or join with a
            team code from the invitations page.
          </p>
        </div>
      )}
    </div>
  );
}
