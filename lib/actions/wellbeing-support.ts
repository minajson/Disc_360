"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { requireWellbeingGovernance } from "@/lib/wellbeing/access";
import { screenWellbeingCopy } from "@/lib/wellbeing/language";

/**
 * Configuring an organisation's EAP and Occupational Health routes.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY GOVERNANCE, AND NOT THE FACILITATOR RUNNING THE CAMPAIGN.
 *
 * What is saved here is published to every participant in the organisation as
 * the answer to "who do I talk to". A wrong number is not a cosmetic defect —
 * it is somebody who decided to ask for help reaching nobody. That is an
 * organisational commitment, so it needs the organisational role, not
 * administration of one campaign.
 *
 * WHY NOTHING IS PRE-FILLED.
 *
 * The platform is multi-organisation and multi-jurisdiction. A default number
 * would be wrong for every organisation except the one it was typed for, and a
 * confidently wrong support number is worse than an absent one — the same
 * reasoning that keeps data/ghq28-support-content.ts from guessing a crisis
 * line. An organisation that has configured nothing shows participants nothing.
 *
 * WHAT IS VALIDATED, AND WHY THE URL RULE IS STRICT.
 *
 * `https://` only. A support link is followed by somebody in a difficult
 * moment, often on a phone on a shared network; offering that person a
 * plaintext hop is not a trade this product makes. The database repeats the
 * rule as a check constraint, so it holds for any writer.
 *
 * The free-text note passes the same language screen as every other
 * participant-facing string in the product: an organisation may say "ask for
 * the wellbeing team at reception". It may not use this field to give clinical
 * guidance, name a condition, or describe the people it thinks should call.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface SupportActionResult {
  ok: boolean;
  message: string;
}

/** Trimmed, and empty-to-null so a cleared field clears the column. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable();

const schema = z.object({
  organizationId: z.uuid(),

  eapEnabled: z.boolean(),
  eapProviderName: optionalText(120),
  eapPhone: optionalText(60),
  eapEmail: optionalText(200),
  eapUrl: optionalText(300),
  eapHours: optionalText(200),

  ohEnabled: z.boolean(),
  ohServiceName: optionalText(120),
  ohPhone: optionalText(60),
  ohEmail: optionalText(200),
  ohUrl: optionalText(300),
  ohHours: optionalText(200),

  supportNote: optionalText(400),
});

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const HTTPS = /^https:\/\/\S+$/i;
const PHONE = /^[+0-9][0-9\s().-]{2,}$/;

export async function setOrganisationSupportAction(
  formData: FormData,
): Promise<SupportActionResult> {
  const parsed = schema.safeParse({
    organizationId: formData.get("organization_id"),
    eapEnabled: formData.get("eap_enabled") === "on",
    eapProviderName: formData.get("eap_provider_name") ?? "",
    eapPhone: formData.get("eap_phone") ?? "",
    eapEmail: formData.get("eap_email") ?? "",
    eapUrl: formData.get("eap_url") ?? "",
    eapHours: formData.get("eap_hours") ?? "",
    ohEnabled: formData.get("oh_enabled") === "on",
    ohServiceName: formData.get("oh_service_name") ?? "",
    ohPhone: formData.get("oh_phone") ?? "",
    ohEmail: formData.get("oh_email") ?? "",
    ohUrl: formData.get("oh_url") ?? "",
    ohHours: formData.get("oh_hours") ?? "",
    supportNote: formData.get("support_note") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, message: "Check the details and try again." };
  }
  const input = parsed.data;

  let access;
  try {
    access = await requireWellbeingGovernance(input.organizationId);
  } catch {
    return {
      ok: false,
      message: "You do not hold Wellbeing Pulse governance in this organisation.",
    };
  }

  const problems: string[] = [];
  const check = (
    value: string | null,
    pattern: RegExp,
    complaint: string,
  ) => {
    if (value !== null && !pattern.test(value)) problems.push(complaint);
  };

  check(input.eapPhone, PHONE, "The EAP phone number does not look like a phone number.");
  check(input.ohPhone, PHONE, "The Occupational Health phone number does not look like a phone number.");
  check(input.eapEmail, EMAIL, "The EAP email address is not valid.");
  check(input.ohEmail, EMAIL, "The Occupational Health email address is not valid.");
  check(input.eapUrl, HTTPS, "The EAP link must start with https://");
  check(input.ohUrl, HTTPS, "The Occupational Health link must start with https://");

  // A route that is switched on with no way to reach it would render a support
  // panel a participant cannot act on. Refused here with a sentence, and
  // refused again by the database's own check constraint.
  if (input.eapEnabled && !(input.eapPhone || input.eapEmail || input.eapUrl)) {
    problems.push("Give participants at least one way to reach the EAP before switching it on.");
  }
  if (input.ohEnabled && !(input.ohPhone || input.ohEmail || input.ohUrl)) {
    problems.push(
      "Give participants at least one way to reach Occupational Health before switching it on.",
    );
  }

  if (input.supportNote) {
    const violations = screenWellbeingCopy(input.supportNote);
    if (violations.length > 0) {
      problems.push(
        `The note cannot be published as written: ${violations[0]!.reason} Support information describes how to get in touch, not what anybody's answers mean.`,
      );
    }
  }

  if (problems.length > 0) return { ok: false, message: problems[0]! };

  // Service role: the write policy on `organization_support_settings` admits
  // governance, and `requireWellbeingGovernance` above is that same check made
  // explicitly so the refusal is a sentence rather than a silent zero-row
  // update.
  const admin = createSupabaseAdminClient();

  const { error } = await admin.from("organization_support_settings").upsert(
    {
      organization_id: input.organizationId,
      eap_enabled: input.eapEnabled,
      eap_provider_name: input.eapProviderName,
      eap_phone: input.eapPhone,
      eap_email: input.eapEmail,
      eap_url: input.eapUrl,
      eap_hours: input.eapHours,
      oh_enabled: input.ohEnabled,
      oh_service_name: input.ohServiceName,
      oh_phone: input.ohPhone,
      oh_email: input.ohEmail,
      oh_url: input.ohUrl,
      oh_hours: input.ohHours,
      support_note: input.supportNote,
      updated_by: access.user.id,
    },
    { onConflict: "organization_id" },
  );

  if (error) {
    return { ok: false, message: "Those details could not be saved. Please try again." };
  }

  await admin.from("audit_logs").insert({
    actor_id: access.user.id,
    action: "wellbeing.support_settings_updated",
    entity_type: "organization",
    entity_id: input.organizationId,
    // WHICH routes are published, never the numbers themselves: an audit row
    // is read by more people than the settings page is.
    metadata: {
      eap_enabled: input.eapEnabled,
      occupational_health_enabled: input.ohEnabled,
      has_note: input.supportNote !== null,
    },
  });

  revalidatePath("/wellbeing/admin/support");
  return {
    ok: true,
    message:
      input.eapEnabled || input.ohEnabled
        ? "Saved. Participants will see these details on every result."
        : "Saved. No support card is shown to participants while both services are switched off.",
  };
}
