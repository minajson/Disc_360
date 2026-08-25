import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireTeamAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { getPublicBaseUrl } from "@/lib/utils/site-url";
import {
  INSTRUMENT_KEYS,
  INSTRUMENTS,
  canServeToParticipants,
  isInstrumentKey,
  unavailableReason,
} from "@/data/wellbeing-instruments";
import { isProductionEnvironment, isWellbeingDemoEnabled } from "@/lib/wellbeing/environment";
import {
  InstrumentPicker,
  type InstrumentOption,
} from "@/components/wellbeing/InstrumentPicker";

export const metadata: Metadata = { title: "Campaign" };

const STATUS_LABEL: Record<string, string> = {
  active: "Available",
  demo_restricted: "Awaiting digital-use licence",
  structure_only: "Content verification required",
  licensed: "Licensed, not yet activated",
  retired: "Retired",
};

/**
 * The facilitator's Wellbeing Pulse campaign workspace.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT A FACILITATOR SEES, AND WHAT THEY DO NOT.
 *
 * Live Progress shows participation STATE only — not started, in progress,
 * completed. It never shows a score, and it cannot: the query below reads
 * `wellbeing_sessions` for status and never touches `wellbeing_results`, so
 * there is no score in this page's memory to leak through a payload, a log or
 * a future refactor.
 *
 * Names appear because a facilitator has to chase completion. A name beside a
 * score would be the single worst failure in this product, so the two are kept
 * in different queries against different tables.
 * ─────────────────────────────────────────────────────────────────────
 */
export default async function WellbeingCampaignPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  if (!z.uuid().safeParse(teamId).success) notFound();

  const context = await requireTeamAdmin(teamId);

  const { data: team } = await context.supabase
    .from("teams")
    .select("id, name, session_name, wellbeing_instrument_key, invite_token, organization_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) notFound();

  const currentKey =
    typeof team.wellbeing_instrument_key === "string" &&
    isInstrumentKey(team.wellbeing_instrument_key)
      ? team.wellbeing_instrument_key
      : null;

  // Service role after the team-admin check: roster and session STATE are
  // needed to run a campaign, and neither is readable cross-member under RLS.
  // Note what is not selected anywhere below — no score, no index, no answer.
  const admin = createSupabaseAdminClient();
  const [{ data: members }, { data: sessions }] = await Promise.all([
    admin
      .from("team_members")
      .select("id, display_name, email, profile_id")
      .eq("team_id", teamId)
      .order("display_name"),
    admin
      .from("wellbeing_sessions")
      .select("profile_id, status, instrument_key, completed_at")
      .eq("team_id", teamId),
  ]);

  const roster = members ?? [];
  const attempts = (sessions ?? []).filter(
    (session) => !currentKey || session.instrument_key === currentKey,
  );
  const byProfile = new Map(attempts.map((session) => [session.profile_id as string, session]));

  const completed = attempts.filter((session) => session.status === "completed").length;
  const inProgress = attempts.filter((session) => session.status === "in_progress").length;
  const invited = roster.length;
  const participation = invited > 0 ? Math.round((completed / invited) * 100) : null;
  const locked = attempts.length > 0;

  const isProduction = isProductionEnvironment();
  const demoEnabled = isWellbeingDemoEnabled();

  const options: InstrumentOption[] = INSTRUMENT_KEYS.map((key) => {
    const decision = canServeToParticipants(key, { isProduction, demoEnabled });
    return {
      key,
      status: INSTRUMENTS[key].status,
      selectable: decision.allowed,
      statusLabel: STATUS_LABEL[INSTRUMENTS[key].status] ?? unavailableReason(key),
      contentLoaded: key === "disc360_wellbeing_v1",
    };
  });

  const joinUrl = `${getPublicBaseUrl().url}/wellbeing/join/${team.invite_token}`;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
        Wellbeing Pulse campaign
      </p>
      <h1 className="mt-3 font-display text-h2 font-semibold tracking-tight">
        {team.session_name || team.name}
      </h1>
      <p className="mt-2 text-sm text-slate">
        {currentKey ? INSTRUMENTS[currentKey].name : "No instrument selected yet"}
        {currentKey && locked ? " · locked" : ""}
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
        {[
          { label: "Invited", value: String(invited) },
          { label: "Completed", value: String(completed) },
          { label: "In progress", value: String(inProgress) },
          { label: "Participation", value: participation === null ? "—" : `${participation}%` },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <dt className="text-[11px] tracking-[0.12em] text-faint uppercase">{stat.label}</dt>
            <dd className="font-display text-[clamp(1.6rem,4vw,2.1rem)] leading-none font-semibold text-ink tabular-nums">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <section className="pulse-card mt-9 p-6 sm:p-9">
        <InstrumentPicker
          teamId={teamId}
          options={options}
          current={currentKey}
          locked={locked}
          attemptCount={attempts.length}
        />
      </section>

      {currentKey && (
        <section className="pulse-card mt-6 flex flex-col gap-4 p-6 sm:p-9">
          <h2 className="font-display text-h3 font-semibold">Join link</h2>
          <p className="text-sm leading-relaxed text-slate">
            This link and its QR code carry the campaign, which carries the instrument. A
            participant opening it never chooses a questionnaire.
          </p>
          <code className="rounded-xl bg-pulse-mist px-4 py-3 font-mono text-xs break-all text-pulse-deep">
            {joinUrl}
          </code>
        </section>
      )}

      <section className="pulse-card mt-6 flex flex-col gap-4 p-6 sm:p-9">
        <div>
          <h2 className="font-display text-h3 font-semibold">Live progress</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate">
            Completion state only. Individual wellbeing scores and answers are not available on
            this page, or anywhere else in the facilitator workspace.
          </p>
        </div>

        {roster.length === 0 ? (
          <p className="text-sm text-slate">No participants on this campaign yet.</p>
        ) : (
          <ul className="divide-y divide-[rgba(31,78,95,0.12)]">
            {roster.map((member) => {
              const session = member.profile_id
                ? byProfile.get(member.profile_id as string)
                : undefined;
              const state = !session
                ? "Not started"
                : session.status === "completed"
                  ? "Completed"
                  : "In progress";
              return (
                <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="text-sm font-medium text-ink">{member.display_name}</span>
                  <span
                    className="ml-auto rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{
                      background:
                        state === "Completed"
                          ? "var(--color-pulse-soft)"
                          : "var(--color-sand)",
                      color:
                        state === "Completed"
                          ? "var(--color-pulse-deep)"
                          : "var(--color-slate)",
                    }}
                  >
                    {state}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <nav className="mt-8 flex flex-wrap gap-3">
        {currentKey && (
          <Link
            href={`/wellbeing/analytics?instrument=${currentKey}`}
            className="pulse-focus rounded-full bg-pulse px-5 py-2.5 text-sm font-medium text-white"
          >
            Open analytics
          </Link>
        )}
        <Link
          href="/wellbeing/admin/instruments"
          className="pulse-focus rounded-full border border-[rgba(31,78,95,0.24)] px-5 py-2.5 text-sm font-medium text-pulse"
        >
          Compare instruments
        </Link>
      </nav>
    </div>
  );
}
