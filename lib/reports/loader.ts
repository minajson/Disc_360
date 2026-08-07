import "server-only";
import { z } from "zod";
import { requireOnboarded, type AuthContext } from "@/lib/auth/guards";
import {
  buildCombinedReport,
  buildDiscReport,
  buildFocusReport,
  type ReportDocument,
} from "@/lib/reports/model";
import { reportFilename, type ReportProduct } from "@/lib/reports/identity";
import type { ArchetypeInsight } from "@/data/insight-maps";
import type { FocusResult } from "@/lib/scoring/focus";
import type { ArchetypeCode, Dimension, DiscScores } from "@/lib/types";

/**
 * Loading a participant's OWN individual report.
 *
 * The authorization is deliberately the narrowest in the product: an
 * authenticated, onboarded account, reading through its own RLS-scoped client,
 * with an explicit `profile_id === user.id` comparison on top. There is no
 * team parameter, no facilitator state and no service-role client anywhere on
 * this path — a caller cannot ask for someone else's report because there is
 * no argument in which to name them, and the redundant ownership check means a
 * future policy edit cannot silently widen it.
 *
 * A miss returns null; every caller turns that into 404. Not-found and
 * not-yours are the same answer on purpose: probing ids should not reveal
 * which of the two it was.
 */

export type { ReportProduct };

export const REPORT_PRODUCTS: readonly ReportProduct[] = ["disc", "focus", "combined"] as const;

export function parseReportProduct(value: string): ReportProduct | null {
  return (REPORT_PRODUCTS as readonly string[]).includes(value) ? (value as ReportProduct) : null;
}

export interface OwnReport {
  document: ReportDocument;
  filename: string;
  /** The address on the participant's own account — the only default recipient. */
  accountEmail: string;
  context: AuthContext;
  /** Canonical web location of the same result. */
  webPath: string;
}

const DISC_COLUMNS =
  "id, profile_id, session_id, score_d, score_i, score_s, score_c, archetype_code, primary_dimension, secondary_dimension, created_at, result_insights (insight_snapshot)";
const FOCUS_COLUMNS =
  "id, profile_id, session_id, automaticity, distraction, mental_load, recovery, pattern_code, primary_loop, notification_pattern, energy_pattern, preferred_reset, created_at";

interface DiscRow {
  id: string;
  profile_id: string;
  session_id: string;
  score_d: number;
  score_i: number;
  score_s: number;
  score_c: number;
  archetype_code: string;
  primary_dimension: string;
  secondary_dimension: string | null;
  created_at: string;
  result_insights?: { insight_snapshot: unknown } | { insight_snapshot: unknown }[] | null;
}

interface FocusRow {
  id: string;
  profile_id: string;
  session_id: string;
  automaticity: number;
  distraction: number;
  mental_load: number;
  recovery: number;
  pattern_code: string;
  primary_loop: string;
  notification_pattern: string;
  energy_pattern: string;
  preferred_reset: string;
  created_at: string;
}

const snapshotOf = (row: DiscRow): ArchetypeInsight | undefined => {
  const nested = Array.isArray(row.result_insights) ? row.result_insights[0] : row.result_insights;
  return (nested?.insight_snapshot as ArchetypeInsight | undefined) ?? undefined;
};

const discScores = (row: DiscRow): DiscScores => ({
  d: row.score_d,
  i: row.score_i,
  s: row.score_s,
  c: row.score_c,
});

const focusResult = (row: FocusRow): FocusResult =>
  ({
    scores: {
      automaticity: row.automaticity,
      distraction: row.distraction,
      mentalLoad: row.mental_load,
      recovery: row.recovery,
    },
    patternCode: row.pattern_code,
    primaryLoop: row.primary_loop,
    notificationPattern: row.notification_pattern,
    energyPattern: row.energy_pattern,
    preferredReset: row.preferred_reset,
  }) as FocusResult;

/**
 * The participant's name as it should appear on their own report. The account
 * profile is the identity of record; a team display name is a facilitator's
 * roster label and is never authoritative here.
 */
export function reportParticipantName(profile: AuthContext["profile"]): string {
  return profile.full_name?.trim() || profile.preferred_name?.trim() || "Participant";
}

export async function loadOwnReport(
  product: ReportProduct,
  id: string,
): Promise<OwnReport | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const context = await requireOnboarded();
  const { supabase, user, profile } = context;
  const participantName = reportParticipantName(profile);

  const finish = (document: ReportDocument, webPath: string): OwnReport => ({
    document,
    filename: reportFilename(participantName, product),
    accountEmail: profile.email,
    context,
    webPath,
  });

  if (product === "disc") {
    const { data } = await supabase
      .from("assessment_results")
      .select(DISC_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    const row = data as DiscRow | null;
    if (!row || row.profile_id !== user.id) return null;
    return finish(
      buildDiscReport({
        participantName,
        completedAt: row.created_at,
        scores: discScores(row),
        archetypeCode: row.archetype_code as ArchetypeCode,
        primary: row.primary_dimension as Dimension,
        secondary: (row.secondary_dimension as Dimension | null) ?? null,
        insight: snapshotOf(row),
      }),
      `/app/results/${row.id}`,
    );
  }

  if (product === "focus") {
    const { data } = await supabase
      .from("focus_results")
      .select(FOCUS_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    const row = data as FocusRow | null;
    if (!row || row.profile_id !== user.id) return null;
    return finish(
      buildFocusReport({
        participantName,
        completedAt: row.created_at,
        focus: focusResult(row),
      }),
      `/focus/results/${row.id}`,
    );
  }

  const { data: combined } = await supabase
    .from("combined_sessions")
    .select("id, profile_id, disc_session_id, focus_session_id, updated_at, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!combined || combined.profile_id !== user.id) return null;
  if (!combined.disc_session_id || !combined.focus_session_id) return null;

  const [{ data: discData }, { data: focusData }] = await Promise.all([
    supabase.from("assessment_results").select(DISC_COLUMNS).eq("session_id", combined.disc_session_id).maybeSingle(),
    supabase.from("focus_results").select(FOCUS_COLUMNS).eq("session_id", combined.focus_session_id).maybeSingle(),
  ]);
  const discRow = discData as DiscRow | null;
  const focusRow = focusData as FocusRow | null;
  if (!discRow || !focusRow) return null;
  // Both halves are reached through the caller's own session ids, but assert
  // ownership on each row rather than inferring it from the join.
  if (discRow.profile_id !== user.id || focusRow.profile_id !== user.id) return null;

  return finish(
    buildCombinedReport({
      participantName,
      completedAt: focusRow.created_at,
      scores: discScores(discRow),
      archetypeCode: discRow.archetype_code as ArchetypeCode,
      primary: discRow.primary_dimension as Dimension,
      secondary: (discRow.secondary_dimension as Dimension | null) ?? null,
      insight: snapshotOf(discRow),
      focus: focusResult(focusRow),
    }),
    `/combined/results/${combined.id}`,
  );
}
