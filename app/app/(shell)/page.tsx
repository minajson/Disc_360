import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/guards";
import { getTeamEntitlement } from "@/lib/payments/entitlements";
import { startAssessment } from "@/lib/actions/assessment";
import { insightMap } from "@/data/insight-maps";
import { displayArchetypeCode } from "@/lib/utils/display";
import { buildSharedReportUrl, getPublicBaseUrl } from "@/lib/utils/site-url";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Button } from "@/components/ui/Button";
import { DimensionMark } from "@/components/ui/DimensionMark";
import { DiscRadarChart } from "@/components/charts/DiscRadarChart";
import { ResultGlyph } from "@/components/charts/ResultGlyph";
import { ResultQuickActions } from "@/components/report/ResultQuickActions";
import { ProductCards } from "@/components/presentations/ProductCards";
import { JoinByCodeForm } from "@/components/teams/JoinByCodeForm";
import { SessionCard, type SessionProgress } from "@/components/teams/SessionCard";
import type {
  AssessmentProduct,
  PresentationAccess,
  SessionState,
} from "@/lib/teams/session";
import type { ArchetypeCode, Dimension } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

interface TeamMembershipRow {
  role: string;
  teams: {
    id: string;
    name: string;
    archived_at: string | null;
    session_mode: string;
    session_state: string;
    assessment_type: string;
    presentation_access: string;
  } | null;
}

export default async function AppDashboardPage() {
  const context = await requireOnboarded();
  const { supabase, user, profile } = context;

  const [{ data: openSession }, { data: results }, { data: memberships }, entitlement] =
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
        .select("id, share_token, score_d, score_i, score_s, score_c, archetype_code, primary_dimension, secondary_dimension, created_at")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("team_members")
        .select(
          "role, teams (id, name, archived_at, session_mode, session_state, assessment_type, presentation_access)",
        )
        .eq("profile_id", user.id),
      getTeamEntitlement(context),
    ]);

  const latest = results?.[0] ?? null;
  const teams = ((memberships ?? []) as unknown as TeamMembershipRow[])
    .filter((row) => row.teams && !row.teams.archived_at)
    .map((row) => ({ ...row.teams!, memberRole: row.role }));
  const isTeamAdmin = teams.some((team) => team.memberRole === "team_admin");
  const showTeamManagement = isTeamAdmin || entitlement.allowed;

  // Facilitator-led participants get ONE session card — the coach decides
  // what runs. Facilitators and self-paced users keep the full dashboard.
  const facilitatedTeam = isTeamAdmin
    ? null
    : (teams.find(
        (team) => team.memberRole !== "team_admin" && team.session_mode === "facilitator_led",
      ) ?? null);

  let sessionProgress: SessionProgress | null = null;
  if (facilitatedTeam) {
    const type = facilitatedTeam.assessment_type as AssessmentProduct;
    if (type === "focus") {
      const [{ data: open }, { data: result }] = await Promise.all([
        supabase
          .from("focus_sessions")
          .select("id")
          .eq("profile_id", user.id)
          .eq("status", "in_progress")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("focus_results")
          .select("id")
          .eq("profile_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      sessionProgress = {
        hasOpenSession: Boolean(open),
        hasResult: Boolean(result),
        continueHref: open ? `/focus/assessment/${open.id}` : null,
        resultHref: result ? `/focus/results/${result.id}` : null,
      };
    } else if (type === "combined") {
      const [{ data: open }, { data: result }] = await Promise.all([
        supabase
          .from("combined_sessions")
          .select("id")
          .eq("profile_id", user.id)
          .eq("status", "in_progress")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("combined_results")
          .select("id")
          .eq("profile_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      sessionProgress = {
        hasOpenSession: Boolean(open),
        hasResult: Boolean(result),
        continueHref: open ? "/combined/assessment" : null,
        resultHref: result ? `/combined/results/${result.id}` : null,
      };
    } else {
      sessionProgress = {
        hasOpenSession: Boolean(openSession),
        hasResult: Boolean(latest),
        continueHref: openSession ? `/app/assessments/${openSession.id}` : null,
        resultHref: latest ? `/app/results/${latest.id}` : null,
      };
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Dashboard</Eyebrow>
          <h1 className="font-display text-h2 font-semibold">
            Welcome back, {profile.preferred_name || profile.full_name}.
          </h1>
        </div>
        {facilitatedTeam ? null : openSession ? (
          <Link
            href={`/app/assessments/${openSession.id}`}
            className="inline-flex min-h-11 items-center rounded-full bg-botanical px-6 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
          >
            Continue assessment · {Math.min(openSession.current_index + 1, 24)}/24
          </Link>
        ) : !latest ? (
          <form action={startAssessment}>
            <Button type="submit" size="lg">
              Take your assessment
            </Button>
          </form>
        ) : null}
      </div>

      {/* latest result */}
      {latest ? (
        <section aria-label="Latest result" className="paper-card grid gap-7 p-7 sm:grid-cols-[0.7fr_1.3fr] sm:items-center">
          <DiscRadarChart
            scores={{ d: latest.score_d, i: latest.score_i, s: latest.score_s, c: latest.score_c }}
            className="mx-auto max-w-[220px]"
          />
          <div className="flex flex-col gap-3.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Latest profile · {formatDate(latest.created_at)} · {displayArchetypeCode(latest.archetype_code as ArchetypeCode)}
            </span>
            <h2 className="font-display text-h3 font-semibold">
              {insightMap[latest.archetype_code as ArchetypeCode].name}
            </h2>
            <div className="flex flex-wrap gap-2">
              <DimensionMark dimension={latest.primary_dimension as Dimension} />
              {latest.secondary_dimension ? (
                <DimensionMark dimension={latest.secondary_dimension as Dimension} />
              ) : null}
            </div>
            <ResultQuickActions
              resultId={latest.id}
              shareUrl={buildSharedReportUrl(getPublicBaseUrl(), latest.share_token)}
            />
          </div>
        </section>
      ) : (
        <section aria-label="Get started" className="paper-card flex flex-col items-start gap-3 p-7">
          <h2 className="font-display text-h3 font-semibold">Your profile starts here</h2>
          <p className="max-w-md text-sm leading-relaxed text-slate">
            24 scenarios, about seven minutes, autosaved as you go.
          </p>
        </section>
      )}

      {facilitatedTeam && sessionProgress ? (
        <SessionCard
          team={{
            id: facilitatedTeam.id,
            name: facilitatedTeam.name,
            assessment_type: facilitatedTeam.assessment_type as AssessmentProduct,
            session_state: facilitatedTeam.session_state as SessionState,
            presentation_access: facilitatedTeam.presentation_access as PresentationAccess,
          }}
          progress={sessionProgress}
        />
      ) : (
        <section aria-labelledby="products-heading" className="flex flex-col gap-4">
          <h2 id="products-heading" className="font-display text-h3 font-semibold">
            Assessments
          </h2>
          <ProductCards />
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* history */}
        <section aria-labelledby="recent-heading" className="flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between">
            <h2 id="recent-heading" className="font-display text-lg font-semibold">
              Assessment history
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
                  className="flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-mineral"
                >
                  <ResultGlyph
                    scores={{ d: row.score_d, i: row.score_i, s: row.score_s, c: row.score_c }}
                    size={30}
                  />
                  <span className="flex-1 text-sm font-medium text-ink">
                    {insightMap[row.archetype_code as ArchetypeCode].name}
                  </span>
                  <span className="font-mono text-[11px] text-faint">
                    {formatDate(row.created_at)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="paper-card p-6 text-sm text-slate">
              Completed profiles appear here.
            </div>
          )}
        </section>

        {/* teams / join */}
        <section aria-labelledby="teams-heading" className="flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between">
            <h2 id="teams-heading" className="font-display text-lg font-semibold">
              Teams
            </h2>
            {showTeamManagement ? (
              <Link href="/app/teams" className="text-sm text-slate hover:text-ink">
                Manage
              </Link>
            ) : null}
          </div>
          {teams.length > 0 ? (
            <div className="paper-card divide-y divide-hairline p-0">
              {teams.map((team) => (
                <Link
                  key={team.id}
                  href={
                    team.memberRole === "team_admin"
                      ? `/app/teams/${team.id}/dashboard`
                      : `/app/teams/${team.id}`
                  }
                  className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-mineral"
                >
                  <span className="text-sm font-medium text-ink">{team.name}</span>
                  <span className="font-mono text-[11px] text-faint">
                    {team.memberRole === "team_admin" ? "ADMIN" : "MEMBER"}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="paper-card flex flex-col gap-4 p-6">
              <span className="text-sm font-medium text-ink">Join a team</span>
              <JoinByCodeForm />
            </div>
          )}
          {facilitatedTeam ? null : (
            <Link
              href="/app/teams/new"
              className="paper-card flex items-center justify-between px-5 py-3.5 transition-all hover:-translate-y-0.5"
            >
              <span className="text-sm font-medium text-ink">Create a team</span>
              <span className="font-mono text-[11px] text-faint">
                {entitlement.allowed ? "READY" : "$8 TEAM PLAN"}
              </span>
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
