import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = { title: "Team" };

export default async function TeamOverviewPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { supabase } = await requireOnboarded();

  // RLS scopes this to teams the user belongs to or administers.
  const { data: team } = await supabase
    .from("teams")
    .select("id, name, description, department, team_code, results_named, members_can_view_summary")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) notFound();

  const { data: members } = await supabase
    .from("team_members")
    .select("id, display_name, email, department, role, profile_id")
    .eq("team_id", teamId)
    .order("display_name");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-12 sm:px-8">
      <div className="flex flex-col gap-2">
        <Eyebrow>Team</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">{team.name}</h1>
        {team.description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-slate">{team.description}</p>
        ) : null}
        <p className="font-mono text-xs text-faint">
          {team.department ?? "No department"} · join code {team.team_code} ·{" "}
          {team.results_named ? "named results" : "anonymized results"}
        </p>
      </div>

      <section aria-labelledby="roster-heading" className="flex flex-col gap-4">
        <h2 id="roster-heading" className="font-display text-h3 font-semibold">
          Roster · {members?.length ?? 0}
        </h2>
        <div className="paper-card divide-y divide-hairline overflow-hidden p-0">
          {(members ?? []).map((member) => (
            <div key={member.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-ink">
                  {member.display_name}
                </span>
                <span className="truncate text-xs text-slate">
                  {member.department ?? "—"}
                </span>
              </div>
              <span className="font-mono text-[11px] text-faint">
                {member.role === "team_admin" ? "ADMIN" : member.profile_id ? "JOINED" : "INVITED"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
