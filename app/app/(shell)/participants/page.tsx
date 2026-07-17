import type { Metadata } from "next";
import Link from "next/link";
import { getFacilitatorTeams } from "@/lib/teams/facilitator";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { LinkButton } from "@/components/ui/LinkButton";

export const metadata: Metadata = { title: "Participants" };

/**
 * Cross-team participant overview. Per-team rosters (with the invite, resend
 * and remove actions) live on each team dashboard; this page answers the
 * question a facilitator running several sessions actually asks — "who still
 * hasn't finished, anywhere?" — and routes them to the team that owns it.
 */
export default async function ParticipantsIndexPage() {
  const teams = await getFacilitatorTeams();

  const totals = teams.reduce(
    (sum, team) => ({
      participants: sum.participants + team.participants,
      completed: sum.completed + team.completed,
      outstanding: sum.outstanding + (team.participants - team.completed),
    }),
    { participants: 0, completed: 0, outstanding: 0 },
  );

  const overallRate =
    totals.participants > 0
      ? Math.round((totals.completed / totals.participants) * 100)
      : 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 py-12 sm:px-8">
      <div className="flex flex-col gap-2">
        <Eyebrow>Participants</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">All participants</h1>
        <p className="max-w-xl text-sm leading-relaxed text-slate">
          Completion across every team you facilitate. Open a team to invite
          people, resend an invitation or view its submissions.
        </p>
      </div>

      {teams.length === 0 ? (
        <div className="paper-card flex flex-col items-start gap-3 p-8">
          <h2 className="font-display text-lg font-semibold text-ink">
            No participants yet
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-slate">
            Participants appear here once you create a team and invite them —
            by email, join link or QR code.
          </p>
          <LinkButton href="/app/teams/new">Create a team</LinkButton>
        </div>
      ) : (
        <>
          <section
            className="paper-card flex flex-wrap gap-x-10 gap-y-4 p-6"
            aria-label="Totals across your teams"
          >
            {(
              [
                { label: "participants", value: totals.participants },
                { label: "completed", value: totals.completed },
                { label: "outstanding", value: totals.outstanding },
                { label: "completion", value: `${overallRate}%` },
              ] as const
            ).map((stat) => (
              <div key={stat.label} className="flex flex-col gap-0.5">
                <span className="font-display text-2xl font-semibold text-ink">
                  {stat.value}
                </span>
                <span className="font-mono text-[11px] text-faint">{stat.label}</span>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-4" aria-labelledby="by-team-heading">
            <h2 id="by-team-heading" className="font-display text-h3 font-semibold">
              By team
            </h2>
            <div className="flex flex-col gap-3">
              {teams.map((team) => {
                const outstanding = team.participants - team.completed;
                return (
                  <article
                    key={team.id}
                    className="paper-card flex flex-wrap items-center gap-x-6 gap-y-3 p-6"
                  >
                    <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
                      <span className="font-display text-base font-semibold text-ink">
                        {team.name}
                      </span>
                      <span className="font-mono text-[11px] text-faint">
                        {team.participants} invited · {team.joined} joined ·{" "}
                        {team.completed} completed · {team.reportsSent} reports sent
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[11px] text-faint">
                        {outstanding > 0
                          ? `${outstanding} outstanding`
                          : "everyone finished"}
                      </span>
                      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-ink/8">
                        <div
                          className="h-full rounded-full bg-botanical"
                          style={{ width: `${team.completionRate}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Link
                        href={`/app/teams/${team.id}/dashboard`}
                        className="inline-flex min-h-9 items-center rounded-full border border-hairline-strong px-4 text-xs font-medium text-ink transition-colors hover:border-botanical hover:text-botanical"
                      >
                        View submissions
                      </Link>
                      <Link
                        href={`/app/teams/${team.id}/dashboard`}
                        className="inline-flex min-h-9 items-center rounded-full border border-hairline px-4 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical"
                      >
                        Invite participants
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
