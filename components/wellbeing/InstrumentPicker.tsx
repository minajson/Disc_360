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
 * The campaign instrument picker.
 *
 * Every label is read from the registry — item counts, subscale counts, status
 * wording — so a change to an instrument's definition reaches this screen
 * without anyone remembering to update a string here.
 *
 * The disabled state is a courtesy, not the control: `setCampaignInstrumentAction`
 * re-checks the licensing gate server-side, and the database refuses an
 * instrument change once attempts exist. A facilitator with dev tools gains
 * nothing by re-enabling a radio.
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
  attemptCount,
}: {
  teamId: string;
  options: InstrumentOption[];
  current: InstrumentKey | null;
  /** True once participants have begun — the instrument can no longer change. */
  locked: boolean;
  attemptCount: number;
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
      <div>
        <h2 className="text-xs tracking-[0.14em] text-faint uppercase">
          Select assessment instrument
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate">
          A campaign runs exactly one instrument. Participants never choose — the join link and
          QR code carry it.
        </p>
      </div>

      {locked && (
        <p className="rounded-2xl border border-[rgba(138,106,47,0.32)] bg-pulse-attention-soft/60 px-5 py-4 text-sm leading-relaxed text-ink">
          <strong className="font-medium">This campaign is locked.</strong>{" "}
          {attemptCount} participant {attemptCount === 1 ? "attempt has" : "attempts have"} already
          begun, so the instrument can no longer be changed — switching it would reinterpret
          results already collected. Create a new campaign to run a different instrument.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {INSTRUMENT_KEYS.map((key) => {
          const instrument = INSTRUMENTS[key];
          const option = options.find((entry) => entry.key === key)!;
          const disabled = locked || !option.selectable;
          const isSelected = selected === key;

          // Length line, built from the registry rather than written out.
          const detail = [
            `${instrument.itemCount} items`,
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
                      Status: {option.statusLabel}
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
                  {option.releaseScope === "internal_test" && (
                    <span className="mt-1 text-xs leading-relaxed text-slate">
                      {option.releaseScopeNote}
                    </span>
                  )}
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
          {pending ? "Saving…" : "Set instrument for this campaign"}
        </button>
      )}
    </form>
  );
}
