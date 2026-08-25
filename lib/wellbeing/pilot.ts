import "server-only";
import { createSupabaseAdminClient } from "@/lib/db/admin";

/**
 * Controlled pilot capacity — the application half of campaign governance.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THIS MODULE KNOWS NOTHING ABOUT WELLBEING.
 *
 * It answers one question — may another person join this campaign, and how
 * many places are left — and it must stay that way. No score, no threshold, no
 * dimension and no instrument reading passes through here, and the capacity
 * never travels the other way either: it is not an input to any figure the
 * product computes. `lib/wellbeing/isolation.test.ts` fails the build if a
 * scoring, analytics, history or report module so much as mentions it.
 *
 * The enforcement itself is in the database (migration 00031), not here.
 * What lives here is the courteous surface over it: a refusal a participant
 * can understand, and a status a facilitator can act on.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Shown to someone who arrives after the last place has gone. */
export const PILOT_CAPACITY_MESSAGE = "This pilot has reached its participant capacity.";

/**
 * The marker the trigger raises, matched instead of its prose.
 *
 * Matching the message text would make a reworded exception silently become an
 * unhandled database error in front of a participant.
 */
const PILOT_CAPACITY_HINT = "PILOT_CAPACITY_REACHED";

/** Whether a failed insert was the capacity control rather than a fault. */
export function isPilotCapacityError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { hint?: string | null; message?: string | null };
  if (candidate.hint === PILOT_CAPACITY_HINT) return true;
  // PostgREST does not always forward `hint`, so fall back to the marker
  // wherever it lands. Both are set by the same `raise`.
  return typeof candidate.message === "string" && candidate.message.includes(PILOT_CAPACITY_HINT);
}

export interface PilotStatus {
  /** Null when the campaign is unrestricted. */
  capacity: number | null;
  /** Distinct people who hold a place. */
  joined: number;
  /** Distinct people who have completed at least once. */
  completed: number;
  /** Distinct people yet to complete a first pulse. */
  inProgress: number;
  /** Null when unrestricted; never negative. */
  remaining: number | null;
  /** Whether a NEW participant would now be refused. */
  isFull: boolean;
}

/**
 * Reads a campaign's pilot state.
 *
 * Service role after the caller has been authorised as a team admin: the
 * counting function is SECURITY DEFINER because `wellbeing_sessions` is
 * own-row under RLS, and it returns four integers — never an identity.
 */
export async function readPilotStatus(teamId: string): Promise<PilotStatus> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.rpc("wellbeing_pilot_status", { p_team: teamId });

  const row = (Array.isArray(data) ? data[0] : data) as
    | { capacity: number | null; joined: number; completed: number; in_progress: number }
    | null
    | undefined;

  const capacity = row?.capacity ?? null;
  const joined = row?.joined ?? 0;

  return {
    capacity,
    joined,
    completed: row?.completed ?? 0,
    inProgress: row?.in_progress ?? 0,
    remaining: capacity === null ? null : Math.max(0, capacity - joined),
    isFull: capacity !== null && joined >= capacity,
  };
}
