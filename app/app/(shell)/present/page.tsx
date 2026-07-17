import type { Metadata } from "next";
import Link from "next/link";
import { getFacilitatorTeams } from "@/lib/teams/facilitator";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { LinkButton } from "@/components/ui/LinkButton";

export const metadata: Metadata = { title: "Present" };

const formatDeadline = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

/**
 * Presentation picker. The deck itself lives at
 * /app/teams/[teamId]/presentation and needs a team id, so a facilitator with
 * several teams previously had no way to reach it from the nav — they had to
 * go via My Teams and know which tab held it.
 */
export default async function PresentIndexPage() {
  const teams = await getFacilitatorTeams();

  const ready = teams.filter((team) => team.completed > 0);
  const notReady = teams.filter((team) => team.completed === 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 py-12 sm:px-8">
      <div className="flex flex-col gap-2">
        <Eyebrow>Present</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">Presentation mode</h1>
        <p className="max-w-xl text-sm leading-relaxed text-slate">
          A full-screen deck for the room: team map, dimension balance and a
          join QR for anyone who has not taken the assessment yet. Built for
          1920×1080 — press <kbd className="font-mono text-xs">F</kbd> for
          fullscreen once it opens.
        </p>
      </div>

      {teams.length === 0 ? (
        <div className="paper-card flex flex-col items-start gap-3 p-8">
          <h2 className="font-display text-lg font-semibold text-ink">
            No teams to present yet
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-slate">
            Presentation mode reads a team&apos;s results. Create a team, invite
            participants, and the deck becomes available as soon as the first
            person completes the assessment.
          </p>
          <LinkButton href="/app/teams/new">Create a team</LinkButton>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {ready.length > 0 ? (
            <section className="flex flex-col gap-4" aria-labelledby="ready-heading">
              <h2 id="ready-heading" className="font-display text-h3 font-semibold">
                Ready to present
              </h2>
              <div className="flex flex-col gap-4">
                {ready.map((team) => (
                  <article
                    key={team.id}
                    className="paper-card flex flex-wrap items-center gap-x-6 gap-y-3 p-6"
                  >
                    <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
                      <span className="font-display text-lg font-semibold text-ink">
                        {team.name}
                      </span>
                      <span className="text-xs text-slate">
                        {[team.clientOrganization, team.sessionName]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                      {formatDeadline(team.deadlineAt) ? (
                        <span className="font-mono text-[11px] text-faint">
                          deadline {formatDeadline(team.deadlineAt)}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[11px] text-faint">
                        {team.completed}/{team.participants} completed ·{" "}
                        {team.completionRate}%
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
                        href={`/app/teams/${team.id}/presentation`}
                        className="inline-flex min-h-9 items-center rounded-full bg-botanical px-4 text-xs font-medium text-mineral transition-colors hover:bg-botanical-deep"
                      >
                        Open live dashboard
                      </Link>
                      <Link
                        href={`/app/teams/${team.id}/dashboard`}
                        className="inline-flex min-h-9 items-center rounded-full border border-hairline px-4 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical"
                      >
                        Team dashboard
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {notReady.length > 0 ? (
            <section className="flex flex-col gap-4" aria-labelledby="waiting-heading">
              <h2 id="waiting-heading" className="font-display text-h3 font-semibold">
                Waiting on results
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-slate">
                The deck needs at least one completed assessment before it has
                anything to show. Invite participants or share the join QR.
              </p>
              <div className="flex flex-col gap-3">
                {notReady.map((team) => (
                  <article
                    key={team.id}
                    className="paper-card flex flex-wrap items-center justify-between gap-4 p-6"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-display text-base font-semibold text-ink">
                        {team.name}
                      </span>
                      <span className="font-mono text-[11px] text-faint">
                        {team.participants} invited · 0 completed
                      </span>
                    </div>
                    <Link
                      href={`/app/teams/${team.id}/dashboard`}
                      className="inline-flex min-h-9 items-center rounded-full border border-hairline-strong px-4 text-xs font-medium text-ink transition-colors hover:border-botanical hover:text-botanical"
                    >
                      Invite participants
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
