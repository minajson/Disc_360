import "server-only";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { logRouteDiagnostic } from "@/lib/observability/diagnostics";
import { requireTeamAdmin } from "@/lib/auth/guards";
import { hasWellbeingRole } from "@/lib/wellbeing/access";
import { readPilotStatus, type PilotStatus } from "@/lib/wellbeing/pilot";
import {
  INSTRUMENTS,
  isInstrumentKey,
  type InstrumentKey,
  type InstrumentMetadata,
} from "@/data/wellbeing-instruments";
import {
  lifecycleOf,
  type CampaignLifecycle as CampaignLifecycleValue,
} from "./campaign-lifecycle";
import { campaignJoinPath } from "./campaigns";
import { getPublicBaseUrl } from "@/lib/utils/site-url";

/**
 * The Wellbeing Pulse CAMPAIGN workspace.
 *
 * ─────────────────────────────────────────────────────────────────────
 * TWO AUTHORISATIONS, DELIBERATELY DIFFERENT.
 *
 * Running a campaign and reading its figures are separate privileges, held by
 * different people for different reasons:
 *
 *  · ADMINISTRATION — chasing completion, printing the QR code, closing the
 *    campaign — is team administration. It sees participation STATE and no
 *    figure of any kind.
 *  · REPORTING — distributions, cohorts, trends, the aggregate report — is a
 *    wellbeing role held explicitly in the campaign's organisation. Team
 *    administration does not grant it, and neither does platform
 *    administration.
 *
 * So this module resolves both and reports them separately. A facilitator
 * without a wellbeing role runs their campaign and never sees a number; that
 * is the intended experience, not a degraded one.
 *
 * WHAT IS NOT READ HERE, AT ALL.
 *
 * No score, no index, no dimension, no answer. The participation reader below
 * queries `wellbeing_sessions` for status and position only. There is
 * therefore no individual figure in this module's memory to leak through a
 * payload, a log line or a stack trace — completion status cannot become
 * result visibility by a later refactor, because the result was never here.
 * ─────────────────────────────────────────────────────────────────────
 */

/* ── identity ───────────────────────────────────────────────────────── */

/**
 * A campaign's lifecycle state.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THIS USED TO BE DERIVED, AND THE DERIVATION WAS WRONG.
 *
 * The previous implementation computed a status from three unrelated facts —
 * `teams.archived_at`, `teams.join_enabled`, and whether any session existed —
 * on the reasoning that a stored status drifts from reality. In practice it
 * derived the wrong reality: `join_enabled` is FALSE on every wellbeing roster
 * by design (it is what stops `resolve_join_token` delivering a wellbeing
 * participant into the DISC assessment), so every healthy campaign in
 * production reported
 *
 *     Closed — "Joining is switched off."
 *
 * while admitting participants normally, and with no control anywhere to
 * "switch it on" because there was nothing switched off.
 *
 * The state is now read from `wellbeing_campaigns.status`, which is the column
 * `wellbeing_campaign_admits()` and `wellbeing_campaign_by_token()` actually
 * enforce. There is exactly one source of truth, and it is the one the
 * participant experiences.
 * ─────────────────────────────────────────────────────────────────────
 */
export type { CampaignLifecycle } from "./campaign-lifecycle";

export interface CampaignIdentity {
  /**
   * The ROSTER team id — what every existing route, aggregate and cohort query
   * is keyed by, and therefore what `/wellbeing/admin/campaigns/[teamId]`
   * carries. Kept as `id` so those call sites are unchanged.
   */
  id: string;
  /** The `wellbeing_campaigns` row. Null only for a roster with no campaign. */
  campaignId: string | null;
  name: string;
  organizationId: string;
  organizationName: string;
  instrumentKey: InstrumentKey | null;
  instrument: InstrumentMetadata | null;
  /** The pinned questionnaire version's human label, e.g. "1.0". */
  versionLabel: string | null;
  /** True once anybody has answered: the questionnaire can no longer change. */
  questionnaireLocked: boolean;
  capacity: number | null;
  lifecycle: CampaignLifecycleValue;
  openedAt: string | null;
  pausedAt: string | null;
  closedAt: string | null;
  expiresAt: string | null;
  /** The participant join URL. Null when the campaign has no token to share. */
  joinUrl: string | null;
  createdAt: string;
  /** Whether this viewer may see aggregate figures for this campaign. */
  canReport: boolean;
  /** Never true for a plain participant — used only for the escape route. */
  canOpenPlatform: boolean;
}

/**
 * Resolves the campaign and the viewer's two privileges.
 *
 * `requireTeamAdmin` runs FIRST and is what makes the service-role reads below
 * legitimate. The wellbeing role is checked afterwards, through the caller's
 * own client, and only decides whether figures may be shown — never whether
 * the campaign may be administered.
 *
 * THE CAMPAIGN ROW IS THE AUTHORITY ON THE INSTRUMENT TOO.
 *
 * It has to be. The participant journey resolves instrument and version from
 * `wellbeing_campaigns` (see `beginWellbeingPulse`), so a facilitator page
 * that read the instrument from `teams` could show one questionnaire while the
 * QR code served another. `teams.wellbeing_instrument_key` is kept in step by
 * `setCampaignInstrumentAction` and is used only as a fallback for a roster
 * that predates campaigns.
 */
export async function loadCampaignIdentity(teamId: string): Promise<{
  identity: CampaignIdentity;
  pilot: PilotStatus;
}> {
  const context = await requireTeamAdmin(teamId);

  const admin = createSupabaseAdminClient();
  const { data: team } = await admin
    .from("teams")
    .select(
      "id, name, session_name, assessment_type, wellbeing_instrument_key, wellbeing_pilot_capacity, organization_id, archived_at, created_at, organizations (name)",
    )
    .eq("id", teamId)
    .maybeSingle();
  if (!team) notFound();

  // This workspace is for wellbeing campaigns. A DISC team reaching it is a
  // routing mistake, and rendering wellbeing chrome over DISC data would be
  // the same product-boundary failure in the opposite direction.
  if (team.assessment_type !== "wellbeing") notFound();

  /*
   * ───────────────────────────────────────────────────────────────────
   * THE EMBED IS NAMED, AND THE ERROR IS NOT SWALLOWED.
   *
   * `wellbeing_campaigns` has TWO foreign keys into `wellbeing_versions` —
   * `version_id → id`, and 00044's composite `(instrument_key, version_id) →
   * (questionnaire_code, id)` that makes the pair impossible to drift apart.
   * An unqualified `wellbeing_versions (…)` embed is therefore ambiguous, and
   * PostgREST answers PGRST201 with NO ROWS rather than picking one.
   *
   * Destructuring only `data` turned that into a campaign that appeared not to
   * exist: the workspace fell back to reading the roster team, reported a
   * healthy live campaign as "Draft", and dropped the QR panel entirely —
   * because the join link comes from the row that had just failed to load.
   * That is the same failure mode as the `join_enabled` bug it replaced: a
   * lookup quietly returning nothing, and a page rendering a confident wrong
   * answer from the fallback.
   *
   * So the relationship is named, and a failure is logged rather than
   * rendered. A campaign that cannot be read is not a campaign in draft.
   * ───────────────────────────────────────────────────────────────────
   */
  const { data: campaign, error: campaignError } = await admin
    .from("wellbeing_campaigns")
    .select(
      "id, name, status, instrument_key, version_id, participant_capacity, join_token, opened_at, paused_at, closed_at, expires_at, wellbeing_versions!wellbeing_campaigns_version_id_fkey (version)",
    )
    .eq("team_id", teamId)
    .maybeSingle();

  if (campaignError) {
    logRouteDiagnostic({
      route: "wellbeing/admin/campaigns/[teamId]",
      teamId,
      step: "load_campaign",
      code: campaignError.code,
      message: campaignError.message,
    });
  }

  const campaignInstrument = campaign?.instrument_key;
  const instrumentKey =
    typeof campaignInstrument === "string" && isInstrumentKey(campaignInstrument)
      ? campaignInstrument
      : typeof team.wellbeing_instrument_key === "string" &&
          isInstrumentKey(team.wellbeing_instrument_key)
        ? team.wellbeing_instrument_key
        : null;

  const organizationId = team.organization_id as string;
  const organization = Array.isArray(team.organizations)
    ? team.organizations[0]
    : team.organizations;
  const version = Array.isArray(campaign?.wellbeing_versions)
    ? campaign?.wellbeing_versions[0]
    : campaign?.wellbeing_versions;

  const [pilot, { count: answered }, canReport] = await Promise.all([
    readPilotStatus(teamId),
    // The lock the facilitator is shown is the one the DATABASE enforces:
    // 00044's trigger counts sessions belonging to the campaign, so this
    // counts the same thing rather than approximating it from the roster.
    campaign
      ? admin
          .from("wellbeing_sessions")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaign.id)
      : admin
          .from("wellbeing_sessions")
          .select("id", { count: "exact", head: true })
          .eq("team_id", teamId),
    organizationId
      ? hasWellbeingRole(context, organizationId, "wellbeing_analyst").then(
          async (analyst) =>
            analyst || hasWellbeingRole(context, organizationId, "wellbeing_governance"),
        )
      : Promise.resolve(false),
  ]);

  // Archived is a filing state on the roster; the campaign's own status is
  // everything else. A roster archived out from under a live campaign should
  // still read as archived, so that one flag is honoured on top.
  const lifecycle: CampaignLifecycleValue = team.archived_at
    ? "archived"
    : lifecycleOf(campaign?.status as string | undefined);

  const joinToken = campaign?.join_token as string | undefined;

  return {
    pilot,
    identity: {
      id: teamId,
      campaignId: (campaign?.id as string | undefined) ?? null,
      name:
        (campaign?.name as string | null) ||
        (team.session_name as string | null) ||
        (team.name as string),
      organizationId,
      organizationName: (organization as { name: string } | null)?.name ?? "Organisation",
      instrumentKey,
      instrument: instrumentKey ? INSTRUMENTS[instrumentKey] : null,
      versionLabel: (version as { version: string } | null)?.version ?? null,
      questionnaireLocked: (answered ?? 0) > 0,
      capacity:
        (campaign?.participant_capacity as number | null) ??
        (team.wellbeing_pilot_capacity as number | null) ??
        null,
      lifecycle,
      openedAt: (campaign?.opened_at as string | null) ?? null,
      pausedAt: (campaign?.paused_at as string | null) ?? null,
      closedAt: (campaign?.closed_at as string | null) ?? null,
      expiresAt: (campaign?.expires_at as string | null) ?? null,
      joinUrl: joinToken
        ? `${getPublicBaseUrl().url}${campaignJoinPath(joinToken)}`
        : null,
      createdAt: team.created_at as string,
      canReport,
      canOpenPlatform: true,
    },
  };
}


/* ── participation administration ───────────────────────────────────── */

/**
 * A participant's ADMINISTRATIVE state. Never a result.
 *
 * These five values are the whole vocabulary this workspace has about a named
 * person, and the reader below is physically incapable of producing a sixth:
 * it selects `status` and `current_index` from `wellbeing_sessions` and
 * nothing else. Completion is a fact about a questionnaire being finished. It
 * confers no visibility of what was answered.
 */
export type ParticipantState = "pending" | "opened" | "started" | "completed";

export const PARTICIPANT_STATE_LABEL: Record<ParticipantState, string> = {
  pending: "Not started",
  opened: "Opened",
  started: "In progress",
  completed: "Completed",
};

export interface CampaignParticipant {
  id: string;
  name: string;
  state: ParticipantState;
}

export interface CampaignParticipation {
  invited: number;
  opened: number;
  started: number;
  completed: number;
  pending: number;
  /** Completed over invited, to one decimal. Null when there is no roster. */
  participation: number | null;
  participants: CampaignParticipant[];
  /**
   * Quarters in which this campaign has recorded a completion, oldest first.
   *
   * Derived from session TIMESTAMPS, not from results — the participation
   * reader holds no figure, and naming the wave a campaign is in must not
   * become the one place a figure sneaks in. The count is administrative:
   * per-wave figures live in Trends, which suppresses them.
   */
  waves: CampaignPeriod[];
}

/**
 * Participation state for one campaign.
 *
 * Service role after the team-admin check: a roster and its session states are
 * needed to run a campaign, and neither is readable cross-member under RLS.
 * Note what is not selected — no score, no index, no dimension, no answer.
 */
export async function loadCampaignParticipation(
  teamId: string,
  instrumentKey: InstrumentKey | null,
): Promise<CampaignParticipation> {
  const admin = createSupabaseAdminClient();
  const [{ data: members }, { data: sessions }] = await Promise.all([
    admin
      .from("team_members")
      .select("id, display_name, profile_id")
      .eq("team_id", teamId)
      .order("display_name"),
    admin
      .from("wellbeing_sessions")
      .select("profile_id, status, current_index, instrument_key, completed_at")
      .eq("team_id", teamId),
  ]);

  const roster = members ?? [];
  // A campaign runs one instrument. Filtering here means a campaign whose
  // instrument was changed before launch does not count the abandoned
  // attempts of the previous one as participation in this one.
  const attempts = (sessions ?? []).filter(
    (session) => !instrumentKey || session.instrument_key === instrumentKey,
  );

  const byProfile = new Map<string, { status: string; current_index: number }>();
  for (const session of attempts) {
    const profileId = session.profile_id as string;
    const existing = byProfile.get(profileId);
    const candidate = {
      status: session.status as string,
      current_index: (session.current_index as number) ?? 0,
    };
    // Furthest progress wins, so a person who completed once and later opened
    // a new wave still reads as completed rather than regressing.
    if (!existing || rank(candidate) > rank(existing)) byProfile.set(profileId, candidate);
  }

  const participants: CampaignParticipant[] = roster.map((member) => {
    const session = member.profile_id
      ? byProfile.get(member.profile_id as string)
      : undefined;
    return {
      id: member.id as string,
      name: (member.display_name as string) ?? "Participant",
      state: stateOf(session),
    };
  });

  const tally = (state: ParticipantState) =>
    participants.filter((participant) => participant.state === state).length;

  const invited = participants.length;
  const completed = tally("completed");

  // Quarters, matching how the analytics layer buckets waves — one definition,
  // so the header can never name a wave the trend does not plot.
  const quarters = [
    ...new Set(
      attempts
        .map((session) => session.completed_at as string | null)
        .filter((at): at is string => typeof at === "string")
        .map((at) => {
          const date = new Date(at);
          return `${date.getUTCFullYear()}-${Math.floor(date.getUTCMonth() / 3) * 3}`;
        }),
    ),
  ].sort();

  return {
    invited,
    // "Opened" counts everyone who has at least opened the questionnaire, so
    // the five figures describe a funnel rather than five disjoint buckets a
    // reader has to add up themselves.
    opened: invited - tally("pending"),
    started: completed + tally("started"),
    completed,
    pending: tally("pending"),
    participation: invited > 0 ? Math.round((completed / invited) * 1000) / 10 : null,
    participants,
    waves: quarters.map((quarter, index) => {
      const [year, month] = quarter.split("-").map(Number);
      return describePeriod(new Date(Date.UTC(year!, month!, 1)).toISOString(), index + 1);
    }),
  };
}

/* ── the live tally ─────────────────────────────────────────────────── */

/**
 * Five integers, and nothing else in the payload.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY A SEPARATE READER FROM `loadCampaignParticipation`.
 *
 * This one is polled — by the SSE stream behind the facilitator's live panel —
 * so it runs perhaps once every few seconds for as long as a facilitator has
 * the page open. `loadCampaignParticipation` builds a named roster to render a
 * list; re-fetching names on a timer to display four counters puts a workforce
 * roster on the wire dozens of times an hour for no reason, and the safest
 * payload is the one that never contains a name in the first place.
 *
 * WHY `joined` IS NOT SIMPLY THE ROSTER SIZE.
 *
 * The facilitator who creates a campaign is inserted onto its roster as a
 * `team_admin` so they can administer it. Counting them as a participant makes
 * every campaign report one person who will never complete, which drags the
 * completion rate down permanently and is most visible on exactly the small
 * campaigns where it matters — "0 of 1 completed" before anybody has scanned
 * anything. An administrator who genuinely takes part has a session, and is
 * counted from that.
 * ─────────────────────────────────────────────────────────────────────
 */
export interface CampaignTally {
  joined: number;
  inProgress: number;
  completed: number;
  /** Completed over joined, to one decimal. Null when nobody has joined. */
  completionRate: number | null;
  /** Null when the campaign is uncapped. */
  placesRemaining: number | null;
}

export async function loadCampaignTally(
  teamId: string,
  instrumentKey: InstrumentKey | null,
  capacity: number | null,
): Promise<CampaignTally> {
  const admin = createSupabaseAdminClient();
  const [{ data: members }, { data: sessions }] = await Promise.all([
    admin.from("team_members").select("profile_id, role").eq("team_id", teamId),
    admin
      .from("wellbeing_sessions")
      .select("profile_id, status, current_index, instrument_key")
      .eq("team_id", teamId),
  ]);

  const attempts = (sessions ?? []).filter(
    (session) => !instrumentKey || session.instrument_key === instrumentKey,
  );

  const furthest = new Map<string, { status: string; current_index: number }>();
  for (const session of attempts) {
    const profileId = session.profile_id as string;
    const candidate = {
      status: session.status as string,
      current_index: (session.current_index as number) ?? 0,
    };
    const existing = furthest.get(profileId);
    if (!existing || rank(candidate) > rank(existing)) furthest.set(profileId, candidate);
  }

  const participants = (members ?? []).filter((member) => {
    const profileId = member.profile_id as string | null;
    if (!profileId) return true;
    // An administrator counts only once they have actually taken part.
    return member.role !== "team_admin" || furthest.has(profileId);
  });

  let inProgress = 0;
  let completed = 0;
  for (const member of participants) {
    const state = stateOf(
      member.profile_id ? furthest.get(member.profile_id as string) : undefined,
    );
    if (state === "completed") completed += 1;
    else if (state === "started" || state === "opened") inProgress += 1;
  }

  const joined = participants.length;

  return {
    joined,
    inProgress,
    completed,
    completionRate: joined > 0 ? Math.round((completed / joined) * 1000) / 10 : null,
    placesRemaining: capacity === null ? null : Math.max(0, capacity - joined),
  };
}

function rank(session: { status: string; current_index: number }): number {
  if (session.status === "completed") return 3;
  return session.current_index > 0 ? 2 : 1;
}

function stateOf(session?: { status: string; current_index: number }): ParticipantState {
  if (!session) return "pending";
  if (session.status === "completed") return "completed";
  return session.current_index > 0 ? "started" : "opened";
}

/* ── waves ──────────────────────────────────────────────────────────── */

export interface CampaignPeriod {
  /** 1-based, oldest first. */
  index: number;
  label: string;
  /** e.g. "August 2026". */
  period: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Describes the wave a campaign is currently in.
 *
 * Waves are quarters, matching how the analytics layer buckets them — one
 * definition, so the header can never name a wave the trend does not plot.
 * A campaign with no responses yet is in its first wave, dated today: saying
 * "Wave 0" or leaving it blank tells a facilitator nothing useful.
 */
export function describeCurrentPeriod(waveLabels: readonly string[], now: Date): CampaignPeriod {
  const index = Math.max(1, waveLabels.length);
  return {
    index,
    label: `Wave ${index}`,
    period: `${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`,
  };
}

/** The same, for a wave that has already happened. */
export function describePeriod(at: string, index: number): CampaignPeriod {
  const date = new Date(at);
  return {
    index,
    label: `Wave ${index}`,
    period: `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
  };
}

/* ── the reporting tabs' shared entry ───────────────────────────────── */

export interface CampaignReportingContext {
  identity: CampaignIdentity;
  instrumentKey: InstrumentKey;
  instrument: InstrumentMetadata;
  source: import("@/lib/wellbeing/analytics").AnalyticsSource;
  scope: { campaignId: string };
  period: CampaignPeriod;
  /** The live campaign's administrative state. Always the real campaign. */
  participation: CampaignParticipation;
  /**
   * The participation figures that belong BESIDE the figures on the page.
   *
   * For a live reading these are the campaign's own. For a synthetic reading
   * they are the synthetic population's, because the alternative is a header
   * reporting "53 of 54 completed" above a distribution of two hundred and
   * eight synthetic responses — two populations on one screen, which is
   * precisely the confusion the source switch exists to prevent.
   */
  headline: { invited: number; completed: number; participation: number | null };
}

/**
 * Everything a reporting tab needs, resolved once and identically.
 *
 * Returns null — rather than throwing — in the two cases a tab must handle
 * rather than crash on: the viewer holds no wellbeing role in this campaign's
 * organisation, or the campaign has no instrument and therefore nothing to
 * report. Both are ordinary states with something useful to say, and an error
 * boundary says none of it.
 */
export async function loadCampaignReporting(
  teamId: string,
  sourceParam: string | undefined,
): Promise<
  | { ok: true; context: CampaignReportingContext }
  | { ok: false; reason: "no_role" | "no_instrument"; identity: CampaignIdentity }
> {
  const { parseAnalyticsSource, getWellbeingWorkspace } = await import(
    "@/lib/wellbeing/analytics"
  );
  const { identity } = await loadCampaignIdentity(teamId);

  if (!identity.canReport) return { ok: false, reason: "no_role", identity };
  if (!identity.instrumentKey || !identity.instrument) {
    return { ok: false, reason: "no_instrument", identity };
  }

  const source = parseAnalyticsSource(sourceParam);
  const participation = await loadCampaignParticipation(teamId, identity.instrumentKey);

  // A synthetic reading issues no participant-table query, so this costs a
  // computation rather than a round trip.
  const synthetic =
    source === "live"
      ? null
      : await getWellbeingWorkspace(identity.organizationId, identity.instrumentKey, source, {
          campaignId: teamId,
        });

  return {
    ok: true,
    context: {
      identity,
      instrumentKey: identity.instrumentKey,
      instrument: identity.instrument,
      source,
      scope: { campaignId: teamId },
      period: describeCurrentPeriod(
        participation.waves.map((wave) => wave.label),
        new Date(),
      ),
      participation,
      headline: synthetic
        ? {
            invited: synthetic.invited,
            completed: synthetic.participants,
            participation: synthetic.participation,
          }
        : {
            invited: participation.invited,
            completed: participation.completed,
            participation: participation.participation,
          },
    },
  };
}
