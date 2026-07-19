import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeamAdmin } from "@/lib/auth/guards";
import { logRouteDiagnostic } from "@/lib/observability/diagnostics";
import { getTeamRoster } from "@/lib/teams/roster";
import { sendReminderToPending } from "@/lib/actions/teams";
import { InviteParticipantsPanel } from "@/components/teams/InviteParticipantsPanel";
import { buildJoinUrl, getPublicBaseUrl } from "@/lib/utils/site-url";
import {
  ASSESSMENT_LABELS,
  SESSION_STATE_LABELS,
  type AssessmentProduct,
  type SessionState,
} from "@/lib/teams/session";
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
  const { supabase, user } = await requireTeamAdmin(teamId);

  const [{ data: team, error: teamError }, roster] = await Promise.all([
    supabase
      .from("teams")
      .select("name, team_code, invite_token, session_name, deadline_at, assessment_type, session_state, session_mode")
      .eq("id", teamId)
      .maybeSingle(),
    getTeamRoster(teamId),
  ]);

  if (teamError) {
    logRouteDiagnostic({
      route: "/app/teams/[teamId]/dashboard",
      teamId,
      userId: user.id,
      step: "team-query",
      code: teamError.code,
      message: teamError.message,
    });
    throw new Error("TEAM_DASHBOARD_DATA");
  }
  // The guard passed, so the id is real for this admin — a null row here
  // means the team was deleted/archived out from under the link.
  if (!team) notFound();

  // Where "results" and "present results" point depends on the team's product.
  const assessmentType = team.assessment_type ?? "disc";
  const summaryHref =
    assessmentType === "focus"
      ? `/app/teams/${teamId}/focus`
      : assessmentType === "combined"
        ? `/app/teams/${teamId}/combined`
        : `/app/teams/${teamId}/results`;
  const summaryLabel =
    assessmentType === "disc" ? "Export summary" : "Team summary";

  const base = getPublicBaseUrl();
  const inviteLink = buildJoinUrl(base, team.invite_token);
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

      {/* selected assessment + session state — the coach's control surface */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-botanical px-4 py-1.5 text-sm font-medium text-mineral">
          {ASSESSMENT_LABELS[(team.assessment_type ?? "disc") as AssessmentProduct]}
        </span>
        <span className="rounded-full border border-hairline bg-paper px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-slate">
          {SESSION_STATE_LABELS[(team.session_state ?? "draft") as SessionState]}
        </span>
        <Link
          href={`/app/teams/${teamId}/settings`}
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-teal hover:underline"
        >
          Session setup →
        </Link>
      </div>

      {team.session_name || team.deadline_at ? (
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

      {/* invite participants */}
      <InviteParticipantsPanel
        teamName={team.name}
        teamCode={team.team_code}
        joinUrl={inviteLink}
        isLocal={base.isLocal}
        teamId={teamId}
        assessmentLabel={ASSESSMENT_LABELS[(team.assessment_type ?? "disc") as AssessmentProduct]}
      />

      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <form action={sendReminderToPending.bind(null, teamId)}>
          <button
            type="submit"
            className="rounded-full border border-hairline bg-paper px-4 py-2 font-mono text-xs text-slate transition-colors hover:border-botanical hover:text-botanical"
          >
            Remind pending ({metrics.pending})
          </button>
        </form>
        <Link
          href={`/app/teams/${teamId}/presentation/introduction`}
          className="rounded-full bg-botanical px-5 py-2 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
        >
          Present introduction
        </Link>
        <Link
          href={`/app/teams/${teamId}/presentation`}
          className="rounded-full border border-hairline bg-paper px-4 py-2 font-mono text-xs text-slate transition-colors hover:border-botanical hover:text-botanical"
        >
          Present results
        </Link>
        <Link
          href={summaryHref}
          className="rounded-full border border-hairline bg-paper px-4 py-2 font-mono text-xs text-slate transition-colors hover:border-botanical hover:text-botanical"
        >
          {summaryLabel}
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
