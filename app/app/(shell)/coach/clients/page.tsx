import type { Metadata } from "next";
import Link from "next/link";
import { getFacilitatorTeams } from "@/lib/teams/facilitator";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { LinkButton } from "@/components/ui/LinkButton";

export const metadata: Metadata = { title: "Clients" };

/**
 * Client view of a coach's engagements: the Workspace lists engagements as
 * individual teams, this groups them by the client organization a coach
 * actually bills and reports to. Teams with no client organization set are
 * gathered under a single explicit heading rather than hidden.
 */

const UNASSIGNED = "Unassigned";

export default async function CoachClientsPage() {
  const teams = await getFacilitatorTeams();

  const byClient = new Map<string, typeof teams>();
  for (const team of teams) {
    const client = team.clientOrganization?.trim() || UNASSIGNED;
    byClient.set(client, [...(byClient.get(client) ?? []), team]);
  }
  const clients = [...byClient.entries()].sort(([a], [b]) => {
    if (a === UNASSIGNED) return 1;
    if (b === UNASSIGNED) return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 py-12 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Eyebrow>Clients</Eyebrow>
          <h1 className="font-display text-h2 font-semibold">Your clients</h1>
          <p className="max-w-xl text-sm leading-relaxed text-slate">
            Engagements grouped by client organization. Set a client on a
            team&apos;s settings page to group it here.
          </p>
        </div>
        <LinkButton href="/app/teams/new">New engagement</LinkButton>
      </div>

      {clients.length === 0 ? (
        <div className="paper-card flex flex-col items-start gap-3 p-8">
          <h2 className="font-display text-lg font-semibold text-ink">
            No clients yet
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-slate">
            Create your first engagement — the $8 Team plan covers invitations,
            live tracking and the presentation dashboard.
          </p>
          <LinkButton href="/app/teams/new">Create an engagement</LinkButton>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {clients.map(([client, clientTeams]) => {
            const participants = clientTeams.reduce(
              (sum, team) => sum + team.participants,
              0,
            );
            const completed = clientTeams.reduce(
              (sum, team) => sum + team.completed,
              0,
            );
            return (
              <section key={client} className="flex flex-col gap-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline pb-2">
                  <h2 className="font-display text-h3 font-semibold">
                    {client}
                    {client === UNASSIGNED ? (
                      <span className="ml-2 font-sans text-xs font-normal text-faint">
                        no client organization set
                      </span>
                    ) : null}
                  </h2>
                  <span className="font-mono text-[11px] text-faint">
                    {clientTeams.length}{" "}
                    {clientTeams.length === 1 ? "engagement" : "engagements"} ·{" "}
                    {completed}/{participants} completed
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {clientTeams.map((team) => (
                    <article
                      key={team.id}
                      className="paper-card flex flex-wrap items-center gap-x-6 gap-y-3 p-6"
                    >
                      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
                        <span className="font-display text-base font-semibold text-ink">
                          {team.name}
                        </span>
                        <span className="font-mono text-[11px] text-faint">
                          {team.sessionName ?? "No session name"} ·{" "}
                          {team.completed}/{team.participants} completed
                        </span>
                      </div>

                      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-ink/8">
                        <div
                          className="h-full rounded-full bg-botanical"
                          style={{ width: `${team.completionRate}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            { href: `/app/teams/${team.id}/dashboard`, label: "Dashboard" },
                            { href: `/app/teams/${team.id}/presentation`, label: "Present" },
                            { href: `/app/teams/${team.id}/results`, label: "Report" },
                          ] as const
                        ).map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            className="rounded-full border border-hairline px-3.5 py-1.5 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical"
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
