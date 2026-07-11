import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";

/**
 * Personal data export — everything the account owns, under the user's own
 * RLS context (nothing here can read other people's data by construction).
 */
export async function GET() {
  const { supabase, user, profile } = await requireUser();

  const [sessions, responses, results, memberships, preferences, exportsLog] =
    await Promise.all([
      supabase.from("assessment_sessions").select("*").eq("profile_id", user.id),
      supabase
        .from("assessment_responses")
        .select("*, assessment_sessions!inner(profile_id)")
        .eq("assessment_sessions.profile_id", user.id),
      supabase.from("assessment_results").select("*").eq("profile_id", user.id),
      supabase.from("team_members").select("team_id, display_name, department, role, created_at").eq("profile_id", user.id),
      supabase.from("notification_preferences").select("*").eq("profile_id", user.id),
      supabase.from("report_exports").select("*").eq("profile_id", user.id),
    ]);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "account.data_exported",
    entity_type: "profile",
    entity_id: user.id,
  });

  const payload = {
    exported_at: new Date().toISOString(),
    profile,
    assessment_sessions: sessions.data ?? [],
    assessment_responses: responses.data ?? [],
    assessment_results: results.data ?? [],
    team_memberships: memberships.data ?? [],
    notification_preferences: preferences.data ?? [],
    report_exports: exportsLog.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="disc360-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
