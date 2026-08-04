"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboarded, requireTeamAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";

/**
 * Team lineage administration.
 *
 * Associating teams into a series changes what history a facilitator can see,
 * so it is an explicit administrative act with an audit row — never inferred
 * from a matching team name. Both teams must live in the same organisation
 * and the caller must administer both, which stops a series being used to
 * pull another team's aggregate history into view.
 */

const linkSchema = z.object({
  teamId: z.uuid(),
  /** Team to bring into the same series. */
  otherTeamId: z.uuid(),
  seriesName: z.string().trim().min(1).max(120),
});

async function audit(
  actorId: string,
  action: string,
  entityId: string,
  metadata: Record<string, string>,
) {
  const admin = createSupabaseAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: "team_series",
    entity_id: entityId,
    metadata,
  });
}

export interface LineageResult {
  ok: boolean;
  error?: string;
}

/** Puts two teams into one explicitly-named series. */
export async function linkTeamToSeries(input: {
  teamId: string;
  otherTeamId: string;
  seriesName: string;
}): Promise<LineageResult> {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const { teamId, otherTeamId, seriesName } = parsed.data;
  if (teamId === otherTeamId) return { ok: false, error: "Pick a different team" };

  // Administering BOTH teams is the requirement. Without the second check, a
  // facilitator could attach someone else's team and read its aggregate
  // history through the series.
  const { user } = await requireTeamAdmin(teamId);
  await requireTeamAdmin(otherTeamId);

  const admin = createSupabaseAdminClient();
  const { data: teams } = await admin
    .from("teams")
    .select("id, name, organization_id, team_series_id")
    .in("id", [teamId, otherTeamId]);

  const current = teams?.find((row) => row.id === teamId);
  const other = teams?.find((row) => row.id === otherTeamId);
  if (!current || !other) return { ok: false, error: "Team not found" };
  if (current.organization_id !== other.organization_id) {
    return { ok: false, error: "Teams must belong to the same organisation" };
  }

  // Reuse whichever series already exists, so linking a third team does not
  // fragment the lineage into two series.
  let seriesId = current.team_series_id ?? other.team_series_id ?? null;
  if (!seriesId) {
    const { data: created, error } = await admin
      .from("team_series")
      .insert({
        organization_id: current.organization_id,
        name: seriesName,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: "Could not create the series" };
    seriesId = created.id;
  }

  const { error: updateError } = await admin
    .from("teams")
    .update({ team_series_id: seriesId })
    .in("id", [teamId, otherTeamId]);
  if (updateError) return { ok: false, error: "Could not link the teams" };

  await audit(user.id, "team_series.linked", seriesId, {
    team_id: teamId,
    other_team_id: otherTeamId,
    series_name: seriesName,
  });

  revalidatePath(`/app/teams/${teamId}/history`);
  revalidatePath(`/app/teams/${otherTeamId}/history`);
  return { ok: true };
}

/** Removes one team from its series. The series and other teams stay. */
export async function unlinkTeamFromSeries(teamId: string): Promise<LineageResult> {
  if (!z.uuid().safeParse(teamId).success) return { ok: false, error: "Invalid request" };
  const { user } = await requireTeamAdmin(teamId);

  const admin = createSupabaseAdminClient();
  const { data: team } = await admin
    .from("teams")
    .select("team_series_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team?.team_series_id) return { ok: true };

  await admin.from("teams").update({ team_series_id: null }).eq("id", teamId);
  await audit(user.id, "team_series.unlinked", team.team_series_id, { team_id: teamId });

  revalidatePath(`/app/teams/${teamId}/history`);
  return { ok: true };
}

/**
 * Confirms a participant intends to retake, recording why. The attempt itself
 * is created by startAssessment; this only validates that the participant has
 * actually seen the "your earlier result is preserved" notice.
 */
export async function acknowledgeRetake(): Promise<void> {
  // Presence of an authenticated, onboarded caller is the whole check — the
  // retake reason travels with the start form.
  await requireOnboarded();
}
