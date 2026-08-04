"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils/cn";
import { CATEGORY_TITLE, type InsightCategory } from "@/lib/insights/facilitator";
import { NarrativeEditor } from "@/components/teams/insights/NarrativeEditor";
import {
  discardNarrative,
  generateNarrative,
  setNarrativeShared,
} from "@/lib/actions/ai-insights";
import type { Narrative } from "@/lib/ai/narrative";

/**
 * The facilitator's controls over the narrative layer.
 *
 * Nothing here happens automatically. A narrative is generated when a
 * facilitator asks for one, edited before it is used, and shared only by an
 * explicit act — and "shared" means with the people who already administer
 * this team. Participants have no route to this text at all.
 */

export interface NarrativeState {
  source: "model" | "rules" | "edited";
  status: "draft" | "shared";
  model: string | null;
  generatedAt: string;
  editedAt: string | null;
  sharedAt: string | null;
  fellBack: string[];
  /** True when results have changed since the prose was written. */
  stale: boolean;
}

/**
 * `fellBack` mixes part names ("brief") with insight categories ("snapshot").
 * A facilitator should read the same words the page uses for those sections.
 */
const partName = (part: string) =>
  CATEGORY_TITLE[part as InsightCategory]?.toLowerCase() ?? part;

const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function NarrativePanel({
  teamId,
  state,
  narrative,
  configured,
}: {
  teamId: string;
  state: NarrativeState | null;
  narrative: Narrative;
  configured: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setNotice(null);
      const result = await action();
      if (result.error) setNotice(result.error);
    });

  const written = state !== null;

  return (
    <section
      aria-label="Narrative controls"
      className="paper-card flex flex-col gap-5 p-6 lg:p-7 print:hidden"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
            Narrative
          </h3>
          <p className="text-sm leading-relaxed text-slate">
            {written
              ? "The wording below was written for this team's data. Every figure, sample size and evidence chip stays computed from the results — a narrative changes the language, never the finding."
              : "This page is written from the team's data by rule. You can ask for a narrative pass that rewrites the same findings in the language of a debrief — the numbers, evidence and sample sizes are unchanged."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => generateNarrative(teamId))}
            className="rounded-full bg-botanical px-5 py-2 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-faint"
          >
            {pending ? "Working…" : written ? "Regenerate" : "Generate narrative"}
          </button>
          {written ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => setEditing((value) => !value)}
                aria-expanded={editing}
                className="rounded-full border border-hairline px-5 py-2 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical disabled:opacity-50"
              >
                {editing ? "Close editor" : "Edit"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    setNarrativeShared({ teamId, shared: state.status !== "shared" }),
                  )
                }
                className={cn(
                  "rounded-full px-5 py-2 text-sm transition-colors disabled:opacity-50",
                  state.status === "shared"
                    ? "bg-sage/40 text-botanical"
                    : "border border-hairline text-slate hover:border-botanical hover:text-botanical",
                )}
              >
                {state.status === "shared" ? "Shared with facilitators" : "Share"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => discardNarrative(teamId))}
                className="rounded-full border border-hairline px-4 py-2 text-sm text-slate transition-colors hover:border-disc-d hover:text-disc-d disabled:opacity-50"
              >
                Discard
              </button>
            </>
          ) : null}
        </div>
      </div>

      {written ? (
        <dl className="grid gap-x-6 gap-y-2 rule-t pt-4 font-mono text-[10px] uppercase tracking-[0.12em] sm:grid-cols-[auto_1fr_auto_1fr]">
          <dt className="text-faint">Written by</dt>
          <dd className="text-slate">
            {state.source === "model"
              ? `AI · ${state.model ?? "model"}`
              : state.source === "edited"
                ? "AI, edited by a facilitator"
                : "Evidence rules"}
          </dd>
          <dt className="text-faint">Generated</dt>
          <dd className="text-slate">{stamp(state.generatedAt)}</dd>
          <dt className="text-faint">Status</dt>
          <dd className="text-slate">
            {state.status === "shared" ? "Shared with facilitators" : "Draft — not shared"}
          </dd>
          <dt className="text-faint">Participants</dt>
          <dd className="text-slate">Never shown this text</dd>
        </dl>
      ) : null}

      {written && state.fellBack.length > 0 ? (
        <p className="text-sm leading-relaxed text-slate">
          Kept the evidence-written version of: {state.fellBack.map(partName).join(", ")}.
          That part of the generation did not meet the platform&apos;s language rules.
        </p>
      ) : null}

      {written && state.stale ? (
        <p role="status" className="text-sm leading-relaxed text-disc-i">
          More results have landed since this narrative was written. The figures on
          this page are current; the wording is not. Regenerate to bring them back
          into line.
        </p>
      ) : null}

      {!configured ? (
        <p className="text-sm leading-relaxed text-slate">
          AI narration is not configured on this deployment. Generating will keep
          the evidence-written narrative, which is complete on its own.
        </p>
      ) : null}

      {notice ? (
        <p role="alert" className="text-sm leading-relaxed text-disc-d">
          {notice}
        </p>
      ) : null}

      {editing ? (
        <NarrativeEditor
          teamId={teamId}
          narrative={narrative}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </section>
  );
}
