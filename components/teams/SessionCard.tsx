import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { startAssessment } from "@/lib/actions/assessment";
import { startFocusAssessment } from "@/lib/actions/focus";
import { startCombinedAssessment } from "@/lib/actions/combined";
import {
  ASSESSMENT_LABELS,
  participantView,
  reviewAllowed,
  type AssessmentProduct,
  type PresentationAccess,
  type SessionState,
} from "@/lib/teams/session";

/**
 * The single card a facilitator-led participant sees: today's session, its
 * state, and exactly one primary action. No product catalogue, no other
 * assessments — the coach decides what runs.
 */

const START_ACTIONS: Record<AssessmentProduct, () => Promise<void>> = {
  disc: startAssessment,
  focus: startFocusAssessment,
  combined: startCombinedAssessment,
};

export interface SessionProgress {
  hasOpenSession: boolean;
  hasResult: boolean;
  continueHref: string | null;
  resultHref: string | null;
}

export function SessionCard({
  team,
  progress,
}: {
  team: {
    id: string;
    name: string;
    assessment_type: AssessmentProduct;
    session_state: SessionState;
    presentation_access: PresentationAccess;
  };
  progress: SessionProgress;
}) {
  const view = participantView(team.session_state, progress);
  const review = reviewAllowed(team.session_state, team.presentation_access);
  const label = ASSESSMENT_LABELS[team.assessment_type];

  return (
    <section aria-label="Today's session" className="paper-card flex flex-col gap-4 p-7">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
          Today&rsquo;s session · {team.name}
        </span>
        <h2 className="font-display text-h3 font-semibold text-ink">{label}</h2>
        <p className="text-sm text-slate">{view.status}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {view.cta === "join_live" ? (
          <LinkButton href={`/app/teams/${team.id}/live`} size="lg">
            Join live presentation
          </LinkButton>
        ) : null}

        {view.cta === "begin_assessment" ? (
          <form action={START_ACTIONS[team.assessment_type]}>
            <Button type="submit" size="lg">
              Begin assessment
            </Button>
          </form>
        ) : null}

        {view.cta === "continue_assessment" && progress.continueHref ? (
          <LinkButton href={progress.continueHref} size="lg">
            Continue assessment
          </LinkButton>
        ) : null}

        {view.cta === "view_result" && progress.resultHref ? (
          <LinkButton href={progress.resultHref} size="lg">
            View result
          </LinkButton>
        ) : null}

        {view.cta === "waiting" ? (
          <span className="inline-flex min-h-11 items-center rounded-full bg-sand/70 px-5 font-mono text-xs uppercase tracking-[0.14em] text-ink">
            Waiting for facilitator
          </span>
        ) : null}

        {review ? (
          <Link
            href={`/app/teams/${team.id}/live?mode=review`}
            className="inline-flex min-h-11 items-center rounded-full border border-hairline bg-paper px-5 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical"
          >
            Review presentation
          </Link>
        ) : null}
      </div>
    </section>
  );
}
