"use client";

import { useState, useTransition } from "react";
import { setCampaignInstrumentAction, type AdminActionResult } from "@/lib/actions/wellbeing-admin";
import {
  INSTRUMENT_KEYS,
  INSTRUMENTS,
  type InstrumentKey,
  type InstrumentStatus,
  type ReleaseScope,
} from "@/data/wellbeing-instruments";

/**
 * The campaign questionnaire picker.
 *
 * ─────────────────────────────────────────────────────────────────────
 * IT SPEAKS THE FACILITATOR'S LANGUAGE, NOT THE SCHEMA'S.
 *
 * "Instrument", "pinned version", "changeable" and "derived state" are words
 * this codebase uses about itself. A facilitator running a wellbeing programme
 * needs three facts: which questionnaire this campaign asks, how long it is,
 * and whether it can still be changed. That is what this shows.
 *
 * Every label is still read from the registry — item counts, subscale counts —
 * so a change to a questionnaire's definition reaches this screen without
 * anyone remembering to update a string here.
 *
 * PROVENANCE LIVES SOMEWHERE ELSE.
 *
 * Licensing scope, content status and release conditions belong to whoever
 * decides what may be launched, and they had grown to dominate this panel. The
 * one governance fact that changes what a facilitator may do — "this may only
 * be used for internal testing" — stays, as a badge. The paragraph explaining
 * it moved to Compare questionnaires, which is the page for that question.
 *
 * The disabled state is a courtesy, not the control: `setCampaignInstrumentAction`
 * re-checks the licensing gate server-side, and the database refuses the
 * change once anybody has answered. A facilitator with dev tools gains nothing
 * by re-enabling a radio.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface InstrumentOption {
  key: InstrumentKey;
  status: InstrumentStatus;
  /** May this instrument be launched in THIS environment? */
  selectable: boolean;
  /** Facilitator-facing status line. */
  statusLabel: string;
  /** True when the instrument's own wording is committed, not only its slots. */
  contentLoaded: boolean;
  /**
   * How far the authorisation behind this instrument reaches.
   *
   * `selectable` above answers whether it may be launched HERE. This answers
   * whether launching it is a release — and the two stopped being the same
   * question when the third-party instruments were activated for authorised
   * internal user testing. A facilitator reading "Available" with nothing
   * beside it would reasonably conclude the instrument is cleared for their
   * customers, which for three of the four it is not.
   */
  releaseScope: ReleaseScope;
  /** The outstanding condition, in words a facilitator can act on. */
  releaseScopeNote: string;
}

export function InstrumentPicker({
  teamId,
  options,
  current,
  locked,
  currentName,
  currentItemCount,
}: {
  teamId: string;
  options: InstrumentOption[];
  current: InstrumentKey | null;
  /** True once anybody has answered — the questionnaire can no longer change. */
  locked: boolean;
  /** The questionnaire currently in force, for the locked summary. */
  currentName: string | null;
  currentItemCount: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<InstrumentKey | null>(current);
  const [result, setResult] = useState<AdminActionResult | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const formData = new FormData();
    formData.set("team_id", teamId);
    formData.set("instrument_key", selected);
    startTransition(async () => setResult(await setCampaignInstrumentAction(formData)));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {/*
        When the questionnaire is settled, the answer comes first and the list
        of alternatives does not appear at all. A locked campaign showing four
        greyed-out radio buttons asks the facilitator to work out which one is
        theirs from the disabled styling.
      */}
      {locked ? (
        <div className="rounded-2xl border border-[rgba(31,78,95,0.2)] bg-paper p-5">
          <p className="font-display text-h3 font-semibold tracking-tight text-ink">
            {currentName ?? "Questionnaire set"}
          </p>
          {currentItemCount !== null && (
            <p className="mt-1 text-sm text-slate">
              {currentItemCount} question{currentItemCount === 1 ? "" : "s"}
            </p>
          )}
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-pulse-watch">
            <LockGlyph />
            Locked because responses have begun.
          </p>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate">
            Changing it now would reinterpret answers people have already given. To run a
            different questionnaire, create a new campaign.
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-xs tracking-[0.14em] text-faint uppercase">Choose a questionnaire</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate">
            A campaign asks exactly one questionnaire. Participants never choose — the join link
            and QR code carry it. It locks as soon as the first person answers.
          </p>
        </div>
      )}

      <ul className={`flex-col gap-3 ${locked ? "hidden" : "flex"}`}>
        {INSTRUMENT_KEYS.map((key) => {
          const instrument = INSTRUMENTS[key];
          const option = options.find((entry) => entry.key === key)!;
          const disabled = locked || !option.selectable;
          const isSelected = selected === key;

          // Length line, built from the registry rather than written out.
          const detail = [
            `${instrument.itemCount} question${instrument.itemCount === 1 ? "" : "s"}`,
            instrument.subscales.length > 0
              ? `${instrument.subscales.length} subscales`
              : key === "disc360_wellbeing_v1"
                ? "6 dimensions"
                : null,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <li key={key}>
              <label
                className={`flex gap-3.5 rounded-2xl border p-4 transition-colors sm:p-5 ${
                  disabled
                    ? "cursor-not-allowed border-[rgba(31,78,95,0.12)] bg-pulse-mist/40 opacity-70"
                    : isSelected
                      ? "cursor-pointer border-pulse bg-pulse-soft/40"
                      : "cursor-pointer border-[rgba(31,78,95,0.2)] bg-paper hover:border-pulse"
                }`}
              >
                <input
                  type="radio"
                  name="instrument"
                  value={key}
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => setSelected(key)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#1f4e5f]"
                />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-display text-[1.02rem] font-semibold text-ink">
                    {instrument.name}
                  </span>
                  <span className="text-sm text-slate">{instrument.purpose}</span>
                  <span className="font-mono text-xs text-faint">{detail}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{
                        background: option.selectable
                          ? "var(--color-pulse-soft)"
                          : "var(--color-sand)",
                        color: option.selectable
                          ? "var(--color-pulse-deep)"
                          : "var(--color-slate)",
                      }}
                    >
                      {option.statusLabel}
                    </span>
                    {!option.contentLoaded && (
                      <span className="rounded-full border border-[rgba(138,106,47,0.4)] px-2.5 py-0.5 font-mono text-[10px] tracking-wide text-pulse-attention uppercase">
                        Demo structure only
                      </span>
                    )}
                    {option.releaseScope === "internal_test" && (
                      <span className="rounded-full border border-[rgba(138,106,47,0.4)] px-2.5 py-0.5 font-mono text-[10px] tracking-wide text-pulse-attention uppercase">
                        Internal testing only
                      </span>
                    )}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {result && (
        <p
          role="status"
          className={`text-sm ${result.ok ? "text-pulse" : "text-pulse-attention"}`}
        >
          {result.message}
        </p>
      )}

      {!locked && (
        <button
          type="submit"
          disabled={pending || !selected || selected === current}
          className="pulse-focus w-fit rounded-full bg-pulse px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-pulse-deep disabled:opacity-50"
        >
          {pending ? "Saving…" : "Use this questionnaire"}
        </button>
      )}
    </form>
  );
}

/** A small closed padlock. Paired with the word "Locked" — never on its own. */
function LockGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none">
      <rect x="3" y="7" width="10" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
