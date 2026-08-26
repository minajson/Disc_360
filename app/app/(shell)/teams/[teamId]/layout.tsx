import Image from "next/image";
import { notFound, redirect } from "next/navigation";
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
      .select("id, name, department, logo_url, archived_at, assessment_type")
      .eq("id", teamId)
      .maybeSingle(),
    supabase.rpc("is_team_admin", { team: teamId }),
  ]);
  if (!team) notFound();

  // A Wellbeing Pulse campaign is a different PRODUCT, not a variant of a DISC
  // team. It happens to be stored as a team — it has members, an organisation,
  // a join token and a facilitator, and duplicating all of that would have
  // meant two identity models to keep in step — but everything below this
  // point is the DISC experience: DISC Behaviour Assessment, Compare Members,
  // Executive Brief, AI Insights.
  //
  // Compare Members is the one that matters most. It is a named-person
  // comparison, and a wellbeing campaign must never offer one. So the boundary
  // is enforced here, at the layout every DISC team surface passes through,
  // rather than by hiding tabs one at a time and hoping none is missed.
  if (team.assessment_type === "wellbeing") {
    redirect(`/wellbeing/admin/campaigns/${teamId}`);
  }

  return (
    // `print:contents` drops the page padding for print so a designed report
    // can own the whole sheet; the screen layout is untouched.
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-5 py-10 sm:px-8 print:contents">
      {/* The team identity block belongs to the app, not to an exported
          report — a designed report carries its own cover. */}
      <div className="flex items-center gap-5 print:hidden">
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

      <TeamTabs
        teamId={team.id}
        isAdmin={Boolean(isAdmin)}
        isDisc={(team.assessment_type ?? "disc") === "disc"}
      />

      <div className="flex flex-col gap-8 print:contents">{children}</div>
    </div>
  );
}
