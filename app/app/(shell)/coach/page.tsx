import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { mediaUrl } from "@/lib/utils/media";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { LinkButton } from "@/components/ui/LinkButton";

export const metadata: Metadata = { title: "Coaching workspace" };

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

export default async function CoachWorkspacePage() {
  const { supabase, user, profile } = await requireOnboarded();

  const [{ data: coach }, { data: memberships }] = await Promise.all([
    supabase.from("coach_profiles").select("*").eq("profile_id", user.id).maybeSingle(),
    supabase
      .from("team_members")
      .select("teams (id, name, session_name, client_organization, engagement_starts_at, deadline_at, archived_at)")
      .eq("profile_id", user.id)
      .eq("role", "team_admin"),
  ]);

  const engagements = (memberships ?? [])
    .map((row) => (Array.isArray(row.teams) ? row.teams[0] : row.teams))
    .filter((team): team is NonNullable<typeof team> => Boolean(team && !team.archived_at));

  // Completion metrics per engagement (counts only — service role after the
  // membership scoping above; raw results are never read here).
  const admin = createSupabaseAdminClient();
  const engagementMetrics = await Promise.all(
    engagements.map(async (team) => {
      const { data: members } = await admin
        .from("team_members")
        .select("profile_id")
        .eq("team_id", team.id);
      const ids = (members ?? [])
        .map((m) => m.profile_id)
        .filter((id): id is string => Boolean(id));
      let completed = 0;
      if (ids.length) {
        const { data: results } = await admin
          .from("assessment_results")
          .select("profile_id")
          .in("profile_id", ids);
        completed = new Set((results ?? []).map((r) => r.profile_id)).size;
      }
      return { total: (members ?? []).length, joined: ids.length, completed };
    }),
  );

  const photo = mediaUrl(coach?.photo_path);
  const totals = engagementMetrics.reduce(
    (sum, metric) => ({
      participants: sum.participants + metric.total,
      completed: sum.completed + metric.completed,
    }),
    { participants: 0, completed: 0 },
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Coaching workspace</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">
          Welcome back, {profile.preferred_name || profile.full_name}.
        </h1>
      </div>

      {/* identity + totals */}
      <section className="paper-card flex flex-wrap items-center gap-6 p-6" aria-label="Coach identity">
        {photo ? (
          <Image src={photo} alt="" width={72} height={72} className="size-18 rounded-full object-cover" unoptimized />
        ) : (
          <span className="flex size-18 items-center justify-center rounded-full bg-sage/40">
            <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="var(--color-botanical)" strokeWidth="1.5" aria-hidden>
              <circle cx="12" cy="8.5" r="3.5" />
              <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
            </svg>
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-display text-lg font-semibold text-ink">{profile.full_name}</span>
          <span className="text-sm text-slate">
            {coach?.title ?? "Coach"}
            {coach?.organization ? ` · ${coach.organization}` : ""}
          </span>
        </div>
        <div className="ml-auto flex gap-6 font-mono text-xs text-slate">
          <span>
            <span className="font-display text-xl font-semibold text-ink">{engagements.length}</span>{" "}
            engagements
          </span>
          <span>
            <span className="font-display text-xl font-semibold text-ink">{totals.participants}</span>{" "}
            participants
          </span>
          <span>
            <span className="font-display text-xl font-semibold text-ink">{totals.completed}</span>{" "}
            completed
          </span>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <LinkButton href="/app/coach/profile" variant="outline">
            {coach ? "Edit profile" : "Set up profile"}
          </LinkButton>
          <LinkButton href="/app/coach/profile/preview" variant="ghost">
            Preview
          </LinkButton>
        </div>
      </section>

      {/* engagements */}
      <section aria-labelledby="engagements-heading" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 id="engagements-heading" className="font-display text-h3 font-semibold">
            Active engagements
          </h2>
          <LinkButton href="/app/teams/new">New engagement</LinkButton>
        </div>

        {engagements.length > 0 ? (
          <div className="flex flex-col gap-4">
            {engagements.map((team, index) => {
              const metric = engagementMetrics[index]!;
              const rate = metric.total > 0 ? Math.round((metric.completed / metric.total) * 100) : 0;
              return (
                <article key={team.id} className="paper-card flex flex-wrap items-center gap-x-6 gap-y-3 p-6">
                  <div className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5">
                    <span className="font-display text-lg font-semibold text-ink">{team.name}</span>
                    <span className="text-xs text-slate">
                      {[team.client_organization, team.session_name].filter(Boolean).join(" · ") || "—"}
                    </span>
                    <span className="font-mono text-[11px] text-faint">
                      {[
                        formatDate(team.engagement_starts_at) && `starts ${formatDate(team.engagement_starts_at)}`,
                        formatDate(team.deadline_at) && `deadline ${formatDate(team.deadline_at)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[11px] text-faint">
                      {metric.completed}/{metric.total} completed · {rate}%
                    </span>
                    <div className="h-1.5 w-40 overflow-hidden rounded-full bg-ink/8">
                      <div className="h-full rounded-full bg-botanical" style={{ width: `${rate}%` }} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { href: `/app/teams/${team.id}/dashboard`, label: "Dashboard" },
                        { href: `/app/teams/${team.id}/presentation`, label: "Presentation" },
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
              );
            })}
          </div>
        ) : (
          <div className="paper-card flex flex-col items-start gap-3 p-8">
            <p className="max-w-md text-sm leading-relaxed text-slate">
              No engagements yet. Create your first client team — the $8 Team
              plan covers invitations, live tracking and the presentation
              dashboard.
            </p>
            <LinkButton href="/app/teams/new">Create an engagement</LinkButton>
          </div>
        )}
      </section>
    </div>
  );
}
