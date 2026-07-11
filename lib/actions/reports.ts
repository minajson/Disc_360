"use server";

import { z } from "zod";
import { requireOnboarded } from "@/lib/auth/guards";

/** Records a report export (print/PDF) for the requesting user. */
export async function logReportExport(resultId: string): Promise<void> {
  if (!z.uuid().safeParse(resultId).success) return;
  const { supabase, user } = await requireOnboarded();

  // RLS: insert allowed only for own profile; result ownership verified here.
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
