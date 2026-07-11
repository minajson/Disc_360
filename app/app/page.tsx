import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/guards";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = { title: "Dashboard" };

interface TeamMembershipRow {
  role: string;
  teams: {
    id: string;
    name: string;
    department: string | null;
    archived_at: string | null;
  } | null;
}

export default async function AppDashboardPage() {
  const { supabase, user, profile } = await requireOnboarded();

  const { data: memberships } = await supabase
    .from("team_members")
    .select("role, teams (id, name, department, archived_at)")
    .eq("profile_id", user.id);

  const teams = ((memberships ?? []) as unknown as TeamMembershipRow[])
    .filter((row) => row.teams && !row.teams.archived_at)
    .map((row) => ({ ...row.teams!, memberRole: row.role }));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-12 sm:px-8">
      <div className="flex flex-col gap-2">
        <Eyebrow>Dashboard</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">
          Welcome back, {profile.preferred_name || profile.full_name}.
        </h1>
      </div>

      <section aria-labelledby="teams-heading" className="flex flex-col gap-5">
        <h2 id="teams-heading" className="font-display text-h3 font-semibold">
          Your teams
        </h2>
        {teams.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <Link key={team.id} href={`/app/teams/${team.id}`} className="group">
                <article className="paper-card flex h-full flex-col gap-2 p-6 transition-all duration-200 group-hover:-translate-y-0.5">
                  <span className="font-display text-base font-semibold text-ink">
                    {team.name}
                  </span>
                  <span className="text-xs text-slate">
                    {team.department ?? "No department"} ·{" "}
                    {team.memberRole === "team_admin" ? "Administrator" : "Member"}
                  </span>
                </article>
              </Link>
            ))}
          </div>
        ) : (
          <div className="paper-card flex flex-col items-start gap-3 p-8">
            <p className="max-w-md text-sm leading-relaxed text-slate">
              You&rsquo;re not part of a team yet. Create one, or join with a
              team code from your administrator.
            </p>
            <Link
              href="/app/teams"
              className="text-sm font-medium text-botanical hover:underline"
            >
              Go to teams →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
