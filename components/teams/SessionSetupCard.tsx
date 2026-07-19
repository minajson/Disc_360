"use client";

import { useActionState, useState, useTransition } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import {
  setSessionState,
  updateSessionSetup,
  type SessionActionState,
} from "@/lib/actions/session";
import {
  ASSESSMENT_LABELS,
  SESSION_STATE_LABELS,
  canTransition,
  type AssessmentProduct,
  type PresentationAccess,
  type SessionMode,
  type SessionState,
} from "@/lib/teams/session";

/**
 * "Session setup" — the coach chooses the assessment, delivery mode and
 * presentation access, and drives the session state machine. Changing the
 * assessment after responses exist requires explicit confirmation (the
 * server enforces it; this card surfaces the confirmation).
 */

const initial: SessionActionState = { status: "idle", message: "" };

const ASSESSMENTS: AssessmentProduct[] = ["disc", "focus", "combined"];
const MODES: { id: SessionMode; label: string }[] = [
  { id: "facilitator_led", label: "Facilitator-led" },
  { id: "self_paced", label: "Self-paced" },
];
const ACCESS: { id: PresentationAccess; label: string }[] = [
  { id: "live_only", label: "Live only" },
  { id: "live_and_review", label: "Live and available for review" },
  { id: "review_after_session", label: "Available after session" },
];

const CONTROLS: { to: SessionState; label: string }[] = [
  { to: "presentation", label: "Start presentation" },
  { to: "assessment_open", label: "Open assessment" },
  { to: "assessment_closed", label: "Close assessment" },
  { to: "results", label: "Release results" },
  { to: "ended", label: "End session" },
];

function RadioRow<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            className={cn(
              "cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors",
              value === option.id
                ? "border-botanical bg-botanical text-mineral"
                : "border-hairline bg-paper text-slate hover:border-botanical hover:text-botanical",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SessionSetupCard({
  teamId,
  current,
}: {
  teamId: string;
  current: {
    assessment_type: AssessmentProduct;
    session_mode: SessionMode;
    session_state: SessionState;
    presentation_access: PresentationAccess;
  };
}) {
  const [assessment, setAssessment] = useState<AssessmentProduct>(current.assessment_type);
  const [mode, setMode] = useState<SessionMode>(current.session_mode);
  const [access, setAccess] = useState<PresentationAccess>(current.presentation_access);
  const [state, formAction, pending] = useActionState(
    updateSessionSetup.bind(null, teamId),
    initial,
  );
  const [controlMessage, setControlMessage] = useState<string | null>(null);
  const [controlPending, startControl] = useTransition();

  const runControl = (to: SessionState) => {
    setControlMessage(null);
    startControl(async () => {
      const result = await setSessionState(teamId, to);
      setControlMessage(result.status === "ok" ? null : result.message);
    });
  };

  return (
    <section aria-labelledby="session-setup-heading" className="paper-card flex flex-col gap-6 p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="session-setup-heading" className="font-display text-lg font-semibold">
          Session setup
        </h2>
        <span className="rounded-full bg-sage/30 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-botanical">
          {SESSION_STATE_LABELS[current.session_state]}
        </span>
      </div>

      <form action={formAction} className="flex flex-col gap-5">
        <RadioRow
          name="assessment_type"
          legend="Assessment"
          options={ASSESSMENTS.map((id) => ({ id, label: ASSESSMENT_LABELS[id] }))}
          value={assessment}
          onChange={setAssessment}
        />
        <RadioRow name="session_mode" legend="Delivery mode" options={MODES} value={mode} onChange={setMode} />
        <RadioRow
          name="presentation_access"
          legend="Presentation access"
          options={ACCESS}
          value={access}
          onChange={setAccess}
        />

        {state.status === "needs_confirmation" ? (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border-l-4 border-l-disc-i bg-sand/50 p-4">
            <p className="text-sm leading-relaxed text-ink">{state.message}</p>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="confirm_change" value="yes" className="size-4 accent-[var(--color-botanical)]" />
              I understand — change the assessment anyway.
            </label>
          </div>
        ) : null}
        {state.status === "error" ? (
          <p role="alert" className="text-sm text-disc-d">{state.message}</p>
        ) : null}
        {state.status === "ok" ? (
          <p role="status" className="text-sm text-botanical">{state.message}</p>
        ) : null}

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : "Save session setup"}
        </Button>
      </form>

      <div className="rule-t flex flex-col gap-3 pt-5">
        <span className="text-sm font-medium text-ink">Session controls</span>
        <div className="flex flex-wrap gap-2">
          {CONTROLS.map((control) => {
            const allowed = canTransition(current.session_state, control.to);
            return (
              <button
                key={control.to}
                type="button"
                disabled={!allowed || controlPending}
                onClick={() => runControl(control.to)}
                className={cn(
                  "rounded-full border px-4 py-2 font-mono text-xs transition-colors",
                  allowed
                    ? "border-hairline bg-paper text-slate hover:border-botanical hover:text-botanical"
                    : "cursor-not-allowed border-hairline/50 bg-paper text-faint opacity-50",
                )}
              >
                {control.label}
              </button>
            );
          })}
        </div>
        {controlMessage ? (
          <p role="alert" className="text-sm text-disc-d">{controlMessage}</p>
        ) : null}
      </div>
    </section>
  );
}
