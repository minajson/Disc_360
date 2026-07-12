/**
 * Participant status ladder — pure and unit-tested.
 * invited → opened (account linked) → started (session in progress)
 * → completed (result exists) → report_sent (report email delivered/logged).
 */

export type ParticipantStatus =
  | "invited"
  | "opened"
  | "started"
  | "completed"
  | "report_sent";

export interface ParticipantSignals {
  /** The roster entry has been claimed by a signed-up account. */
  hasProfile: boolean;
  /** An assessment session is currently in progress. */
  hasOpenSession: boolean;
  /** A completed result exists. */
  hasResult: boolean;
  /** A report email has been sent (or dev-logged) to the participant. */
  reportEmailed: boolean;
}

export function deriveParticipantStatus(signals: ParticipantSignals): ParticipantStatus {
  if (signals.hasResult) {
    return signals.reportEmailed ? "report_sent" : "completed";
  }
  if (signals.hasOpenSession) return "started";
  if (signals.hasProfile) return "opened";
  return "invited";
}

export const participantStatusMeta: Record<
  ParticipantStatus,
  { label: string; tone: "neutral" | "blue" | "amber" | "green" | "teal" }
> = {
  invited: { label: "Invited", tone: "neutral" },
  opened: { label: "Opened", tone: "blue" },
  started: { label: "Started", tone: "amber" },
  completed: { label: "Completed", tone: "green" },
  report_sent: { label: "Report sent", tone: "teal" },
};
