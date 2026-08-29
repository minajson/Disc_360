"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOnboarded } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { isPilotCapacityError, PILOT_CAPACITY_MESSAGE } from "@/lib/wellbeing/pilot";
import { logRouteDiagnostic } from "@/lib/observability/diagnostics";
import { campaignAdmissionRefusal } from "@/lib/wellbeing/admission";
import {
  computeWellbeingResult,
  WELLBEING_SCORING_METHOD,
  WELLBEING_SCORING_VERSION,
} from "@/lib/scoring/wellbeing";
import { getWellbeingPolicy, resolveInstrumentThreshold } from "@/lib/wellbeing/policy";
import {
  getActiveQuestionnaire,
  getQuestionnaireByVersion,
} from "@/lib/wellbeing/queries";
import {
  loadAuthorisedCampaignById,
  type AuthorisedCampaign,
} from "@/lib/wellbeing/campaigns";
import {
  computeDiscWellbeingResult,
  DISC_WELLBEING_SCORING_METHOD,
  DISC_WELLBEING_SCORING_VERSION,
} from "@/lib/scoring/disc360-wellbeing";
import {
  computeGhq28Result,
  GHQ28_SCORING_METHOD,
  GHQ28_SCORING_VERSION,
} from "@/lib/scoring/ghq28";
import {
  computeWho5Result,
  WHO5_SCORING_METHOD,
  WHO5_SCORING_VERSION,
} from "@/lib/scoring/who5";
import { WHO5_SUGGESTED_CUTOFF_PERCENTAGE } from "@/data/who5-items";
import {
  atOrAboveThresholdFor,
  canServeToParticipants,
  INSTRUMENTS,
  INSTRUMENT_KEYS,
  isInstrumentKey,
  type InstrumentKey,
} from "@/data/wellbeing-instruments";
import { isProductionEnvironment, isWellbeingDemoEnabled } from "@/lib/wellbeing/environment";
import { isOtherDepartment } from "@/data/wellbeing-taxonomy";
import { normalizeOrgFreeText, ORG_FREE_TEXT_MAX } from "@/lib/wellbeing/free-text";
import { buildWellbeingSnapshot } from "@/lib/wellbeing/snapshot";

/**
 * Wellbeing Pulse participant actions.
 *
 * Three rules govern this file:
 *
 *  1 · CONSENT COMES FIRST, AND COSTS NOTHING TO DECLINE. No session row
 *      exists until the participant has agreed to take part, so declining
 *      leaves no record at all — which is what the consent screen promises.
 *
 *  2 · SCORING HAPPENS HERE, FROM STORED RESPONSES. The browser never sends a
 *      score. `completeWellbeingPulse` re-reads every saved answer, runs the
 *      pure engine over it, and stamps the engine version and the threshold in
 *      force at that moment onto the row.
 *
 *  3 · NOTHING SENSITIVE IS LOGGED. No action here writes a score, an item
 *      response or an email address into a log line, an error message or an
 *      audit_logs row.
 */

/* ── starting ───────────────────────────────────────────────────────── */

const beginSchema = z.object({
  /**
   * The campaign this attempt belongs to.
   *
   * Replaces `teamId`. A team knows its instrument; only a CAMPAIGN knows
   * which questionnaire version was pinned, and the version is what a result
   * has to be able to name for ever. Null means a solo attempt, which belongs
   * to no campaign — see the branch below.
   */
  campaignId: z.uuid().nullable().optional(),
  /** Must be explicitly true. A missing checkbox is not consent. */
  consent: z.literal(true),
  /**
   * Which instrument to run. Resolved from the team where one is configured;
   * a client-supplied value is only honoured for a solo attempt, and is
   * validated against the registry either way.
   *
   * Derived from INSTRUMENT_KEYS rather than written out. It used to list
   * ["ghq12", "disc360_wellbeing_v1"] — two of the four — so a WHO-5 or GHQ-28
   * attempt failed schema validation and was reported as "Taking part requires
   * your agreement": a consent error for something that had nothing to do with
   * consent. An enum that repeats the registry silently goes stale the moment
   * an instrument is added.
   */
  instrumentKey: z.enum(INSTRUMENT_KEYS as unknown as [InstrumentKey, ...InstrumentKey[]]).optional(),
});

export interface BeginResult {
  ok: boolean;
  sessionId?: string;
  error?: string;
}

/**
 * Resumes the open pulse, or starts one after explicit consent.
 *
 * Consent is recorded on the session at creation. A resumed session already
 * carries it — the participant does not re-consent to finish something they
 * started, and the original timestamp is preserved rather than refreshed.
 */
export async function beginWellbeingPulse(input: {
  campaignId?: string | null;
  consent: boolean;
  instrumentKey?: InstrumentKey;
}): Promise<BeginResult> {
  const parsed = beginSchema.safeParse(input);
  if (!parsed.success) {
    // Consent is the only failure a participant can act on, so it is named
    // only when it is actually the problem. Reporting every schema rejection
    // as a consent failure sent a real defect — an instrument missing from the
    // enum — to whoever was debugging it, dressed as user error.
    const consentFailed = parsed.error.issues.some((issue) => issue.path[0] === "consent");
    return {
      ok: false,
      error: consentFailed
        ? "Taking part requires your agreement."
        : "This Wellbeing Pulse could not be started.",
    };
  }

  const context = await requireOnboarded();
  const { supabase, user } = context;
  const campaignId = parsed.data.campaignId ?? null;

  /*
   * ─────────────────────────────────────────────────────────────────────
   * THE CAMPAIGN DECIDES EVERYTHING. THIS IS THE POINT OF THE REFACTOR.
   *
   * This function used to take a `teamId`, ask the team for its instrument,
   * and then call `getActiveQuestionnaire()` to decide the VERSION. That last
   * step resolved by `is_active` — "whichever version is switched on right
   * now" — so which wording a participant answered was a fact about the clock,
   * not about the campaign they joined. Activate a new version mid-campaign
   * and two people in it answer different content while their results are
   * pooled as though they had not.
   *
   * A campaign pins `version_id` at creation and 00044's trigger freezes it
   * the moment anybody answers. So the campaign is loaded here, server-side,
   * from an id that was itself obtained by resolving a join token — and the
   * instrument, the version and the organisation are all DERIVED from it.
   * None of the three is taken from the client, and none is re-resolved.
   *
   * The database enforces the same rule underneath: 00047's admission trigger
   * refuses a session whose instrument or version disagrees with its campaign,
   * so this cannot drift even if a future caller forgets.
   * ─────────────────────────────────────────────────────────────────────
   */
  let campaign: AuthorisedCampaign | null = null;
  if (campaignId) {
    campaign = await loadAuthorisedCampaignById(campaignId);
    if (!campaign) return { ok: false, error: "This campaign could not be found." };
    if (!campaign.isOpen) {
      return { ok: false, error: "This campaign is no longer accepting responses." };
    }
  }

  /*
   * A SOLO attempt belongs to no campaign, and keeps its own rule.
   *
   * It is the one case where the instrument key comes from the CLIENT, which
   * is exactly why the serving gate below runs before anything else. A solo
   * attempt has no pinned version — there is no campaign to have pinned one —
   * so it uses the active version, which is the correct answer for an attempt
   * that belongs to no cohort and will be compared with nobody.
   */
  const instrumentKey: InstrumentKey | null =
    campaign?.instrumentKey ?? (campaignId ? null : (parsed.data.instrumentKey ?? null));

  if (!instrumentKey) {
    return {
      ok: false,
      error: campaignId
        ? "This campaign has not been configured with a questionnaire yet."
        : "Choose which Wellbeing Pulse to take.",
    };
  }

  /*
   * THE SERVING GATE — APPLIED TO EVERY ATTEMPT, CAMPAIGN OR SOLO.
   *
   * ───────────────────────────────────────────────────────────────────
   * THE BYPASS THIS CLOSES.
   *
   * `canServeToParticipants` was once consulted on the participant path in
   * exactly one place: `checkCampaignReadiness`, called inside `if (teamId)`.
   * A SOLO attempt has no team, so it skipped the gate entirely — and a solo
   * attempt is the one case where `instrumentKey` comes from the CLIENT. The
   * only remaining barrier was the questionnaire lookup, which asks whether
   * content EXISTS, not whether it may be SERVED. Those two answers diverge the
   * moment held content is loaded, which 00045/00046 do.
   *
   * The gate belongs HERE — before the resume lookup, so it covers an attempt
   * already in flight as well as a new one. An instrument that may not be
   * served may not be served on its second screen either.
   * ───────────────────────────────────────────────────────────────────
   */
  const serving = canServeToParticipants(instrumentKey, {
    isProduction: isProductionEnvironment(),
    demoEnabled: isWellbeingDemoEnabled(),
  });
  if (!serving.allowed) {
    return {
      ok: false,
      error: serving.reason ?? "This Wellbeing Pulse is not available yet.",
    };
  }

  // Resume, scoped to the same campaign AND the same instrument.
  let resume = supabase
    .from("wellbeing_sessions")
    .select("id")
    .eq("profile_id", user.id)
    .eq("status", "in_progress")
    .eq("instrument_key", instrumentKey);
  resume = campaign
    ? resume.eq("campaign_id", campaign.campaignId)
    : resume.is("campaign_id", null);
  const { data: existing } = await resume
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, sessionId: existing.id };

  // A campaign that cannot be completed must not be started.
  //
  // The invitation refuses first, but this is the guard that matters: a
  // participant who is already signed in can reach the start action by a
  // link, and a session begun against an unready campaign produces a form
  // with no options and an abandoned attempt in the facilitator's counts.
  if (campaign?.teamId) {
    const { checkCampaignReadiness, CAMPAIGN_NOT_READY_PARTICIPANT_MESSAGE } = await import(
      "@/lib/wellbeing/readiness"
    );
    const readiness = await checkCampaignReadiness(campaign.teamId, instrumentKey);
    if (!readiness.ready) {
      return { ok: false, error: CAMPAIGN_NOT_READY_PARTICIPANT_MESSAGE };
    }
  }

  /*
   * THE VERSION. Pinned for a campaign; active for a solo attempt.
   *
   * `getQuestionnaireByVersion` takes a version id and has no argument in
   * which "the active one" could be passed by accident — which is the whole
   * reason it exists as a separate function from `getActiveQuestionnaire`.
   */
  const questionnaire = campaign
    ? await getQuestionnaireByVersion(context, campaign.versionId)
    : await getActiveQuestionnaire(context, instrumentKey);

  if (!questionnaire) {
    return {
      ok: false,
      error:
        INSTRUMENTS[instrumentKey].licensing === "external_rights_required"
          ? "This questionnaire is not available yet — its content is awaiting licence confirmation."
          : "This Wellbeing Pulse is not available yet.",
    };
  }

  // A pinned version that belongs to another instrument is a configuration
  // fault, and scoring it would apply one instrument's engine to another's
  // items. Refused rather than reconciled.
  if (questionnaire.instrumentKey !== instrumentKey) {
    return { ok: false, error: "This Wellbeing Pulse is not available yet." };
  }

  /*
   * The organisation, resolved server-side and never from the client.
   *
   * For a campaign it is the campaign's own organisation — one lookup, and
   * authoritative. For a solo attempt it is the organisation the participant
   * already belongs to through a team membership; without it a solo result
   * carries no organisation, which both empties the Department / Function list
   * and leaves the result out of every aggregate its organisation may count.
   */
  let organizationId: string | null = campaign?.organizationId ?? null;
  if (!campaign) {
    const { data: membership } = await supabase
      .from("team_members")
      .select("teams (organization_id)")
      .eq("profile_id", user.id)
      .limit(1)
      .maybeSingle();
    const team = Array.isArray(membership?.teams) ? membership?.teams[0] : membership?.teams;
    organizationId = (team as { organization_id: string } | null)?.organization_id ?? null;
  }

  const { data: session, error } = await supabase
    .from("wellbeing_sessions")
    .insert({
      profile_id: user.id,
      // Straight from the campaign's pin. The database re-checks that these
      // two agree with the campaign — see 00047.
      version_id: questionnaire.versionId,
      instrument_key: instrumentKey,
      campaign_id: campaign?.campaignId ?? null,
      // The roster the campaign counts participation against, so every
      // aggregate, cohort and wave keeps working unchanged.
      team_id: campaign?.teamId ?? null,
      organization_id: organizationId,
      consent_given: true,
      consent_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  // Capacity and lifecycle are refused by the DATABASE, not by this action —
  // two participants racing for the last place both pass any check made out
  // here. 00047's trigger locks the campaign row before counting, so the final
  // place is taken exactly once. What is left here is turning that refusal
  // into something a participant can read.
  if (error) {
    const refusal = campaignAdmissionRefusal(error);
    if (refusal) return { ok: false, error: refusal };
    if (isPilotCapacityError(error)) return { ok: false, error: PILOT_CAPACITY_MESSAGE };
  }

  if (error || !session) return { ok: false, error: "Could not start your Wellbeing Pulse." };
  return { ok: true, sessionId: session.id };
}

/* ── context step ───────────────────────────────────────────────────── */

const contextSchema = z
  .object({
    sessionId: z.uuid(),
    departmentId: z.uuid().nullable().optional(),
    departmentName: z.string().trim().min(1).max(120),
    /**
     * Sub-unit / Team — organisational context, never an assessment team.
     *
     * OPTIONAL, and typed rather than chosen. A working unit is renamed and
     * reorganised far more often than a governed catalogue can keep up with,
     * so requiring a catalogue entry before anybody may answer made the
     * questionnaire hostage to an administrative task — and, with no write
     * path for that catalogue, unopenable.
     *
     * The earlier reasoning — that an optional dimension produces cohorts with
     * holes in them — still holds, and is answered where it belongs: a blank
     * sub-unit is `null`, never an empty string, so it forms no cohort at all
     * rather than a phantom one, and typed values are case-folded into a
     * single group before they meet the suppression floor.
     */
    subUnitId: z.uuid().nullable().optional(),
    subUnitName: z.string().max(ORG_FREE_TEXT_MAX).nullable().optional(),
    workLocation: z.enum(["field_based", "office_based"]),
    officeLocationId: z.uuid().nullable().optional(),
    officeLocationName: z.string().trim().max(120).nullable().optional(),
    jobTitle: z.string().trim().max(160).nullable().optional(),
    /** Kept for operational reporting. Never used to decide anything. */
    selfReportedFirstTime: z.boolean().nullable().optional(),
    emailOptIn: z.boolean().default(false),
    contactEmail: z.string().trim().max(254).nullable().optional(),
  })
  .refine(
    (value) =>
      value.workLocation === "field_based" ||
      (value.officeLocationName != null && value.officeLocationName.length > 0),
    { message: "Office Location is required for office-based work", path: ["officeLocationName"] },
  );

export interface ContextResult {
  ok: boolean;
  error?: string;
}

/**
 * Saves the operational context for this attempt.
 *
 * Field-based work stores no office location at all — not an empty string, not
 * "N/A". The participant is never asked for one, the column is null, and the
 * database refuses the row if it is not.
 *
 * `selfReportedFirstTime` is stored and then ignored by every code path that
 * matters. Whether previous results exist is answered by the database, so a
 * participant who says "yes, first time" while holding three prior pulses
 * keeps all three.
 */
export async function saveWellbeingContext(
  input: z.infer<typeof contextSchema>,
): Promise<ContextResult> {
  const parsed = contextSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please complete every field." };
  }
  const { supabase, user } = await requireOnboarded();
  const value = parsed.data;

  const officeBased = value.workLocation === "office_based";

  // Blank, whitespace, or invisible characters only all collapse to null —
  // one representation of "not answered", so it cannot become a cohort of its
  // own. Case is preserved for display; case-folding happens at grouping time.
  const subUnitName = normalizeOrgFreeText(value.subUnitName);

  // A typed department is only linked to a catalogue row when it IS one. When
  // the participant chose "Other" and typed their own, the id is dropped: a
  // stale id would make a free-text answer look governed, and would resolve to
  // the wrong name if that catalogue row were later renamed.
  const departmentName = normalizeOrgFreeText(value.departmentName);
  if (departmentName === null) {
    return { ok: false, error: "Please enter your Department / Function." };
  }

  // "Other" is the sentinel that opens the free-text box, never an answer in
  // itself. Enforced here rather than only in the form, because the form's
  // check is a convenience and this is the control: a request that arrives
  // with the sentinel intact is one where the box was left empty, and storing
  // it would put every such participant into one meaningless "Other" cohort —
  // the exact loss of reporting value the free-text box exists to avoid.
  if (isOtherDepartment(departmentName)) {
    return { ok: false, error: "Please enter your Department / Function." };
  }

  const departmentIsCatalogued = value.departmentId != null;

  const contactEmail = value.contactEmail?.trim() || null;
  const emailLooksValid = contactEmail ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail) : true;
  if (value.emailOptIn && contactEmail && !emailLooksValid) {
    return { ok: false, error: "Enter a valid email address, or leave it blank." };
  }

  const { error } = await supabase
    .from("wellbeing_sessions")
    .update({
      department_id: departmentIsCatalogued ? value.departmentId : null,
      department_name: departmentName,
      // Only ever set when the participant's text matches a catalogue row the
      // client resolved. Free text carries no id, and that is the honest
      // record: nothing governs it.
      sub_unit_id: subUnitName === null ? null : (value.subUnitId ?? null),
      // The name is what the result reports under forever. A sub-unit renamed
      // next year must not restate what somebody said about themselves this
      // year — which is why the result snapshots text, not this id.
      sub_unit_name: subUnitName,
      work_location: value.workLocation,
      office_location_id: officeBased ? (value.officeLocationId ?? null) : null,
      office_location_name: officeBased ? (value.officeLocationName ?? null) : null,
      job_title: value.jobTitle?.trim() || null,
      self_reported_first_time: value.selfReportedFirstTime ?? null,
      email_opt_in: value.emailOptIn,
      contact_email: contactEmail,
    })
    .eq("id", value.sessionId)
    .eq("profile_id", user.id)
    .eq("status", "in_progress");

  if (error) return { ok: false, error: "Could not save your details." };
  return { ok: true };
}

/* ── answering ──────────────────────────────────────────────────────── */

/**
 * The shape of an answer, bounded STRUCTURALLY.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THESE NUMBERS ARE NOT AN INSTRUMENT'S.
 *
 * They used to be. This schema read
 *
 *     position:  z.number().int().min(0).max(3),
 *     itemIndex: z.number().int().min(0).max(11),
 *
 * which is GHQ-12 exactly: four response options and twelve items. Every other
 * instrument on the platform exceeds one bound or the other, so the autosave
 * rejected legitimate answers as "Invalid answer":
 *
 *   · WHO-5 offers six options (0–5), so its top two answers could not be
 *     recorded at all — a participant reporting the BEST wellbeing was the one
 *     who could not proceed.
 *   · DISC360 Wellbeing Pulse V1 — the instrument that is ACTIVE and shipping —
 *     offers five (0–4), so its top answer was rejected on every item.
 *   · GHQ-28 has 28 items, so nothing past the twelfth could be answered.
 *
 * The bounds below are the DATABASE COLUMNS' own limits
 * (wellbeing_responses.option_position is 0–9, wellbeing_items.position is
 * 0–49). They exist to reject nonsense cheaply before touching the database,
 * and they deliberately encode nothing about any instrument.
 *
 * The AUTHORITATIVE check happens below, against the item's own options and its
 * version's own item count — because "which answers exist" is a fact about the
 * item, not a number to be copied from a registry and kept in step by hand.
 * ─────────────────────────────────────────────────────────────────────
 */
const answerSchema = z.object({
  sessionId: z.uuid(),
  itemId: z.uuid(),
  position: z.number().int().min(0).max(9),
  itemIndex: z.number().int().min(0).max(49),
});

export interface SaveAnswerResult {
  ok: boolean;
  answeredCount: number;
  error?: string;
}

/** Autosaves one answer and advances the resume position. */
export async function saveWellbeingResponse(
  input: z.infer<typeof answerSchema>,
): Promise<SaveAnswerResult> {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, answeredCount: 0, error: "Invalid answer" };
  const { supabase, user } = await requireOnboarded();
  const { sessionId, itemId, position, itemIndex } = parsed.data;

  const { data: session } = await supabase
    .from("wellbeing_sessions")
    .select("id, profile_id, status, current_index, version_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.profile_id !== user.id) {
    return { ok: false, answeredCount: 0, error: "Session not found" };
  }
  if (session.status !== "in_progress") {
    return { ok: false, answeredCount: 0, error: "This pulse is already complete." };
  }

  // The item must belong to the version this session is running, and it is
  // fetched WITH the two facts that decide whether this answer is valid at all:
  // the options it actually offers, and how many items its version has.
  const { data: item } = await supabase
    .from("wellbeing_items")
    .select("id, version_id, wellbeing_versions(item_count), wellbeing_item_options(position)")
    .eq("id", itemId)
    .maybeSingle();
  if (!item || item.version_id !== session.version_id) {
    return { ok: false, answeredCount: 0, error: "Question not found" };
  }

  /*
   * The answer must be one THIS ITEM OFFERS.
   *
   * Checked against the item's own options rather than against a per-instrument
   * range, so it is right for every instrument including ones not yet written,
   * and cannot drift from the questionnaire the participant is actually being
   * shown. A range would have to be maintained in step with the content; this
   * cannot disagree with it.
   */
  const offered = (item.wellbeing_item_options ?? []) as { position: number }[];
  if (!offered.some((option) => option.position === position)) {
    return { ok: false, answeredCount: 0, error: "Invalid answer" };
  }

  // The resume position must be inside the questionnaire being taken. Read from
  // the version rather than assumed — GHQ-12's twelve is not GHQ-28's 28.
  // PostgREST returns a to-one embed as an object; the generated types model it
  // as an array. Both are read, so neither shape silently yields 0 — which
  // would reject every answer.
  const versionEmbed = item.wellbeing_versions as
    | { item_count: number }
    | { item_count: number }[]
    | null;
  const itemCount =
    (Array.isArray(versionEmbed) ? versionEmbed[0]?.item_count : versionEmbed?.item_count) ?? 0;
  if (itemIndex >= itemCount) {
    return { ok: false, answeredCount: 0, error: "Invalid answer" };
  }

  const { error } = await supabase
    .from("wellbeing_responses")
    .upsert(
      { session_id: sessionId, item_id: itemId, option_position: position },
      { onConflict: "session_id,item_id" },
    );
  if (error) return { ok: false, answeredCount: 0, error: "Could not save your answer." };

  if (itemIndex + 1 > (session.current_index ?? 0)) {
    await supabase
      .from("wellbeing_sessions")
      .update({ current_index: itemIndex + 1 })
      .eq("id", sessionId)
      .eq("profile_id", user.id);
  }

  const { count } = await supabase
    .from("wellbeing_responses")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  return { ok: true, answeredCount: count ?? 0 };
}

/* ── completion ─────────────────────────────────────────────────────── */

export interface CompleteResult {
  ok: boolean;
  resultId?: string;
  error?: string;
}

/**
 * Scores the pulse and writes the immutable result.
 *
 * Everything that makes the row interpretable later is stamped on now: the
 * engine version, the scoring method, the questionnaire version, the threshold
 * in force at this moment, and the participant's context as they gave it. A
 * later policy change or a later transfer to another department cannot rewrite
 * any of it.
 */
export async function completeWellbeingPulse(sessionId: string): Promise<CompleteResult> {
  if (!z.uuid().safeParse(sessionId).success) return { ok: false, error: "Invalid session" };
  const context = await requireOnboarded();
  const { supabase, user } = context;

  const { data: session } = await supabase
    .from("wellbeing_sessions")
    .select(
      "id, profile_id, status, version_id, instrument_key, campaign_id, team_id, organization_id, consent_given, consent_at, department_name, sub_unit_name, work_location, office_location_name, job_title",
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (!session || session.profile_id !== user.id) return { ok: false, error: "Session not found" };
  if (!session.consent_given) return { ok: false, error: "Consent is required." };

  // Already finished — return the existing result rather than scoring twice.
  if (session.status === "completed") {
    const { data: existing } = await supabase
      .from("wellbeing_results")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (existing) return { ok: true, resultId: existing.id };
  }

  if (!session.department_name || !session.work_location) {
    return { ok: false, error: "Please complete your details before finishing." };
  }

  const [{ data: items }, { data: responses }] = await Promise.all([
    supabase
      .from("wellbeing_items")
      .select("id, external_id, position")
      .eq("version_id", session.version_id)
      .order("position"),
    supabase
      .from("wellbeing_responses")
      .select("item_id, option_position")
      .eq("session_id", sessionId),
  ]);

  const orderedItems = (items ?? []).slice().sort((a, b) => a.position - b.position);
  const externalById = new Map(orderedItems.map((item) => [item.id, item.external_id as string]));
  const itemOrder = orderedItems.map((item) => item.external_id as string);

  const answers = (responses ?? [])
    .map((response) => {
      const externalId = externalById.get(response.item_id as string);
      return externalId
        ? { itemId: externalId, position: response.option_position as number }
        : null;
    })
    .filter((answer): answer is { itemId: string; position: number } => answer !== null);

  if (answers.length !== itemOrder.length) {
    return { ok: false, error: "Please answer every question before finishing." };
  }

  const { data: version } = await supabase
    .from("wellbeing_versions")
    .select("version")
    .eq("id", session.version_id)
    .maybeSingle();

  const instrumentKey = session.instrument_key as string;
  if (!isInstrumentKey(instrumentKey)) {
    return { ok: false, error: "This pulse is not linked to a known questionnaire." };
  }

  const policy = await getWellbeingPolicy(
    supabase,
    (session.organization_id as string | null) ?? null,
  );

  /*
   * Scoring is dispatched to the instrument's OWN engine.
   *
   * The two branches share no arithmetic: GHQ produces a 0–12 count against a
   * configured threshold, DISC360 Wellbeing produces a 0–48 raw, a 0–100 index
   * and six dimensions with no threshold at all. Each branch writes only the
   * columns its instrument defines, and the database refuses the rest — a
   * threshold on a DISC360 row is rejected by
   * wellbeing_results_threshold_matches_instrument.
   */
  let scoredRow: {
    total_score: number;
    index_score: number | null;
    likert_score: number | null;
    item_positions: number[];
    scoring_method: string;
    scoring_version: string;
    threshold_at_completion: number | null;
    at_or_above_threshold: boolean | null;
  };
  let dimensionRows: { dimension_key: string; raw_score: number; index_score: number }[] = [];

  try {
    if (instrumentKey === "ghq12") {
      const scored = computeWellbeingResult({
        answers,
        itemOrder,
        // The governed threshold FOR THIS INSTRUMENT. Reading
        // `policy.screeningThreshold` directly is what handed GHQ-12's cut-off
        // to GHQ-28 below.
        threshold: resolveInstrumentThreshold(policy, "ghq12"),
      });
      scoredRow = {
        total_score: scored.totalScore,
        index_score: null,
        likert_score: scored.likertScore,
        item_positions: scored.itemPositions,
        scoring_method: WELLBEING_SCORING_METHOD,
        scoring_version: WELLBEING_SCORING_VERSION,
        threshold_at_completion: scored.thresholdAtCompletion,
        at_or_above_threshold: scored.atOrAboveThreshold,
      };
    } else if (instrumentKey === "ghq28") {
      const scored = computeGhq28Result({
        answers,
        itemOrder,
        // GHQ-28's own 4/5 split unless a policy names GHQ-28's scoring
        // method. It used to receive GHQ-12's 3/4 split, so results were
        // classified one point early — while the analytics surface had already
        // been patched to DISPLAY 5.
        threshold: resolveInstrumentThreshold(policy, "ghq28"),
      });
      scoredRow = {
        total_score: scored.totalScore,
        // GHQ normalises nothing — there is no index, and inventing one by
        // dividing by 28 would create a 0–100 figure that looks comparable to
        // WHO-5's and is not.
        index_score: null,
        likert_score: scored.likertScore,
        item_positions: scored.itemPositions,
        scoring_method: GHQ28_SCORING_METHOD,
        scoring_version: GHQ28_SCORING_VERSION,
        threshold_at_completion: scored.thresholdAtCompletion,
        at_or_above_threshold: scored.atOrAboveThreshold,
      };
      dimensionRows = scored.subscales.map((subscale) => ({
        dimension_key: `ghq28_${subscale.key}`,
        raw_score: subscale.score,
        // The subscale's own bimodal count, NOT a normalised index. A subscale
        // is a profile dimension and carries no threshold of its own.
        index_score: subscale.score,
      }));
    } else if (instrumentKey === "who5") {
      const scored = computeWho5Result({ answers, itemOrder });
      scoredRow = {
        // The RAW 0–25 total, matching every other instrument's `total_score`.
        total_score: scored.rawScore,
        // The published percentage, raw × 4. WHO-5's own transform, not the
        // (raw/max)*100 the DISC360 index uses — they agree at the endpoints
        // and are different rules, and adopting one for the other would be
        // taking someone else's scale by coincidence.
        index_score: scored.transformedScore,
        likert_score: null,
        item_positions: scored.itemPositions,
        scoring_method: WHO5_SCORING_METHOD,
        scoring_version: WHO5_SCORING_VERSION,
        // The cut-off WHO's own publication documents, recorded AT COMPLETION
        // so a historical result stays interpretable if the figure is ever
        // revised. It is instrument documentation, not a DISC360 judgement.
        threshold_at_completion: WHO5_SUGGESTED_CUTOFF_PERCENTAGE,
        // WHO-5 counts UPWARD toward wellbeing, so at-or-above its cut-off is
        // the unremarkable side — the exact opposite of what this flag means
        // for GHQ. Nothing may read it without knowing the instrument.
        at_or_above_threshold: atOrAboveThresholdFor(
          "who5",
          { totalScore: scored.rawScore, indexScore: scored.transformedScore },
          WHO5_SUGGESTED_CUTOFF_PERCENTAGE,
        ),
      };
    } else if (instrumentKey === "disc360_wellbeing_v1") {
      const scored = computeDiscWellbeingResult({ answers, itemOrder });
      scoredRow = {
        total_score: scored.rawScore,
        index_score: scored.wellbeingIndex,
        likert_score: null,
        item_positions: scored.itemPositions,
        scoring_method: DISC_WELLBEING_SCORING_METHOD,
        scoring_version: DISC_WELLBEING_SCORING_VERSION,
        // V1 has no threshold, deliberately — it is not validated, so it does
        // not grade anyone.
        threshold_at_completion: null,
        at_or_above_threshold: null,
      };
      dimensionRows = scored.dimensions.map((dimension) => ({
        dimension_key: dimension.key,
        raw_score: dimension.raw,
        index_score: dimension.index,
      }));
    } else {
      // Exhaustive by construction rather than by a default branch.
      //
      // This used to be `else { computeDiscWellbeingResult(...) }`, which meant
      // every instrument that was not GHQ-12 was scored by the DISC360 engine —
      // WHO-5 and GHQ-28 included. It failed rather than mis-scored, because
      // the engines reject a wrong item count, but "scored by the wrong
      // instrument" must not be reachable at all. A new instrument now has to
      // be handled here or it cannot be completed.
      instrumentKey satisfies never;
      return {
        ok: false,
        error: "We could not score this pulse. Please check your answers.",
      };
    }
  } catch {
    // Both engines reject incomplete or malformed sets rather than returning a
    // partial score. Surface that as a form problem, never as a silent zero.
    return { ok: false, error: "We could not score this pulse. Please check your answers." };
  }

  /*
   * The flag, re-derived from the registry and compared against what the
   * engine produced.
   *
   * ───────────────────────────────────────────────────────────────────
   * WHY A CHECK HERE, WHEN THE DATABASE ALSO CHECKS.
   *
   * They are the SAME RULE written twice — once in SQL because a CHECK cannot
   * read the registry, once here because the engines each compute their own
   * flag. Two copies of a rule drift, and this particular rule drifting is how
   * WHO-5's cut-off came to be compared against a scale it does not live on.
   *
   * So the copies are reconciled before the insert rather than after: if the
   * engine's flag and the registry's disagree, nothing is stored. The
   * alternative is a constraint violation surfacing as "could not save", which
   * is exactly how this defect presented and exactly what made it look like an
   * application fault rather than a scoring one.
   * ───────────────────────────────────────────────────────────────────
   */
  const expectedFlag = atOrAboveThresholdFor(
    instrumentKey,
    { totalScore: scoredRow.total_score, indexScore: scoredRow.index_score },
    scoredRow.threshold_at_completion,
  );
  if (expectedFlag !== scoredRow.at_or_above_threshold) {
    return { ok: false, error: "We could not score this pulse. Please check your answers." };
  }

  const snapshot = await buildWellbeingSnapshot({
    profileId: user.id,
    teamId: (session.team_id as string | null) ?? null,
    departmentName: session.department_name as string,
    subUnitName: (session.sub_unit_name as string | null) ?? null,
    workLocation: session.work_location as "field_based" | "office_based",
    officeLocationName: (session.office_location_name as string | null) ?? null,
    jobTitle: (session.job_title as string | null) ?? null,
  });

  const { data: result, error } = await supabase
    .from("wellbeing_results")
    .insert({
      session_id: sessionId,
      profile_id: user.id,
      instrument_key: instrumentKey,
      questionnaire_version: (version?.version as number | null) ?? 1,
      version_id: session.version_id,
      /*
       * THE CAMPAIGN TRAVELS WITH THE RESULT.
       *
       * ───────────────────────────────────────────────────────────────
       * Copied from the SESSION, never re-derived. A result must be able to
       * name for ever which campaign it was collected in, on which
       * instrument, against which questionnaire version — and all three have
       * to be the ones the participant actually answered, not the ones that
       * happen to be current when the row is written.
       *
       * Omitting this is not a cosmetic gap. 00047's provenance trigger
       * refuses a result whose campaign disagrees with its session's, so a
       * missing `campaign_id` made every campaign-backed completion fail at
       * the last click with "Could not save your Wellbeing Pulse" — which is
       * how this omission was found, by the trigger written to catch exactly
       * it.
       * ───────────────────────────────────────────────────────────────
       */
      campaign_id: (session.campaign_id as string | null) ?? null,
      completed_at: new Date().toISOString(),
      ...scoredRow,
      ...snapshot,
    })
    .select("id")
    .single();

  if (error || !result) return { ok: false, error: "Could not save your Wellbeing Pulse." };

  // Dimension scores are part of the result, not a decoration on it. If they
  // fail to write the result is incomplete, so the attempt is not marked
  // complete and the participant can retry rather than being left with a
  // headline index and six empty bars.
  if (dimensionRows.length > 0) {
    const { error: dimensionError } = await supabase
      .from("wellbeing_result_dimensions")
      .insert(dimensionRows.map((row) => ({ ...row, result_id: result.id })));
    if (dimensionError) {
      return { ok: false, error: "Could not save your Wellbeing Pulse." };
    }
  }

  await supabase
    .from("wellbeing_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("profile_id", user.id);

  return { ok: true, resultId: result.id };
}

/** Navigates to the questionnaire, creating or resuming the session. */
export async function startWellbeingPulseAction(formData: FormData): Promise<void> {
  // The CAMPAIGN, not a team. A team id from a form could name any team the
  // participant is on; a campaign id is checked against a campaign that must
  // be open, and every consequential fact — instrument, version, organisation
  // — is then read from the campaign rather than from this form.
  const campaignId = (formData.get("campaign_id") as string | null) || null;
  const consent = formData.get("consent") === "on" || formData.get("consent") === "true";
  if (!consent) redirect("/wellbeing/declined");

  // Honoured only for a SOLO attempt — `beginWellbeingPulse` ignores it
  // entirely once a campaign is named.
  const requested = formData.get("instrument_key");
  const instrumentKey =
    typeof requested === "string" && isInstrumentKey(requested) ? requested : undefined;

  const outcome = await beginWellbeingPulse({ campaignId, consent: true, instrumentKey });
  if (!outcome.ok || !outcome.sessionId) {
    /*
     * The participant sees a generic page; the SERVER records why.
     *
     * `beginWellbeingPulse` distinguishes a dozen refusals — an unknown
     * campaign, a closed one, a full one, an unservable instrument, missing
     * content, a version that disagrees with its campaign — and every one of
     * them arrived here as the same `?unavailable=1`. That is right for the
     * participant, who can act on none of them, and useless for anybody
     * diagnosing a campaign that will not open: the reason was computed and
     * then discarded.
     *
     * So it is logged, server-side, where the campaign id is already known and
     * no participant can read it. Nothing about the questionnaire or the
     * person is recorded — only which rule refused.
     */
    logRouteDiagnostic({
      route: "wellbeing:start",
      step: "beginWellbeingPulse",
      message: outcome.error ?? "unknown refusal",
      teamId: campaignId ?? undefined,
    });
    redirect("/wellbeing?unavailable=1");
  }
  redirect(`/wellbeing/assessment/${outcome.sessionId}`);
}

/* ── administrative: install the default taxonomy ───────────────────── */

/**
 * Installs the default Department / Function and Office Location catalogue
 * into an organisation.
 *
 * Governance-only, and additive: an entry that already exists is left alone,
 * so running it twice does not duplicate a list or revert a customised name.
 */
export async function installWellbeingTaxonomy(
  organizationId: string,
): Promise<{ ok: boolean; message: string }> {
  if (!z.uuid().safeParse(organizationId).success) {
    return { ok: false, message: "Invalid organisation." };
  }
  const { requireWellbeingGovernance } = await import("@/lib/wellbeing/access");
  const { DEFAULT_WELLBEING_DEPARTMENTS, DEFAULT_WELLBEING_OFFICE_LOCATIONS } = await import(
    "@/data/wellbeing-taxonomy"
  );

  let access;
  try {
    access = await requireWellbeingGovernance(organizationId);
  } catch {
    return { ok: false, message: "You do not hold Wellbeing Pulse governance here." };
  }

  // Service role after the governance check: the insert is a bulk upsert the
  // governance policy permits row by row, and doing it in one statement avoids
  // 30 round trips through RLS for an idempotent seed.
  const admin = createSupabaseAdminClient();

  // Read what is already there, then insert only what is missing.
  //
  // Deliberately not an upsert: uniqueness on these tables is a
  // case-insensitive EXPRESSION index (lower(name)), which ON CONFLICT cannot
  // target by column name. Comparing case-insensitively here matches the index
  // exactly, so installing twice cannot produce "Legal" alongside "legal".
  const [{ data: existingDepartments }, { data: existingOffices }] = await Promise.all([
    admin.from("wellbeing_departments").select("name").eq("organization_id", organizationId),
    admin.from("wellbeing_office_locations").select("name").eq("organization_id", organizationId),
  ]);

  const heldDepartments = new Set(
    (existingDepartments ?? []).map((row) => (row.name as string).toLowerCase()),
  );
  const heldOffices = new Set(
    (existingOffices ?? []).map((row) => (row.name as string).toLowerCase()),
  );

  const departments = DEFAULT_WELLBEING_DEPARTMENTS.map((name, position) => ({
    organization_id: organizationId,
    name,
    position,
  })).filter((row) => !heldDepartments.has(row.name.toLowerCase()));

  const offices = DEFAULT_WELLBEING_OFFICE_LOCATIONS.map((name, position) => ({
    organization_id: organizationId,
    name,
    position,
  })).filter((row) => !heldOffices.has(row.name.toLowerCase()));

  const [departmentResult, officeResult] = await Promise.all([
    departments.length
      ? admin.from("wellbeing_departments").insert(departments)
      : Promise.resolve({ error: null }),
    offices.length
      ? admin.from("wellbeing_office_locations").insert(offices)
      : Promise.resolve({ error: null }),
  ]);

  if (departmentResult.error || officeResult.error) {
    return { ok: false, message: "Could not install the default taxonomy." };
  }

  if (!departments.length && !offices.length) {
    return { ok: true, message: "The catalogue is already installed — nothing changed." };
  }

  await admin.from("audit_logs").insert({
    actor_id: access.user.id,
    action: "wellbeing.taxonomy_installed",
    entity_type: "organization",
    entity_id: organizationId,
    metadata: { departments: departments.length, office_locations: offices.length },
  });

  return {
    ok: true,
    message: `Installed ${departments.length} Department / Function entries and ${offices.length} office locations.`,
  };
}

/* ── opt-in report delivery ─────────────────────────────────────────── */

export interface WellbeingEmailResult {
  ok: boolean;
  /** Distinguishes "we tried and it failed" from "we never dispatched it". */
  status: "sent" | "not_delivered" | "unauthorized" | "invalid_email";
  message: string;
  maskedRecipient?: string;
}

/**
 * Emails the participant their own Wellbeing Pulse report — only when asked.
 *
 * Never automatic. A stored address is not consent: this action runs solely in
 * response to the participant pressing the button, and there is no code path
 * anywhere that sends a wellbeing report as a side effect of completing one.
 *
 * The recipient is resolved server-side from the caller's own profile, with a
 * client-supplied address consulted only when the account genuinely has none.
 * That keeps this from becoming a way to have the platform mail an arbitrary
 * address a wellbeing report on request.
 *
 * Every attempt is recorded — requested first, then the outcome. Success is
 * reported only when the provider accepted the message; a send that was merely
 * logged says so, because telling someone their private report is on its way
 * when it is not is the one failure this flow must never have.
 *
 * The message carries a link, not the score. §24: nothing sensitive in a
 * subject line, a URL or a log.
 */
export async function emailMyWellbeingReport(
  resultId: string,
): Promise<WellbeingEmailResult> {
  if (!z.uuid().safeParse(resultId).success) {
    return { ok: false, status: "unauthorized", message: "Report not found." };
  }

  const { loadOwnWellbeingReport } = await import("@/lib/wellbeing/report");
  const { sendWellbeingReportReady } = await import("@/lib/email/notifications");
  const { isDeliverableEmail, maskEmail } = await import("@/lib/reports/identity");

  const report = await loadOwnWellbeingReport(resultId);
  if (!report) return { ok: false, status: "unauthorized", message: "Report not found." };

  const { context } = report;

  // The verified account address is the destination. An address typed into the
  // form is only consulted when the account somehow has none — a wellbeing
  // report should not be deliverable to an unverified address on the strength
  // of a form field, and the message carries an authenticated link rather than
  // the report itself precisely so this stays a narrow question.
  let recipient = report.accountEmail?.trim() ?? "";
  if (!isDeliverableEmail(recipient)) {
    const sessionId = await resolveSessionId(context, resultId);
    if (sessionId) {
      const { data: session } = await context.supabase
        .from("wellbeing_sessions")
        .select("contact_email")
        .eq("id", sessionId)
        .maybeSingle();
      recipient = (session?.contact_email as string | null)?.trim() ?? "";
    }
  }
  if (!isDeliverableEmail(recipient)) {
    return {
      ok: false,
      status: "invalid_email",
      message: "We do not have a valid email address to send your report to.",
    };
  }

  const masked = maskEmail(recipient);

  // Service role: wellbeing_report_deliveries has no INSERT policy, and the
  // request must be recorded before the attempt so a crash mid-send leaves
  // evidence that the participant asked.
  const admin = createSupabaseAdminClient();
  const { data: delivery } = await admin
    .from("wellbeing_report_deliveries")
    .insert({
      result_id: resultId,
      profile_id: context.user.id,
      status: "requested",
      masked_recipient: masked,
    })
    .select("id")
    .single();

  const outcome = await sendWellbeingReportReady({
    to: recipient,
    profileId: context.user.id,
    firstName: context.profile.preferred_name?.trim() || context.profile.full_name.split(" ")[0] || "",
    reportPath: report.webPath,
  });

  const resolvedStatus =
    outcome.status === "sent" ? "sent" : outcome.status === "failed" ? "failed" : "not_delivered";

  if (delivery) {
    await admin
      .from("wellbeing_report_deliveries")
      .update({
        status: resolvedStatus,
        // The reason a send did not dispatch — never a score, never an item.
        error: outcome.status === "sent" ? null : (outcome.error ?? outcome.status),
        resolved_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);
  }

  if (outcome.status === "sent") {
    await context.supabase.from("report_exports").insert({
      profile_id: context.user.id,
      wellbeing_result_id: resultId,
      kind: "wellbeing_report",
    });
    return {
      ok: true,
      status: "sent",
      message: "Your report is on its way.",
      maskedRecipient: masked,
    };
  }

  return {
    ok: false,
    status: "not_delivered",
    message: "We could not send your report just now. Nothing was sent, and you can still download it here.",
    maskedRecipient: masked,
  };
}

/** The session behind one of the caller's own results. */
async function resolveSessionId(
  context: Awaited<ReturnType<typeof requireOnboarded>>,
  resultId: string,
): Promise<string | null> {
  const { data } = await context.supabase
    .from("wellbeing_results")
    .select("session_id")
    .eq("id", resultId)
    .maybeSingle();
  return (data?.session_id as string | null) ?? null;
}

/** Records a downloaded Wellbeing Pulse PDF. */
export async function logWellbeingExport(resultId: string): Promise<void> {
  if (!z.uuid().safeParse(resultId).success) return;
  const { supabase, user } = await requireOnboarded();
  await supabase.from("report_exports").insert({
    profile_id: user.id,
    wellbeing_result_id: resultId,
    kind: "wellbeing_report",
  });
}
