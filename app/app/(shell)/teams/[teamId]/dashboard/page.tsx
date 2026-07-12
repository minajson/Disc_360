import type { Metadata } from "next";
import Link from "next/link";
import { requireTeamAdmin } from "@/lib/auth/guards";
import { getTeamRoster } from "@/lib/teams/roster";
import { sendReminderToPending } from "@/lib/actions/teams";
import { CopyButton } from "@/components/ui/CopyButton";
import { AutoRefresh } from "@/components/teams/AutoRefresh";
import { ParticipantTable } from "@/components/teams/ParticipantTable";
import { AddMemberForm, ImportCsvForm } from "@/components/teams/MemberForms";

export const metadata: Metadata = { title: "Team dashboard" };

export default async function TeamDashboardPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { supabase } = await requireTeamAdmin(teamId);

  const [{ data: team }, roster] = await Promise.all([
    supabase
      .from("teams")
      .select("team_code, invite_token, session_name, deadline_at")
      .eq("id", teamId)
      .single(),
    getTeamRoster(teamId),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const inviteLink = `${siteUrl}/join/${team?.invite_token}`;
  const { metrics } = roster;

  const metricCards = [
    { label: "Invited", value: String(metrics.invited) },
    { label: "Started", value: String(metrics.started) },
    { label: "Completed", value: String(metrics.completed) },
    { label: "Pending", value: String(metrics.pending) },
    { label: "Completion", value: `${metrics.completionRate}%` },
  ];

  return (
    <>
      <AutoRefresh />

      {team?.session_name || team?.deadline_at ? (
        <p className="font-mono text-xs text-faint">
          {team.session_name ?? "Assessment session"}
          {team.deadline_at
            ? ` · deadline ${new Date(team.deadline_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : ""}
        </p>
      ) : null}

      {/* metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {metricCards.map((card) => (
          <div key={card.label} className="paper-card flex flex-col gap-0.5 px-4 py-3">
            <span className="text-xs text-faint">{card.label}</span>
            <span className="font-display text-xl font-semibold text-ink">{card.value}</span>
          </div>
        ))}
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton value={inviteLink} label="Copy invite link" />
        <CopyButton value={team?.team_code ?? ""} label={`Code ${team?.team_code}`} />
        <form action={sendReminderToPending.bind(null, teamId)}>
          <button
            type="submit"
            className="rounded-full border border-hairline bg-paper px-4 py-2 font-mono text-xs text-slate transition-colors hover:border-botanical hover:text-botanical"
          >
            Remind pending ({metrics.pending})
          </button>
        </form>
        <Link
          href={`/app/teams/${teamId}/presentation`}
          className="rounded-full bg-botanical px-5 py-2 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
        >
          Open presentation
        </Link>
        <Link
          href={`/app/teams/${teamId}/results`}
          className="rounded-full border border-hairline bg-paper px-4 py-2 font-mono text-xs text-slate transition-colors hover:border-botanical hover:text-botanical"
        >
          Export summary
        </Link>
        <Link
          href={`/app/teams/${teamId}/settings`}
          className="ml-auto rounded-full border border-hairline bg-paper px-4 py-2 font-mono text-xs text-slate transition-colors hover:border-botanical hover:text-botanical"
        >
          Edit team
        </Link>
      </div>

      {/* participants */}
      <section aria-label="Participants" className="flex flex-col gap-4">
        <ParticipantTable teamId={teamId} participants={roster.participants} />
      </section>

      {/* add participants */}
      <section aria-label="Add participants" className="grid gap-4 lg:grid-cols-2">
        <details className="paper-card p-6" open={roster.participants.length <= 1}>
          <summary className="cursor-pointer font-display text-base font-semibold text-ink">
            Add a participant
          </summary>
          <div className="pt-4">
            <AddMemberForm teamId={teamId} />
          </div>
        </details>
        <details className="paper-card p-6">
          <summary className="cursor-pointer font-display text-base font-semibold text-ink">
            Import CSV
          </summary>
          <div className="pt-4">
            <ImportCsvForm teamId={teamId} />
          </div>
        </details>
      </section>
    </>
  );
}
