"use client";

import { useState, useTransition } from "react";
import { setCampaignLifecycleAction } from "@/lib/actions/wellbeing-campaign";
import {
  controlsFor,
  joiningSummary,
  LIFECYCLE_DETAIL,
  LIFECYCLE_LABEL,
  readCapacity,
  type CampaignLifecycle,
  type LifecycleAction,
} from "@/lib/wellbeing/campaign-lifecycle";

/**
 * The campaign's operational state, and the control that changes it.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE THREE THINGS A FACILITATOR MUST ALWAYS SEE.
 *
 *   1 · what state the campaign is in
 *   2 · whether participants can join right now
 *   3 · the one action that changes it
 *
 * Production had none of them: a status line derived from the wrong column,
 * no statement about joining, and no control. So all three are on one card,
 * in that order, above everything else on the page.
 *
 * CONFIRMATION IS INLINE, NOT A DIALOG.
 *
 * `window.confirm` is unstyled, unlabelled for screen readers beyond its own
 * text, and blocks the page. The destructive actions swap the row for a
 * question and two buttons, which keeps the campaign's state visible while the
 * facilitator decides — the thing they are actually confirming.
 * ─────────────────────────────────────────────────────────────────────
 */
export function LifecyclePanel({
  teamId,
  lifecycle,
  capacity,
  joined,
  pausedAt,
  closedAt,
}: {
  teamId: string;
  lifecycle: CampaignLifecycle;
  capacity: number | null;
  joined: number;
  pausedAt: string | null;
  closedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<LifecycleAction | null>(null);
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null);

  const controls = controlsFor(lifecycle);
  const places = readCapacity(capacity, joined);
  const open = lifecycle === "open";

  function run(action: LifecycleAction) {
    setConfirming(null);
    setOutcome(null);
    const formData = new FormData();
    formData.set("team_id", teamId);
    formData.set("lifecycle_action", action);
    startTransition(async () => {
      const result = await setCampaignLifecycleAction(formData);
      setOutcome(result);
    });
  }

  const pendingControl = controls.find((control) => control.action === confirming);

  return (
    <section
      aria-label="Campaign status"
      className={`rounded-2xl border p-5 sm:p-6 ${
        open
          ? "border-[rgba(31,78,95,0.22)] bg-[rgba(31,78,95,0.045)]"
          : "border-hairline bg-paper"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                open ? "bg-pulse" : lifecycle === "paused" ? "bg-pulse-watch" : "bg-faint"
              }`}
            />
            <h2 className="font-display text-h3 font-semibold tracking-tight text-ink">
              {LIFECYCLE_LABEL[lifecycle]}
            </h2>
          </div>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate">
            {LIFECYCLE_DETAIL[lifecycle]}
          </p>
          <p className="sr-only">{joiningSummary(lifecycle)}</p>

          <dl className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate">
            <div className="flex items-center gap-2">
              <dt className="font-mono tracking-[0.12em] text-faint uppercase">Places</dt>
              <dd className="font-medium text-ink">{places.label}</dd>
            </div>
            {lifecycle === "paused" && pausedAt && (
              <div className="flex items-center gap-2">
                <dt className="font-mono tracking-[0.12em] text-faint uppercase">Paused</dt>
                <dd className="font-medium text-ink">{formatDay(pausedAt)}</dd>
              </div>
            )}
            {(lifecycle === "closed" || lifecycle === "archived") && closedAt && (
              <div className="flex items-center gap-2">
                <dt className="font-mono tracking-[0.12em] text-faint uppercase">Closed</dt>
                <dd className="font-medium text-ink">{formatDay(closedAt)}</dd>
              </div>
            )}
          </dl>
        </div>

        {controls.length > 0 && !pendingControl && (
          <div className="flex flex-wrap items-center gap-2.5">
            {controls.map((control) => (
              <button
                key={control.action}
                type="button"
                disabled={pending}
                onClick={() =>
                  control.confirm ? setConfirming(control.action) : run(control.action)
                }
                className={
                  control.primary
                    ? "pulse-focus rounded-full bg-pulse px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pulse-deep disabled:opacity-60"
                    : "pulse-focus rounded-full border border-[rgba(31,78,95,0.24)] px-5 py-2.5 text-sm font-medium text-pulse transition-colors hover:border-pulse disabled:opacity-60"
                }
              >
                {pending ? "Working…" : control.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {pendingControl && (
        <div className="mt-5 rounded-xl border border-[rgba(31,78,95,0.2)] bg-mineral p-4">
          <p className="text-sm leading-relaxed text-ink">{pendingControl.confirm}</p>
          <div className="mt-3.5 flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(pendingControl.action)}
              className="pulse-focus rounded-full bg-pulse px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pulse-deep disabled:opacity-60"
            >
              {pendingControl.label}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="pulse-focus rounded-full border border-hairline px-5 py-2.5 text-sm font-medium text-slate transition-colors hover:text-pulse-deep"
            >
              Keep as it is
            </button>
          </div>
        </div>
      )}

      {outcome && (
        <p
          role="status"
          className={`mt-4 text-sm ${outcome.ok ? "text-pulse" : "text-pulse-attention"}`}
        >
          {outcome.message}
        </p>
      )}
    </section>
  );
}

function formatDay(at: string): string {
  return new Date(at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
