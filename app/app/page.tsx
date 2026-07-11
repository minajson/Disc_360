import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/guards";
import { startAssessment } from "@/lib/actions/assessment";
import { insightMap } from "@/data/insight-maps";
import { dimensionMeta, dimensionList } from "@/data/dimension-meta";
import { displayArchetypeCode } from "@/lib/utils/display";
import { dailyRotationIndex } from "@/lib/utils/daily";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Button } from "@/components/ui/Button";
import { DimensionMark } from "@/components/ui/DimensionMark";
import { DiscRadarChart } from "@/components/charts/DiscRadarChart";
import { ResultGlyph } from "@/components/charts/ResultGlyph";
import type { ArchetypeCode, Dimension } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

interface TeamMembershipRow {
  role: string;
  teams: { id: string; name: string; department: string | null; archived_at: string | null } | null;
}

export default async function AppDashboardPage() {
  const { supabase, user, profile } = await requireOnboarded();

  const [{ data: openSession }, { data: results }, { data: memberships }] =
    await Promise.all([
      supabase
        .from("assessment_sessions")
        .select("id, current_index")
        .eq("profile_id", user.id)
        .eq("status", "in_progress")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("assessment_results")
        .select("id, score_d, score_i, score_s, score_c, archetype_code, primary_dimension, secondary_dimension, created_at")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("team_members")
        .select("role, teams (id, name, department, archived_at)")
        .eq("profile_id", user.id),
    ]);

  const latest = results?.[0] ?? null;
  const teams = ((memberships ?? []) as unknown as TeamMembershipRow[])
    .filter((row) => row.teams && !row.teams.archived_at)
    .map((row) => ({ ...row.teams!, memberRole: row.role }));

  // A steady rotation through the four styles' communication guidance.
  const dayIndex = dailyRotationIndex();
  const tipDimension = dimensionList[dayIndex % 4]!;
  const tip = insightMap[tipDimension.code].communication.do[dayIndex % 5]!;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-12 sm:px-8">
      {/* welcome */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <Eyebrow>Dashboard</Eyebrow>
          <h1 className="font-display text-h2 font-semibold">
            Welcome back, {profile.preferred_name || profile.full_name}.
          </h1>
        </div>
        {openSession ? (
          <Link
            href={`/app/assessments/${openSession.id}`}
            className="inline-flex min-h-11 items-center rounded-full bg-botanical px-6 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
          >
            Continue assessment · scenario {Math.min(openSession.current_index + 1, 24)} of 24
          </Link>
        ) : !latest ? (
          <form action={startAssessment}>
            <Button type="submit" size="lg">
              Take your first assessment
            </Button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        {/* latest profile */}
        {latest ? (
          <section aria-label="Latest profile" className="paper-card grid gap-8 p-7 sm:grid-cols-[0.8fr_1.2fr] sm:items-center sm:p-8">
            <DiscRadarChart
              scores={{ d: latest.score_d, i: latest.score_i, s: latest.score_s, c: latest.score_c }}
              className="mx-auto max-w-[240px]"
            />
            <div className="flex flex-col gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
                Latest profile · {formatDate(latest.created_at)}
              </span>
              <h2 className="font-display text-h3 font-semibold">
                {insightMap[latest.archetype_code as ArchetypeCode].name}
              </h2>
              <p className="text-sm leading-relaxed text-slate">
                {insightMap[latest.archetype_code as ArchetypeCode].tagline}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <DimensionMark dimension={latest.primary_dimension as Dimension} />
                {latest.secondary_dimension ? (
                  <DimensionMark dimension={latest.secondary_dimension as Dimension} />
                ) : null}
              </div>
              <Link
                href={`/app/results/${latest.id}`}
                className="pt-1 text-sm font-medium text-botanical hover:underline"
              >
                Open full report →
              </Link>
            </div>
          </section>
        ) : (
          <section aria-label="Get started" className="paper-card flex flex-col items-start justify-center gap-4 p-8">
            <h2 className="font-display text-h3 font-semibold">
              Your profile starts here
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-slate">
              24 scenarios, about seven minutes, autosaved as you go. Your
              report covers communication, leadership, conflict, motivation
              and growth.
            </p>
          </section>
        )}

        {/* communication tip */}
        <section aria-label="Communication tip" className="paper-card flex flex-col gap-4 p-7">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal">
            Today&rsquo;s adaptation tip
          </span>
          <div className="flex items-center gap-2">
            <DimensionMark dimension={tipDimension.code} />
          </div>
          <p className="font-display text-lg leading-snug text-ink">
            When working with a {dimensionMeta[tipDimension.code].label} colleague: {tip.charAt(0).toLowerCase()}{tip.slice(1)}.
          </p>
          <Link href="/resources" className="mt-auto text-sm font-medium text-botanical hover:underline">
            All style guides →
          </Link>
        </section>
      </div>

      {/* history + teams */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="recent-heading" className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 id="recent-heading" className="font-display text-h3 font-semibold">
              Recent assessments
            </h2>
            <Link href="/app/history" className="text-sm text-slate hover:text-ink">
              View all
            </Link>
          </div>
          {(results ?? []).length > 0 ? (
            <div className="paper-card divide-y divide-hairline p-0">
              {(results ?? []).map((row) => (
                <Link
                  key={row.id}
                  href={`/app/results/${row.id}`}
                  className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-mineral"
                >
                  <ResultGlyph
                    scores={{ d: row.score_d, i: row.score_i, s: row.score_s, c: row.score_c }}
                    size={34}
                  />
                  <span className="flex-1 text-sm font-medium text-ink">
                    {insightMap[row.archetype_code as ArchetypeCode].name}
                  </span>
                  <span className="font-mono text-[11px] text-faint">
                    {displayArchetypeCode(row.archetype_code as ArchetypeCode)} · {formatDate(row.created_at)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="paper-card p-7 text-sm text-slate">
              Your completed profiles will appear here.
            </div>
          )}
        </section>

        <section aria-labelledby="teams-heading" className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 id="teams-heading" className="font-display text-h3 font-semibold">
              Your teams
            </h2>
            <Link href="/app/teams" className="text-sm text-slate hover:text-ink">
              All teams
            </Link>
          </div>
          {teams.length > 0 ? (
            <div className="paper-card divide-y divide-hairline p-0">
              {teams.map((team) => (
                <Link
                  key={team.id}
                  href={`/app/teams/${team.id}`}
                  className="flex items-center justify-between gap-4 px-6 py-3.5 transition-colors hover:bg-mineral"
                >
                  <span className="text-sm font-medium text-ink">{team.name}</span>
                  <span className="font-mono text-[11px] text-faint">
                    {team.memberRole === "team_admin" ? "ADMIN" : "MEMBER"}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="paper-card p-7 text-sm text-slate">
              You&rsquo;re not part of a team yet — join with a team code or
              create one from the Teams page.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
