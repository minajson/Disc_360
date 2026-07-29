export type AssessmentProduct = "disc" | "focus" | "combined";

/**
 * Facilitator-led session model — pure and unit-tested. The coach moves a
 * team through a linear session; participants only ever see the state they
 * are in and the single assessment the coach selected.
 */

export type SessionMode = "self_paced" | "facilitator_led";
export type SessionState =
  | "draft"
  | "presentation"
  | "assessment_open"
  | "assessment_closed"
  | "results"
  | "ended";
export type PresentationAccess = "live_only" | "live_and_review" | "review_after_session";

export const ASSESSMENT_LABELS: Record<AssessmentProduct, string> = {
  disc: "DISC Behaviour Assessment",
  focus: "Focus & Digital Dopamine Pulse",
  combined: "Combined DISC + Focus",
};

export const SESSION_STATE_LABELS: Record<SessionState, string> = {
  draft: "Not started",
  presentation: "Presentation in progress",
  assessment_open: "Assessment open",
  assessment_closed: "Assessment closed",
  results: "Results released",
  ended: "Session ended",
};

/** Legal coach transitions — a linear session with a few honest reversals. */
const TRANSITIONS: Record<SessionState, SessionState[]> = {
  draft: ["presentation", "assessment_open"],
  presentation: ["assessment_open", "draft", "ended"],
  assessment_open: ["assessment_closed", "presentation"],
  assessment_closed: ["results", "assessment_open", "presentation"],
  results: ["ended", "assessment_open"],
  ended: ["draft"],
};

export function canTransition(from: SessionState, to: SessionState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Deterministic ordering when a participant belongs to several facilitated
 * teams: the session the coach is actively running always beats a stale
 * draft. Shared by the dashboard card and the assessment authorization so a
 * deep-link start binds to the same team the participant sees.
 */
export const SESSION_CARD_PRIORITY: Record<SessionState, number> = {
  presentation: 0,
  assessment_open: 1,
  assessment_closed: 2,
  results: 3,
  draft: 4,
  ended: 5,
};

/** Whether participants may open the deck in review mode right now. */
export function reviewAllowed(state: SessionState, access: PresentationAccess): boolean {
  if (access === "live_only") return false;
  if (access === "live_and_review") return state !== "draft";
  // review_after_session: only once the presentation phase is behind them
  return ["assessment_open", "assessment_closed", "results", "ended"].includes(state);
}

export interface ParticipantSessionView {
  /** Card headline status line. */
  status: string;
  /** Which primary call-to-action the card shows. */
  cta: "begin_assessment" | "continue_assessment" | "view_result" | "waiting";
  /** The deck is live right now — offer the join link alongside the CTA. */
  joinLive: boolean;
}

/**
 * What a participant's single session card shows. The assessment is ALWAYS
 * startable or resumable — the card is driven by the participant's own
 * progress. The facilitator's session_state only adds the live-deck link
 * while presenting and flips submitted attempts to results once released;
 * it never blocks entry.
 */
export function participantView(
  state: SessionState,
  progress: { hasOpenSession: boolean; hasResult: boolean },
): ParticipantSessionView {
  const joinLive = state === "presentation";
  const released = state === "results" || state === "ended";
  if (progress.hasResult) {
    return released
      ? { status: "Your result is ready", cta: "view_result", joinLive }
      : {
          status: "Assessment submitted · waiting for your facilitator to release results",
          cta: "waiting",
          joinLive,
        };
  }
  if (progress.hasOpenSession) {
    return { status: "Assessment in progress", cta: "continue_assessment", joinLive };
  }
  return {
    status: joinLive ? "Presentation in progress" : "Your assessment is ready",
    cta: "begin_assessment",
    joinLive,
  };
}

/** DISC360-<sanitized-team-name>-QR.png */
export function qrFilename(teamName: string): string {
  const sanitized = teamName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `DISC360-${sanitized || "team"}-QR.png`;
}
