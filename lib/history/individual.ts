import "server-only";
import { requireOnboarded } from "@/lib/auth/guards";
import { insightMap } from "@/data/insight-maps";
import type { HistoryRecord } from "@/lib/history/timeline";
import type { ArchetypeCode, Dimension } from "@/lib/types";

/**
 * A participant's own assessment history.
 *
 * Authorization is the simplest possible: this reads through the caller's own
 * Supabase client, and `results_select_own` scopes assessment_results to
 * `profile_id = auth.uid()`. There is no profile id parameter, so there is no
 * way to ask for somebody else's history — a facilitator or platform admin
 * calling this gets their own records, not the participant's.
 *
 * That is deliberate. Individual history for other people is governed by the
 * existing result-visibility model and belongs on the surfaces that already
 * implement it, not in a general-purpose reader.
 */

export interface IndividualHistory {
  records: HistoryRecord[];
  discCount: number;
  focusCount: number;
}

export async function getMyHistory(): Promise<IndividualHistory> {
  const { supabase, user } = await requireOnboarded();

  const [{ data: disc }, { data: focus }] = await Promise.all([
    supabase
      .from("assessment_results")
      .select(
        "id, created_at, score_d, score_i, score_s, score_c, archetype_code, primary_dimension, secondary_dimension, team_id, team_series_id, team_name_at_completion, department_at_completion, role_at_completion, organization_name_at_completion, retake_reason, retake_note, assessment_version, scoring_version, attempt_number",
      )
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("focus_results")
      .select(
        "id, created_at, automaticity, distraction, mental_load, recovery, pattern_code, team_id, team_series_id, team_name_at_completion, department_at_completion, role_at_completion, organization_name_at_completion, retake_reason, retake_note, assessment_version, scoring_version, attempt_number",
      )
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const discRecords: HistoryRecord[] = (disc ?? []).map((row) => {
    const code = row.archetype_code as ArchetypeCode;
    return {
      id: row.id,
      kind: "disc",
      completedAt: row.created_at,
      scores: { d: row.score_d, i: row.score_i, s: row.score_s, c: row.score_c },
      archetypeCode: code,
      archetypeName: insightMap[code].name,
      primary: row.primary_dimension as Dimension,
      secondary: (row.secondary_dimension as Dimension | null) ?? null,
      teamId: row.team_id,
      teamSeriesId: row.team_series_id,
      teamNameAtCompletion: row.team_name_at_completion,
      departmentAtCompletion: row.department_at_completion,
      roleAtCompletion: row.role_at_completion,
      organizationNameAtCompletion: row.organization_name_at_completion,
      retakeReason: row.retake_reason,
      retakeNote: row.retake_note,
      assessmentVersion: row.assessment_version,
      scoringVersion: row.scoring_version,
      attemptNumber: row.attempt_number,
    };
  });

  // Focus results carry four non-DISC dimensions. They ride the same timeline
  // so a participant sees one chronological history, but they are never
  // charted on the DISC axes — trendSeries filters by kind.
  const focusRecords: HistoryRecord[] = (focus ?? []).map((row) => ({
    id: row.id,
    kind: "focus",
    completedAt: row.created_at,
    scores: {
      d: row.automaticity,
      i: row.distraction,
      s: row.mental_load,
      c: row.recovery,
    },
    archetypeCode: "BAL" as ArchetypeCode,
    archetypeName: row.pattern_code,
    primary: "D" as Dimension,
    secondary: null,
    teamId: row.team_id,
    teamSeriesId: row.team_series_id,
    teamNameAtCompletion: row.team_name_at_completion,
    departmentAtCompletion: row.department_at_completion,
    roleAtCompletion: row.role_at_completion,
    organizationNameAtCompletion: row.organization_name_at_completion,
    retakeReason: row.retake_reason,
    retakeNote: row.retake_note,
    assessmentVersion: row.assessment_version,
    scoringVersion: row.scoring_version,
    attemptNumber: row.attempt_number,
  }));

  return {
    records: [...discRecords, ...focusRecords],
    discCount: discRecords.length,
    focusCount: focusRecords.length,
  };
}
