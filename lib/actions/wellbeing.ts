"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOnboarded } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { isPilotCapacityError, PILOT_CAPACITY_MESSAGE } from "@/lib/wellbeing/pilot";
import {
  computeWellbeingResult,
  WELLBEING_SCORING_METHOD,
  WELLBEING_SCORING_VERSION,
} from "@/lib/scoring/wellbeing";
import { getWellbeingPolicy } from "@/lib/wellbeing/policy";
import { getActiveQuestionnaire, getTeamInstrument } from "@/lib/wellbeing/queries";
import {
  computeDiscWellbeingResult,
  DISC_WELLBEING_SCORING_METHOD,
  DISC_WELLBEING_SCORING_VERSION,
} from "@/lib/scoring/disc360-wellbeing";
import { INSTRUMENTS, isInstrumentKey, type InstrumentKey } from "@/data/wellbeing-instruments";
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
  teamId: z.uuid().nullable().optional(),
  /** Must be explicitly true. A missing checkbox is not consent. */
  consent: z.literal(true),
  /**
   * Which instrument to run. Resolved from the team where one is configured;
   * a client-supplied value is only honoured for a solo attempt, and is
   * validated against the registry either way.
   */
  instrumentKey: z.enum(["ghq12", "disc360_wellbeing_v1"]).optional(),
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
  teamId?: string | null;
  consent: boolean;
  instrumentKey?: InstrumentKey;
}): Promise<BeginResult> {
  const parsed = beginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Taking part requires your agreement." };
  }

  const context = await requireOnboarded();
  const { supabase, user } = context;
  const teamId = parsed.data.teamId ?? null;

  // The team decides which instrument its session runs. A client-supplied key
  // is honoured only for a solo attempt — otherwise a participant could opt
  // themselves into a different questionnaire than the one their facilitator
  // configured, and their result would land in the wrong analytics.
  const teamInstrument = teamId ? await getTeamInstrument(context, teamId) : null;
  const instrumentKey: InstrumentKey | null =
    teamInstrument ?? (teamId ? null : (parsed.data.instrumentKey ?? null));

  if (!instrumentKey) {
    return {
      ok: false,
      error: teamId
        ? "This session has not been configured with a questionnaire yet."
        : "Choose which Wellbeing Pulse to take.",
    };
  }

  // Resume, scoped to the same context AND the same instrument.
  let resume = supabase
    .from("wellbeing_sessions")
    .select("id")
    .eq("profile_id", user.id)
    .eq("status", "in_progress")
    .eq("instrument_key", instrumentKey);
  resume = teamId ? resume.eq("team_id", teamId) : resume.is("team_id", null);
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
  if (teamId) {
    const { checkCampaignReadiness, CAMPAIGN_NOT_READY_PARTICIPANT_MESSAGE } = await import(
      "@/lib/wellbeing/readiness"
    );
    const readiness = await checkCampaignReadiness(teamId, instrumentKey);
    if (!readiness.ready) {
      return { ok: false, error: CAMPAIGN_NOT_READY_PARTICIPANT_MESSAGE };
    }
  }

  const questionnaire = await getActiveQuestionnaire(context, instrumentKey);
  if (!questionnaire) {
    return {
      ok: false,
      error:
        INSTRUMENTS[instrumentKey].licensing === "external_rights_required"
          ? "This questionnaire is not available yet — its content is awaiting licence confirmation."
          : "This Wellbeing Pulse is not available yet.",
    };
  }

  // The organisation is resolved server-side, never from the client.
  //
  // With a team, it is that team's organisation. Without one, it is the
  // organisation the participant already belongs to through a team membership
  // — otherwise a solo attempt would carry no organisation, which both empties
  // the Department / Function list and leaves the result out of every
  // aggregate its organisation is entitled to count.
  let organizationId: string | null = null;
  if (teamId) {
    const { data: team } = await supabase
      .from("teams")
      .select("organization_id")
      .eq("id", teamId)
      .maybeSingle();
    organizationId = (team?.organization_id as string | null) ?? null;
  } else {
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
      version_id: questionnaire.versionId,
      instrument_key: instrumentKey,
      team_id: teamId,
      organization_id: organizationId,
      consent_given: true,
      consent_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  // The pilot capacity control refuses a NEW participant once the campaign is
  // full. It is not a fault, so it does not read like one — and it is reached
  // only after the resume lookup above, so anyone who already holds a place
  // continues their own attempt rather than meeting this message.
  if (error && isPilotCapacityError(error)) {
    return { ok: false, error: PILOT_CAPACITY_MESSAGE };
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

const answerSchema = z.object({
  sessionId: z.uuid(),
  itemId: z.uuid(),
  position: z.number().int().min(0).max(3),
  itemIndex: z.number().int().min(0).max(11),
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

  // The item must belong to the version this session is running.
  const { data: item } = await supabase
    .from("wellbeing_items")
    .select("id, version_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!item || item.version_id !== session.version_id) {
    return { ok: false, answeredCount: 0, error: "Question not found" };
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
      "id, profile_id, status, version_id, instrument_key, team_id, organization_id, consent_given, consent_at, department_name, sub_unit_name, work_location, office_location_name, job_title",
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
        threshold: policy.screeningThreshold,
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
    } else {
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
    }
  } catch {
    // Both engines reject incomplete or malformed sets rather than returning a
    // partial score. Surface that as a form problem, never as a silent zero.
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
  const teamId = (formData.get("team_id") as string | null) || null;
  const consent = formData.get("consent") === "on" || formData.get("consent") === "true";
  if (!consent) redirect("/wellbeing/declined");

  const requested = formData.get("instrument_key");
  const instrumentKey =
    typeof requested === "string" && isInstrumentKey(requested) ? requested : undefined;

  const outcome = await beginWellbeingPulse({ teamId, consent: true, instrumentKey });
  if (!outcome.ok || !outcome.sessionId) {
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
