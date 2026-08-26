"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWellbeingCampaignAction } from "@/lib/actions/wellbeing-admin";

/**
 * Instrument-first campaign creation.
 *
 * An instrument whose content is not licensed is shown and disabled with its
 * reason, rather than hidden. A facilitator who cannot find GHQ-12 assumes the
 * product lacks it; one who sees it greyed out with "awaiting licence"
 * understands the actual position.
 */
export function NewCampaignForm({
  organizations,
  instruments,
}: {
  organizations: { id: string; name: string }[];
  instruments: {
    key: string;
    name: string;
    purpose: string;
    itemCount: number;
    minutes: string;
    available: boolean;
    reason: string | null;
  }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string>(
    instruments.find((i) => i.available)?.key ?? "",
  );

  if (organizations.length === 0) {
    return (
      <p className="mt-8 rounded-2xl border border-hairline bg-canvas px-5 py-4 text-sm text-slate">
        You do not hold Wellbeing Pulse governance in any organisation, so there is nowhere to
        create a campaign.
      </p>
    );
  }

  return (
    <form
      className="mt-9 flex flex-col gap-8"
      action={(formData) =>
        start(async () => {
          setError(null);
          const result = await createWellbeingCampaignAction(formData);
          if (!result.ok) setError(result.message);
          else if (result.redirectTo) router.push(result.redirectTo);
        })
      }
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-ink">Questionnaire</legend>
        {instruments.map((instrument) => (
          <label
            key={instrument.key}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-5 py-4 transition-colors ${
              chosen === instrument.key
                ? "border-pulse bg-pulse-soft/40"
                : "border-hairline bg-paper"
            } ${instrument.available ? "" : "cursor-not-allowed opacity-60"}`}
          >
            <input
              type="radio"
              name="instrument_key"
              value={instrument.key}
              checked={chosen === instrument.key}
              disabled={!instrument.available}
              onChange={() => setChosen(instrument.key)}
              className="mt-1 h-4 w-4 accent-[#1f4e5f]"
            />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-display text-base font-semibold text-ink">
                {instrument.name}
              </span>
              <span className="text-sm leading-relaxed text-slate">{instrument.purpose}</span>
              <span className="font-mono text-xs text-faint">
                {instrument.itemCount} items · {instrument.minutes}
              </span>
              {!instrument.available && instrument.reason && (
                <span className="mt-1 font-mono text-[10px] tracking-[0.1em] text-[#8d3520] uppercase">
                  {instrument.reason}
                </span>
              )}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="campaign-name" className="text-sm font-medium text-ink">
          Campaign name
        </label>
        <input
          id="campaign-name"
          name="name"
          required
          maxLength={120}
          placeholder="Management Pilot — GHQ-12"
          className="rounded-xl border border-[rgba(31,78,95,0.22)] bg-paper px-4 py-3 text-[0.95rem] text-ink"
        />
      </div>

      {organizations.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="campaign-org" className="text-sm font-medium text-ink">
            Organisation
          </label>
          <select
            id="campaign-org"
            name="organization_id"
            className="rounded-xl border border-[rgba(31,78,95,0.22)] bg-paper px-4 py-3 text-[0.95rem] text-ink"
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="organization_id" value={organizations[0]!.id} />
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="campaign-capacity" className="text-sm font-medium text-ink">
          Participant capacity <span className="text-faint">(optional)</span>
        </label>
        <input
          id="campaign-capacity"
          name="capacity"
          inputMode="numeric"
          placeholder="10"
          className="w-40 rounded-xl border border-[rgba(31,78,95,0.22)] bg-paper px-4 py-3 text-[0.95rem] text-ink"
        />
        <p className="text-xs leading-relaxed text-slate">
          Counts distinct people. Someone retaking their own pulse never uses a second place, and
          anyone already taking part can always finish. Leave blank for no limit.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-[rgba(194,74,46,0.08)] px-4 py-3 text-sm text-[#8d3520]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !chosen}
        className="pulse-focus w-fit rounded-full bg-pulse-deep px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-ink disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create campaign"}
      </button>
    </form>
  );
}
