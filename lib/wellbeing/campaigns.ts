import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createSupabaseAnonClient } from "@/lib/db/anon";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { logRouteDiagnostic } from "@/lib/observability/diagnostics";
import { isInstrumentKey, type InstrumentKey } from "@/data/wellbeing-instruments";
import { PARTICIPANT_REFUSAL } from "./campaign-lifecycle";

/**
 * Wellbeing campaigns — the ONE place the participant journey resolves through.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE REPLACED.
 *
 * The wellbeing journey used to run on DISC's invitation machinery:
 *
 *   teams.invite_token → resolve_join_token → getActiveQuestionnaire()
 *
 * Every step of that is a DISC concept borrowed by a different product. The
 * consequence was not cosmetic. `getActiveQuestionnaire()` resolves the
 * questionnaire by `is_active` — "whichever version is switched on right now"
 * — so the version a participant answered was a property of the CLOCK, not of
 * the campaign they joined. It looked correct only because a unique index
 * permits one active version per instrument, making "the active one"
 * accidentally deterministic. Seed a second version and two people in one
 * campaign answer different content and are compared as though they had not.
 *
 * `wellbeing_campaigns` (00044) was built to own exactly this and was never
 * adopted. This module is the adoption:
 *
 *   wellbeing_campaigns.join_token
 *     → wellbeing_campaign_by_token()
 *       → campaign.instrument_key
 *       → campaign.version_id          ← authoritative, permanently
 *
 * NO FALLBACK, DELIBERATELY.
 *
 * A token that does not resolve to a campaign is not retried against the DISC
 * resolver. Falling back would mean a mistyped or revoked wellbeing link could
 * land a participant in the DISC assessment — a different product, with a
 * different consent, measuring a different thing. An unknown wellbeing token
 * produces a wellbeing refusal.
 * ─────────────────────────────────────────────────────────────────────
 */

/* ── the token ──────────────────────────────────────────────────────── */

/**
 * The column's own rule, restated so the application refuses a bad token
 * before the database has to: `^[A-Za-z0-9_-]{24,64}$`.
 */
const JOIN_TOKEN = /^[A-Za-z0-9_-]{24,64}$/;

export function isJoinTokenShape(token: string): boolean {
  return JOIN_TOKEN.test(token);
}

/**
 * A new campaign's join token.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY 32 RANDOM BYTES AND NOT `crypto.randomUUID()`.
 *
 * The requirement is that a token be cryptographically secure, non-sequential,
 * high-entropy, unique, and not derivable from the campaign's id. A v4 UUID
 * from `crypto.randomUUID()` already satisfies every one of those — it is CSPRNG
 * -backed, carries 122 bits of entropy, and has no relationship to the row it
 * names. Changing away from it merely for appearance would be exactly the kind
 * of churn that looks like security work and is not.
 *
 * It is changed for a reason that is not appearance. A UUID is INDISTINGUISHABLE
 * from every other id in this system — team ids, session ids, result ids,
 * profile ids are all UUIDs — and this one is the only public secret among
 * them. When the thing you must never paste into a support ticket looks
 * identical to the things you may, the format is doing nothing to help anyone
 * tell them apart. A 43-character base64url string is visibly a credential.
 *
 * 32 bytes gives 256 bits, and `randomBytes` is the CSPRNG. Uniqueness is not
 * argued from probability alone: `join_token` is UNIQUE, so a collision is a
 * failed insert rather than a shared campaign.
 *
 * Converted legacy campaigns keep their original UUID token — see 00047. Both
 * forms satisfy the column's check and both resolve through the same single
 * lookup, so honouring an already-printed link costs no second code path.
 * ─────────────────────────────────────────────────────────────────────
 */
export function generateJoinToken(): string {
  return randomBytes(32).toString("base64url");
}

/* ── public, pre-authentication context ─────────────────────────────── */

/**
 * What an UNAUTHENTICATED scanner may be shown.
 *
 * Deliberately thin. A printed QR is scanned by whoever picks up the poster,
 * so this carries the campaign's name, the organisation that is running it and
 * which questionnaire it is — and no capacity count, no roster, no facilitator
 * identity, no participant. `wellbeing_campaign_by_token` is SECURITY DEFINER
 * and returns exactly these columns, so the boundary is the database's rather
 * than a filter this module could forget to apply.
 */
export interface PublicCampaign {
  campaignId: string;
  campaignName: string;
  organizationName: string | null;
  instrumentKey: InstrumentKey;
  versionId: string;
  status: string;
  isOpen: boolean;
  capacityReached: boolean;
}

/**
 * Why a campaign will not admit somebody, in words a participant can act on.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE LIFECYCLE HALF IS NOT WRITTEN HERE.
 *
 * It is imported from `campaign-lifecycle.ts`, which owns the states. When
 * `paused` was added, this map still listed four lifecycle keys and a lookup
 * for a paused campaign missed — so a participant who scanned a perfectly
 * valid QR code for a campaign their facilitator had paused for ten minutes
 * was told:
 *
 *     "This link doesn't match a Wellbeing Pulse campaign. Check the link or
 *      ask whoever invited you for a new one."
 *
 * That is wrong, it is alarming, and it sends somebody to find a new link that
 * does not exist. Deriving the lifecycle messages from the lifecycle means a
 * future state cannot be added without one.
 *
 * `not_found` is now reachable ONLY when the token genuinely resolves to
 * nothing — see `campaignStateMessage`, which refuses to guess.
 * ─────────────────────────────────────────────────────────────────────
 */
export const CAMPAIGN_STATE_MESSAGES: Record<string, string> = {
  // Lifecycle states, owned by campaign-lifecycle.ts.
  ...PARTICIPANT_REFUSAL,

  not_found:
    "This link doesn't match a Wellbeing Pulse campaign. Check the link or ask whoever invited you for a new one.",
  // `active` but past its end date: the campaign ran and has finished.
  expired: "This check-in has ended, so it is no longer accepting responses.",
  full: "This campaign has reached its participant capacity, so no new participant can join.",
  service_failure:
    "We couldn't check this campaign just now. Please try again in a moment.",
};

/**
 * The sentence for a refusal key, with a fallback that never accuses the link.
 *
 * A key this build does not recognise means the product has changed under a
 * page, not that the participant mistyped something. Telling them their link
 * is wrong sends them looking for a replacement that does not exist; telling
 * them the check-in is not open right now is true of every unknown state,
 * because the only state that admits anybody is `open`.
 */
export function campaignStateMessage(blocked: string | null): string | null {
  if (blocked === null) return null;
  return (
    CAMPAIGN_STATE_MESSAGES[blocked] ??
    "This check-in is not open at the moment. Please check back with whoever invited you."
  );
}

export interface CampaignResolution {
  campaign: PublicCampaign | null;
  /** A key into CAMPAIGN_STATE_MESSAGES, or null when the campaign admits. */
  blocked: string | null;
}

/**
 * Resolve a join token to its campaign, through the anon client.
 *
 * The token is the authorization, and the RPC validates inside the database.
 * No service-role dependency: a misconfigured admin key cannot break public
 * joining, which is the same property the DISC join route has.
 */
export async function resolveCampaignByToken(token: string): Promise<CampaignResolution> {
  if (!isJoinTokenShape(token)) return { campaign: null, blocked: "not_found" };

  const anon = createSupabaseAnonClient();
  const { data, error } = await anon.rpc("wellbeing_campaign_by_token", { token });

  if (error) {
    logRouteDiagnostic({
      route: "/wellbeing/join/[token]",
      step: "wellbeing_campaign_by_token-rpc",
      code: error.code,
      message: error.message,
    });
    return { campaign: null, blocked: "service_failure" };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { campaign: null, blocked: "not_found" };

  const instrumentKey = row.instrument_key as string;
  if (!isInstrumentKey(instrumentKey)) {
    // A campaign naming an instrument this build does not know is a
    // configuration fault, not a participant's problem. It is refused rather
    // than rendered, because there is no questionnaire to serve.
    return { campaign: null, blocked: "not_found" };
  }

  const campaign: PublicCampaign = {
    campaignId: row.campaign_id as string,
    campaignName: row.campaign_name as string,
    organizationName: (row.organization_name as string | null) ?? null,
    instrumentKey,
    versionId: row.version_id as string,
    status: row.status as string,
    isOpen: Boolean(row.is_open),
    capacityReached: Boolean(row.capacity_reached),
  };

  // Lifecycle first, then capacity: "this campaign closed" is more useful than
  // "this campaign is full" when both are true.
  if (!campaign.isOpen) {
    const reason =
      campaign.status === "active" ? "expired" : (campaign.status ?? "closed");
    return { campaign, blocked: reason };
  }
  if (campaign.capacityReached) return { campaign, blocked: "full" };

  return { campaign, blocked: null };
}

/* ── authorised, post-authentication context ────────────────────────── */

export interface AuthorisedCampaign extends PublicCampaign {
  organizationId: string;
  /** The roster this campaign counts participation against. */
  teamId: string | null;
}

/**
 * The full campaign, loaded server-side once the participant is authenticated.
 *
 * Service role is justified narrowly and for the same reason `acceptTeamLink`
 * justifies it: the TOKEN is the authorization. A participant holding a valid
 * campaign token is entitled to join that campaign, and they hold no row in
 * any table that RLS could grant them the campaign through — reading it under
 * their own client would require a policy that let any authenticated user read
 * every campaign, which is a far larger grant than this one lookup.
 *
 * It is reached only from a token that already resolved, and returns nothing a
 * participant may not see.
 */
export async function loadAuthorisedCampaignByToken(
  token: string,
): Promise<AuthorisedCampaign | null> {
  if (!isJoinTokenShape(token)) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("wellbeing_campaigns")
    .select(
      "id, name, organization_id, instrument_key, version_id, status, team_id, expires_at, organizations (name)",
    )
    .eq("join_token", token)
    .maybeSingle();

  if (error || !data) return null;
  const instrumentKey = data.instrument_key as string;
  if (!isInstrumentKey(instrumentKey)) return null;

  const organization = Array.isArray(data.organizations)
    ? data.organizations[0]
    : data.organizations;
  const expiresAt = data.expires_at as string | null;

  return {
    campaignId: data.id as string,
    campaignName: data.name as string,
    organizationName: (organization as { name: string } | null)?.name ?? null,
    organizationId: data.organization_id as string,
    instrumentKey,
    versionId: data.version_id as string,
    status: data.status as string,
    teamId: (data.team_id as string | null) ?? null,
    isOpen: data.status === "active" && (!expiresAt || new Date(expiresAt) > new Date()),
    capacityReached: false,
  };
}

/** The campaign a participant is actually taking, by id, for the start action. */
export async function loadAuthorisedCampaignById(
  campaignId: string,
): Promise<AuthorisedCampaign | null> {
  if (!z.uuid().safeParse(campaignId).success) return null;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("wellbeing_campaigns")
    .select("join_token")
    .eq("id", campaignId)
    .maybeSingle();
  if (!data) return null;
  return loadAuthorisedCampaignByToken(data.join_token as string);
}

/* ── the roster ─────────────────────────────────────────────────────── */

export interface RosterResult {
  ok: boolean;
  error?: string;
}

/**
 * Put the authenticated participant on this campaign's roster.
 *
 * The roster is what gives participation an honest denominator: without it a
 * campaign reports a rate against nobody. It is a `team_members` row because
 * that is what every aggregate, cohort and suppression check already reads —
 * see 00047 for why the campaign points at a roster rather than replacing it.
 *
 * Idempotent, and it never moves somebody else's roster entry onto this
 * account: an entry already claimed by a different profile is refused rather
 * than overwritten.
 */
export async function joinCampaignRoster(
  campaign: AuthorisedCampaign,
  user: { id: string },
  profile: { email: string; full_name: string | null },
): Promise<RosterResult> {
  if (!campaign.teamId) return { ok: true }; // a campaign with no roster counts nobody

  const admin = createSupabaseAdminClient();

  const { data: byProfile } = await admin
    .from("team_members")
    .select("id")
    .eq("team_id", campaign.teamId)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (byProfile) return { ok: true };

  const { data: byEmail } = await admin
    .from("team_members")
    .select("id, profile_id")
    .eq("team_id", campaign.teamId)
    .eq("email", profile.email)
    .maybeSingle();

  if (byEmail?.profile_id && byEmail.profile_id !== user.id) {
    return { ok: false, error: "This roster entry belongs to another account." };
  }
  if (byEmail) {
    await admin
      .from("team_members")
      .update({ profile_id: user.id, display_name: profile.full_name ?? profile.email })
      .eq("id", byEmail.id);
    return { ok: true };
  }

  await admin.from("team_members").insert({
    team_id: campaign.teamId,
    profile_id: user.id,
    display_name: profile.full_name ?? profile.email,
    email: profile.email,
  });
  return { ok: true };
}

/* ── where a participant goes ───────────────────────────────────────── */

/**
 * The campaign join path for a token.
 *
 * Built here rather than interpolated at each call site so the auth `next`,
 * the onboarding return and the QR code cannot drift to three different
 * shapes of the same URL.
 */
export function campaignJoinPath(token: string): string {
  return `/wellbeing/join/${encodeURIComponent(token)}`;
}
