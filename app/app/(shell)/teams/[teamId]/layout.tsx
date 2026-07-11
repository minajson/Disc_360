import Image from "next/image";
import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { TeamTabs } from "@/components/teams/TeamTabs";

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { supabase } = await requireOnboarded();

  const [{ data: team }, { data: isAdmin }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, department, logo_url, archived_at")
      .eq("id", teamId)
      .maybeSingle(),
    supabase.rpc("is_team_admin", { team: teamId }),
  ]);
  if (!team) notFound();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-5 py-10 sm:px-8">
      <div className="flex items-center gap-5">
        {team.logo_url ? (
          <Image
            src={team.logo_url}
            alt=""
            width={56}
            height={56}
            className="size-14 rounded-2xl border border-hairline object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-14 items-center justify-center rounded-2xl bg-sage/40 font-display text-xl font-semibold text-botanical"
          >
            {team.name.slice(0, 1)}
          </span>
        )}
        <div className="flex flex-col gap-1">
          <Eyebrow>{team.department ?? "Team"}</Eyebrow>
          <h1 className="font-display text-h2 font-semibold">
            {team.name}
            {team.archived_at ? (
              <span className="ml-3 align-middle font-mono text-xs uppercase tracking-wide text-faint">
                Archived
              </span>
            ) : null}
          </h1>
        </div>
      </div>

      <TeamTabs teamId={team.id} isAdmin={Boolean(isAdmin)} />

      <div className="flex flex-col gap-8">{children}</div>
    </div>
  );
}
