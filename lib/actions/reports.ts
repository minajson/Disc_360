"use server";

import { z } from "zod";
import { requireOnboarded, requireTeamAdmin } from "@/lib/auth/guards";
import { sendIndividualReport, sendReportReady } from "@/lib/email/notifications";
import { loadOwnReport, parseReportProduct, type ReportProduct } from "@/lib/reports/loader";
import { renderReportPdf } from "@/lib/reports/pdf";
import { isDeliverableEmail, maskEmail } from "@/lib/reports/identity";
import { insightMap } from "@/data/insight-maps";
import type { ArchetypeCode } from "@/lib/types";

export interface ReportActionResult {
  ok: boolean;
  message: string;
}

/**
 * Records a report export for the requesting user.
 *
 * `report_exports.result_id` is a foreign key into `assessment_results`, so
 * only a DISC export can carry one; Focus and combined exports are recorded
 * without it rather than by widening a schema this change has no business
 * touching.
 */
export async function logReportExport(product: ReportProduct, id: string): Promise<void> {
  if (!z.uuid().safeParse(id).success) return;
  const { supabase, user } = await requireOnboarded();

  await supabase.from("report_exports").insert({
    profile_id: user.id,
    result_id: product === "disc" ? id : null,
    kind: "individual_report",
  });
}

export interface EmailReportResult extends ReportActionResult {
  /** Distinguishes "we tried and it failed" from "we never dispatched it". */
  status: "sent" | "not_delivered" | "unauthorized" | "invalid_email";
  /** Masked form of the address that was used, for the confirmation line. */
  maskedRecipient?: string;
}

const emailReportSchema = z.object({
  product: z.string(),
  id: z.uuid(),
  /** Only consulted when the account carries no address of its own. */
  fallbackEmail: z.string().trim().max(254).optional(),
});

/**
 * Email the signed-in participant their own report, PDF attached.
 *
 * The recipient is resolved server-side from the caller's own profile — a
 * client-supplied address is only ever consulted when the account genuinely
 * has none, and is validated before use. That keeps this from becoming a way
 * to have DISC360 mail an arbitrary address on request.
 *
 * Success is reported only when the provider accepted the message. A send
 * that was merely logged (no provider configured, or a real recipient outside
 * production) is a failure from the participant's point of view, and says so.
 */
export async function emailMyIndividualReport(
  input: z.infer<typeof emailReportSchema>,
): Promise<EmailReportResult> {
  const parsed = emailReportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: "unauthorized", message: "Report not found." };
  }
  const product = parseReportProduct(parsed.data.product);
  if (!product) {
    return { ok: false, status: "unauthorized", message: "Report not found." };
  }

  const report = await loadOwnReport(product, parsed.data.id);
  if (!report) {
    return { ok: false, status: "unauthorized", message: "Report not found." };
  }

  const recipient = report.accountEmail?.trim() || parsed.data.fallbackEmail?.trim() || "";
  if (!isDeliverableEmail(recipient)) {
    return {
      ok: false,
      status: "invalid_email",
      message: "Enter a valid email address to send your report to.",
    };
  }

  const pdf = renderReportPdf(report.document);
  const outcome = await sendIndividualReport({
    to: recipient,
    profileId: report.context.user.id,
    firstName: report.context.profile.preferred_name?.trim() || report.document.participantName,
    reportPath: report.webPath,
    attachment: {
      filename: report.filename,
      content: Buffer.from(pdf).toString("base64"),
    },
  });

  const masked = maskEmail(recipient);
  if (outcome.status === "sent") {
    await logReportExport(product, parsed.data.id);
    return { ok: true, status: "sent", message: "Your report has been sent.", maskedRecipient: masked };
  }

  return {
    ok: false,
    status: "not_delivered",
    message: "We couldn't send your report right now. You can still download your PDF.",
    maskedRecipient: masked,
  };
}

/**
 * Team admin: send (or resend) a participant's report — strictly to that
 * participant's own email, never to the admin.
 */
export async function sendParticipantReport(
  teamId: string,
  resultId: string,
): Promise<ReportActionResult> {
  if (!z.uuid().safeParse(teamId).success || !z.uuid().safeParse(resultId).success) {
    return { ok: false, message: "Invalid request." };
  }
  const { supabase, user } = await requireTeamAdmin(teamId);

  // Service role after the admin check: the participant's result is not
  // readable under the admin's RLS context by design.
  const { createSupabaseAdminClient } = await import("@/lib/db/admin");
  const admin = createSupabaseAdminClient();

  const { data: result } = await admin
    .from("assessment_results")
    .select("id, archetype_code, profile_id, profiles (email)")
    .eq("id", resultId)
    .maybeSingle();
  if (!result) return { ok: false, message: "Report not found." };

  // The participant must belong to this admin's team.
  const { data: membership } = await admin
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("profile_id", result.profile_id)
    .maybeSingle();
  if (!membership) return { ok: false, message: "That participant is not on this team." };

  const profileRow = Array.isArray(result.profiles) ? result.profiles[0] : result.profiles;
  if (!profileRow?.email) return { ok: false, message: "Participant has no email." };

  await sendReportReady({
    to: profileRow.email,
    profileId: result.profile_id,
    archetypeName: insightMap[result.archetype_code as ArchetypeCode].name,
    resultId: result.id,
  });
  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "team.report_sent",
    entity_type: "assessment_result",
    entity_id: resultId,
    metadata: { team_id: teamId },
  });
  return { ok: true, message: "Report emailed to the participant." };
}
