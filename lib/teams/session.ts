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
  cta:
    | "none"
    | "join_live"
    | "begin_assessment"
    | "continue_assessment"
    | "view_result"
    | "waiting";
}

/** What a participant's single session card shows for a given state. */
export function participantView(
  state: SessionState,
  progress: { hasOpenSession: boolean; hasResult: boolean },
): ParticipantSessionView {
  switch (state) {
    case "draft":
      return { status: "Your facilitator has not started the session yet.", cta: "none" };
    case "presentation":
      return { status: "Presentation in progress", cta: "join_live" };
    case "assessment_open":
      if (progress.hasResult) return { status: "Assessment submitted", cta: "waiting" };
      return {
        status: "Assessment open",
        cta: progress.hasOpenSession ? "continue_assessment" : "begin_assessment",
      };
    case "assessment_closed":
      return progress.hasResult
        ? { status: "Assessment submitted · waiting for facilitator", cta: "waiting" }
        : { status: "The assessment window is closed.", cta: "none" };
    case "results":
      return progress.hasResult
        ? { status: "Your result is ready", cta: "view_result" }
        : { status: "Results are released — you have no submission this session.", cta: "none" };
    case "ended":
      return progress.hasResult
        ? { status: "Session ended", cta: "view_result" }
        : { status: "Session ended", cta: "none" };
  }
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
