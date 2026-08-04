"use client";

import { useState, useTransition } from "react";
import { CATEGORY_TITLE, type InsightCategory } from "@/lib/insights/facilitator";
import { saveNarrativeEdits } from "@/lib/actions/ai-insights";
import type { Narrative } from "@/lib/ai/narrative";

/**
 * Facilitator editing, before anything is shared.
 *
 * Generated prose is a draft with the facilitator's name on the delivery, so
 * every line it writes is editable here. Saving revalidates on the server
 * against the same register rules the model was held to — the check is about
 * what the platform will display, not about who typed it.
 */

const field =
  "w-full rounded-xl border border-hairline bg-paper px-3.5 py-2.5 text-sm leading-relaxed text-ink transition-colors focus:border-botanical focus:outline-none";

function Lines({
  label,
  lines,
  onChange,
  rows = 2,
}: {
  label: string;
  lines: string[];
  onChange: (next: string[]) => void;
  rows?: number;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
        {label}
      </span>
      {lines.map((line, index) => (
        <textarea
          key={index}
          rows={rows}
          value={line}
          aria-label={`${label} ${index + 1}`}
          onChange={(event) => {
            const next = [...lines];
            next[index] = event.target.value;
            onChange(next);
          }}
          className={field}
        />
      ))}
    </div>
  );
}

export function NarrativeEditor({
  teamId,
  narrative,
  onClose,
}: {
  teamId: string;
  narrative: Narrative;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Narrative>(narrative);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveNarrativeEdits({ teamId, narrative: draft });
      if (result.ok) onClose();
      else setError(result.error ?? "Could not save your edits");
    });

  return (
    <section
      aria-label="Edit narrative"
      className="paper-card flex flex-col gap-7 p-6 lg:p-7 print:hidden"
    >
      <div className="flex flex-col gap-1.5">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
          Edit before sharing
        </h3>
        <p className="max-w-2xl text-sm leading-relaxed text-slate">
          Every line is yours to change. The measured figures, sample sizes and
          evidence chips are not editable — they are recomputed from the
          team&apos;s results each time this page loads.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-teal">
          Executive summary
        </span>
        <input
          type="text"
          value={draft.summary.headline}
          aria-label="Summary headline"
          onChange={(event) =>
            setDraft((d) => ({ ...d, summary: { ...d.summary, headline: event.target.value } }))
          }
          className={field}
        />
        <Lines
          label="Summary"
          rows={4}
          lines={draft.summary.paragraphs}
          onChange={(paragraphs) => setDraft((d) => ({ ...d, summary: { ...d.summary, paragraphs } }))}
        />
      </div>

      <div className="flex flex-col gap-3 rule-t pt-6">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-teal">
          Facilitator brief
        </span>
        <Lines
          label="Opening"
          rows={5}
          lines={[draft.brief.opening]}
          onChange={([opening]) =>
            setDraft((d) => ({ ...d, brief: { ...d.brief, opening: opening ?? "" } }))
          }
        />
        <Lines
          label="Observations"
          lines={draft.brief.observations}
          onChange={(observations) => setDraft((d) => ({ ...d, brief: { ...d.brief, observations } }))}
        />
        <Lines
          label="Questions for the room"
          lines={draft.brief.questions}
          onChange={(questions) => setDraft((d) => ({ ...d, brief: { ...d.brief, questions } }))}
        />
        <Lines
          label="Watch points"
          lines={draft.brief.watchPoints}
          onChange={(watchPoints) => setDraft((d) => ({ ...d, brief: { ...d.brief, watchPoints } }))}
        />
        <Lines
          label="Actions"
          lines={draft.brief.actions}
          onChange={(actions) => setDraft((d) => ({ ...d, brief: { ...d.brief, actions } }))}
        />
      </div>

      <div className="flex flex-col gap-6 rule-t pt-6">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-teal">
          Insight cards
        </span>
        {draft.cards.map((card, index) => (
          <div key={card.category} className="flex flex-col gap-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              {CATEGORY_TITLE[card.category as InsightCategory] ?? card.category}
            </span>
            <input
              type="text"
              value={card.headline}
              aria-label={`${card.category} headline`}
              onChange={(event) =>
                setDraft((d) => {
                  const cards = [...d.cards];
                  cards[index] = { ...card, headline: event.target.value };
                  return { ...d, cards };
                })
              }
              className={field}
            />
            <textarea
              rows={3}
              value={card.observation}
              aria-label={`${card.category} observation`}
              onChange={(event) =>
                setDraft((d) => {
                  const cards = [...d.cards];
                  cards[index] = { ...card, observation: event.target.value };
                  return { ...d, cards };
                })
              }
              className={field}
            />
            <Lines
              label="What this may mean"
              lines={card.interpretation}
              onChange={(interpretation) =>
                setDraft((d) => {
                  const cards = [...d.cards];
                  cards[index] = { ...card, interpretation };
                  return { ...d, cards };
                })
              }
            />
          </div>
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-sm leading-relaxed text-disc-d">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rule-t pt-5">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-full bg-botanical px-5 py-2 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-faint"
        >
          {pending ? "Saving…" : "Save edits"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-full border border-hairline px-5 py-2 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
