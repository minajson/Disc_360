import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/db/server";
import { createSupabaseAdminClient } from "@/lib/db/admin";

/**
 * Live join/completion counts for the presentation QR overlay.
 * Admin-guarded; returns counts only — no names, no results.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  if (!z.uuid().safeParse(teamId).success) {
    return NextResponse.json({ error: "invalid team" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: isAdmin } = await supabase.rpc("is_team_admin", { team: teamId });
  if (!isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Service role after the guard: count-only aggregation.
  const admin = createSupabaseAdminClient();
  const { data: members } = await admin
    .from("team_members")
    .select("profile_id")
    .eq("team_id", teamId);

  const profileIds = (members ?? [])
    .map((member) => member.profile_id)
    .filter((id): id is string => Boolean(id));

  let completed = 0;
  if (profileIds.length > 0) {
    const { data: results } = await admin
      .from("assessment_results")
      .select("profile_id")
      .in("profile_id", profileIds);
    completed = new Set((results ?? []).map((row) => row.profile_id)).size;
  }

  return NextResponse.json({
    joined: profileIds.length,
    completed,
  });
}
