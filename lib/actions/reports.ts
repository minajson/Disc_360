"use server";

import { z } from "zod";
import { requireOnboarded, requireTeamAdmin } from "@/lib/auth/guards";
import { sendReportReady } from "@/lib/email/notifications";
import { insightMap } from "@/data/insight-maps";
import type { ArchetypeCode } from "@/lib/types";

export interface ReportActionResult {
  ok: boolean;
  message: string;
}

/** Records a report export (print/PDF) for the requesting user. */
export async function logReportExport(resultId: string): Promise<void> {
  if (!z.uuid().safeParse(resultId).success) return;
  const { supabase, user } = await requireOnboarded();

  // RLS: result readable only when owned.
  const { data: result } = await supabase
    .from("assessment_results")
    .select("id")
    .eq("id", resultId)
    .maybeSingle();
  if (!result) return;

  await supabase.from("report_exports").insert({
    profile_id: user.id,
    result_id: resultId,
    kind: "individual_report",
  });
}

/** Email the signed-in user their own report. */
export async function emailMyReport(resultId: string): Promise<ReportActionResult> {
  if (!z.uuid().safeParse(resultId).success) {
    return { ok: false, message: "Invalid report." };
  }
  const { supabase, user, profile } = await requireOnboarded();

  const { data: result } = await supabase
    .from("assessment_results")
    .select("id, archetype_code")
    .eq("id", resultId)
    .maybeSingle();
  if (!result) return { ok: false, message: "Report not found." };

  await sendReportReady({
    to: profile.email,
    profileId: user.id,
    archetypeName: insightMap[result.archetype_code as ArchetypeCode].name,
    resultId: result.id,
  });
  return { ok: true, message: `Report sent to ${profile.email}.` };
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
