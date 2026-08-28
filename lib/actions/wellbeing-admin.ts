"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboarded, requireSuperAdmin } from "@/lib/auth/guards";
import { INSTRUMENTS, thresholdMaxFor } from "@/data/wellbeing-instruments";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import {
  grantWellbeingRole,
  requireWellbeingGovernance,
  revokeWellbeingRole,
  WellbeingAccessError,
} from "@/lib/wellbeing/access";

/**
 * Wellbeing Pulse governance actions.
 *
 * Two distinct privileges, deliberately not merged:
 *
 *  · GRANTING a wellbeing role is platform administration. A super admin can
 *    assign one — including to themselves. What that buys them is bounded by
 *    the schema: no wellbeing role reads an individual result, so self-granting
 *    reaches aggregate reporting and policy, never a person's answers.
 *
 *  · EXERCISING governance (threshold, confidentiality floor, taxonomy) needs
 *    the role itself. A platform administrator who has not been granted it
 *    cannot change the screening threshold, which is the separation §3 asks
 *    for: the cut-off is a clinical/governance decision, not a settings toggle.
 *
 * Every action writes an audit_logs row with structural metadata only.
 */

export interface AdminActionResult {
  ok: boolean;
  message: string;
  /** Where the caller should go on success, e.g. a newly created campaign. */
  redirectTo?: string;
}

const grantSchema = z.object({
  profileId: z.uuid(),
  organizationId: z.uuid(),
  role: z.enum(["wellbeing_governance", "wellbeing_analyst"]),
  note: z.string().trim().max(300).optional(),
});

export async function grantWellbeingRoleAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const parsed = grantSchema.safeParse({
    profileId: formData.get("profile_id"),
    organizationId: formData.get("organization_id"),
    role: formData.get("role"),
    note: (formData.get("note") as string | null) ?? undefined,
  });
  if (!parsed.success) return { ok: false, message: "Choose a person, an organisation and a role." };

  const actor = await requireSuperAdmin();
  const result = await grantWellbeingRole({ actor, ...parsed.data });
  revalidatePath("/admin/wellbeing");
  return result;
}

export async function revokeWellbeingRoleAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const grantId = formData.get("grant_id");
  if (!z.uuid().safeParse(grantId).success) return { ok: false, message: "Invalid grant." };

  const actor = await requireSuperAdmin();
  const result = await revokeWellbeingRole({ actor, grantId: grantId as string });
  revalidatePath("/admin/wellbeing");
  return result;
}

/**
 * The instrument this governance surface configures.
 *
 * Stated once, and used for BOTH the validation bound and the stored
 * `scoring_method`, so the row records which instrument it governs instead of
 * inheriting it from a column default. `resolveInstrumentThreshold` reads that
 * column; a policy that does not say what it governs cannot be applied safely.
 *
 * Per-instrument policy authoring is a catalogue-governance concern and is not
 * built here. Until it is, this surface governs GHQ-12 and says so.
 */
const GOVERNED_INSTRUMENT = "ghq12" as const;
/** GHQ-12's own scale — not a platform-wide 1–12. */
const GOVERNED_THRESHOLD_MAX = thresholdMaxFor(GOVERNED_INSTRUMENT) ?? 1;

const policySchema = z.object({
  organizationId: z.uuid(),
  screeningThreshold: z.coerce.number().int().min(1).max(GOVERNED_THRESHOLD_MAX),
  minCohortSize: z.coerce.number().int().min(5).max(100),
  rationale: z.string().trim().min(20).max(2000),
});

/**
 * Appends a new policy. Nothing is updated and nothing is deleted: the
 * previous row stays as the record of what was in force before, and every
 * result already carries the threshold it was scored against, so revising
 * policy never re-reads history.
 */
export async function setWellbeingPolicyAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const parsed = policySchema.safeParse({
    organizationId: formData.get("organization_id"),
    screeningThreshold: formData.get("screening_threshold"),
    minCohortSize: formData.get("min_cohort_size"),
    rationale: formData.get("rationale"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        `A threshold (1–${GOVERNED_THRESHOLD_MAX}), a minimum group size (5 or more) and a rationale are required.`,
    };
  }

  let access;
  try {
    access = await requireWellbeingGovernance(parsed.data.organizationId);
  } catch (error) {
    if (error instanceof WellbeingAccessError) {
      return {
        ok: false,
        message:
          "Changing the screening threshold requires the Wellbeing governance role for this organisation.",
      };
    }
    throw error;
  }

  const { error } = await access.supabase.from("wellbeing_policies").insert({
    organization_id: parsed.data.organizationId,
    screening_threshold: parsed.data.screeningThreshold,
    scoring_method: INSTRUMENTS[GOVERNED_INSTRUMENT].scoringMethod,
    min_cohort_size: parsed.data.minCohortSize,
    rationale: parsed.data.rationale,
    created_by: access.user.id,
  });
  if (error) return { ok: false, message: "Could not record the policy change." };

  // Service role: audit_logs is written by the service role platform-wide.
  const admin = createSupabaseAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: access.user.id,
    action: "wellbeing.policy_changed",
    entity_type: "organization",
    entity_id: parsed.data.organizationId,
    metadata: {
      screening_threshold: parsed.data.screeningThreshold,
      min_cohort_size: parsed.data.minCohortSize,
    },
  });

  revalidatePath("/admin/wellbeing");
  revalidatePath("/wellbeing/analytics");
  return {
    ok: true,
    message: `Policy recorded. New pulses will use threshold ${parsed.data.screeningThreshold}; existing results keep the threshold they were scored against.`,
  };
}

export async function installWellbeingTaxonomyAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const organizationId = formData.get("organization_id");
  if (!z.uuid().safeParse(organizationId).success) {
    return { ok: false, message: "Choose an organisation." };
  }
  await requireOnboarded();
  const { installWellbeingTaxonomy } = await import("@/lib/actions/wellbeing");
  const result = await installWellbeingTaxonomy(organizationId as string);
  revalidatePath("/admin/wellbeing");
  return result;
}

/* ── campaign instrument selection ──────────────────────────────────── */

/**
 * Sets the instrument a team's Wellbeing Pulse campaign runs.
 *
 * Three guards, in order:
 *
 *  1 · TEAM ADMIN. Configuring a campaign is facilitation, so it uses the
 *      existing team-admin guard rather than a wellbeing role — a facilitator
 *      choosing which questionnaire to run gains no access to any result.
 *  2 · LICENSING. An instrument that cannot be served here cannot be selected
 *      here. Checked server-side against the same gate the participant flow
 *      uses, so a disabled radio in the UI is a convenience, not the control.
 *  3 · LOCKING. Enforced by the database trigger. This surfaces its message
 *      rather than duplicating the rule.
 */
export async function setCampaignInstrumentAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const teamId = formData.get("team_id");
  const requested = formData.get("instrument_key");

  if (!z.uuid().safeParse(teamId).success) {
    return { ok: false, message: "Invalid campaign." };
  }
  const { isInstrumentKey, canServeToParticipants, INSTRUMENTS: REGISTRY } = await import(
    "@/data/wellbeing-instruments"
  );
  if (typeof requested !== "string" || !isInstrumentKey(requested)) {
    return { ok: false, message: "Choose an instrument." };
  }

  const { requireTeamAdmin } = await import("@/lib/auth/guards");
  const context = await requireTeamAdmin(teamId as string);

  const { isProductionEnvironment, isWellbeingDemoEnabled } = await import(
    "@/lib/wellbeing/environment"
  );
  const decision = canServeToParticipants(requested, {
    isProduction: isProductionEnvironment(),
    demoEnabled: isWellbeingDemoEnabled(),
  });
  if (!decision.allowed) {
    return {
      ok: false,
      message: `${REGISTRY[requested].name} cannot be launched here — ${decision.reason}`,
    };
  }

  const { error } = await context.supabase
    .from("teams")
    .update({ wellbeing_instrument_key: requested })
    .eq("id", teamId);

  if (error) {
    // The lock trigger raises a check_violation with a participant-safe
    // message; surface it rather than a generic failure.
    const locked = error.message?.includes("Wellbeing instrument is locked");
    return {
      ok: false,
      message: locked
        ? "This campaign already has participant attempts, so its instrument cannot be changed. Create a new campaign to run a different instrument."
        : "Could not set the instrument for this campaign.",
    };
  }

  const admin = createSupabaseAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: context.user.id,
    action: "wellbeing.campaign_instrument_set",
    entity_type: "team",
    entity_id: teamId as string,
    metadata: { instrument_key: requested },
  });

  revalidatePath(`/wellbeing/admin/campaigns/${teamId as string}`);
  revalidatePath("/wellbeing/analytics");
  return { ok: true, message: `${REGISTRY[requested].name} selected for this campaign.` };
}

/* ── create a Wellbeing Pulse campaign ──────────────────────────────── */

/**
 * Creates a campaign for ONE instrument, chosen before the campaign exists.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THE INSTRUMENT COMES FIRST.
 *
 * A campaign's QR code and join link are printed, projected and forwarded.
 * They have to mean one thing permanently, so the instrument is part of
 * creating the campaign rather than something configured afterwards — and
 * 00029 locks it the moment anyone answers.
 *
 * The participant is never asked which questionnaire to take. They scan a
 * code and answer the instrument their facilitator chose.
 *
 * WHY IT SETS assessment_type.
 *
 * A campaign is stored as a team, and `assessment_type` is what every DISC
 * surface reads to decide what to render. Creating one without it produced a
 * wellbeing campaign that displayed the DISC team dashboard — including
 * Compare Members, a named-person comparison a wellbeing campaign must never
 * offer. 00032 keeps the two fields in agreement, and this passes it
 * explicitly so the intent is visible at the call site too.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function createWellbeingCampaignAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const { z } = await import("zod");
  const { requireOnboarded } = await import("@/lib/auth/guards");
  const { isInstrumentKey, INSTRUMENTS } = await import("@/data/wellbeing-instruments");
  const { canServeToParticipants } = await import("@/data/wellbeing-instruments");
  const { isProductionEnvironment, isWellbeingDemoEnabled } = await import(
    "@/lib/wellbeing/environment"
  );

  const name = String(formData.get("name") ?? "").trim();
  const instrumentKey = String(formData.get("instrument_key") ?? "");
  const organizationId = String(formData.get("organization_id") ?? "");
  const capacityRaw = String(formData.get("capacity") ?? "").trim();

  if (name.length < 2 || name.length > 120) {
    return { ok: false, message: "Give the campaign a name." };
  }
  if (!z.uuid().safeParse(organizationId).success) {
    return { ok: false, message: "Invalid organisation." };
  }
  if (!isInstrumentKey(instrumentKey)) {
    return { ok: false, message: "Choose a questionnaire for this campaign." };
  }

  // The licensing gate decides what may be SERVED, and it is checked here as
  // well as at the participant's first request. A campaign whose instrument
  // cannot be served would hand out a QR code that refuses everyone who scans
  // it — better to refuse the facilitator now, with a reason.
  const decision = canServeToParticipants(instrumentKey, {
    isProduction: isProductionEnvironment(),
    demoEnabled: isWellbeingDemoEnabled(),
  });
  if (!decision.allowed) {
    // `reason` is null only when the decision is "allowed"; a refusal always
    // carries one. The fallback keeps the type honest rather than asserting.
    return { ok: false, message: decision.reason ?? "This questionnaire is not available yet." };
  }

  const capacity = capacityRaw === "" ? null : Number(capacityRaw);
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
    return { ok: false, message: "Participant capacity must be a whole number, or left blank." };
  }

  const { requireWellbeingGovernance } = await import("@/lib/wellbeing/access");
  let access;
  try {
    access = await requireWellbeingGovernance(organizationId);
  } catch {
    return { ok: false, message: "You do not hold Wellbeing Pulse governance here." };
  }
  const { profile } = await requireOnboarded();

  const stem = name.replace(/[^a-zA-Z]/g, "").slice(0, 5).toUpperCase() || "WELL";
  const { createSupabaseAdminClient } = await import("@/lib/db/admin");
  const admin = createSupabaseAdminClient();

  const { data: team, error } = await admin
    .from("teams")
    .insert({
      organization_id: organizationId,
      name,
      description: "",
      // Both, explicitly. 00032 would derive the type from the instrument
      // anyway; saying it here keeps the boundary readable at the call site.
      assessment_type: "wellbeing",
      wellbeing_instrument_key: instrumentKey,
      wellbeing_pilot_capacity: capacity,
      team_code: `${stem}-${Math.floor(1000 + Math.random() * 9000)}`,
      created_by: access.user.id,
      join_enabled: true,
    })
    .select("id")
    .single();

  if (error || !team) {
    return { ok: false, message: "Could not create the campaign." };
  }

  await admin.from("team_members").insert({
    team_id: team.id,
    profile_id: access.user.id,
    display_name: profile.full_name,
    email: profile.email,
    role: "team_admin",
  });

  await admin.from("audit_logs").insert({
    actor_id: access.user.id,
    action: "wellbeing.campaign_created",
    entity_type: "team",
    entity_id: team.id,
    metadata: { instrument: INSTRUMENTS[instrumentKey].name, capacity },
  });

  return {
    ok: true,
    message: `${name} created for ${INSTRUMENTS[instrumentKey].name}.`,
    redirectTo: `/wellbeing/admin/campaigns/${team.id}`,
  };
}
