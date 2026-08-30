"use client";

import { useState, useTransition } from "react";
import {
  setOrganisationSupportAction,
  type SupportActionResult,
} from "@/lib/actions/wellbeing-support";

/**
 * The two support routes, each switched on only when it can be reached.
 *
 * Nothing is pre-filled and nothing is suggested. A default support number
 * would be wrong for every organisation except the one it was typed for, and a
 * confidently wrong number is worse than an absent one.
 *
 * The switch is deliberately separate from the details: an organisation can
 * prepare a route, have it reviewed, and publish it in a second visit — rather
 * than the act of typing a number being what puts it in front of employees.
 */
export interface SupportSettingsValues {
  eapEnabled: boolean;
  eapProviderName: string;
  eapPhone: string;
  eapEmail: string;
  eapUrl: string;
  eapHours: string;
  ohEnabled: boolean;
  ohServiceName: string;
  ohPhone: string;
  ohEmail: string;
  ohUrl: string;
  ohHours: string;
  supportNote: string;
}

export function SupportSettingsForm({
  organizationId,
  initial,
}: {
  organizationId: string;
  initial: SupportSettingsValues;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SupportActionResult | null>(null);
  const [eapEnabled, setEapEnabled] = useState(initial.eapEnabled);
  const [ohEnabled, setOhEnabled] = useState(initial.ohEnabled);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("organization_id", organizationId);
    startTransition(async () => setResult(await setOrganisationSupportAction(formData)));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-7">
      <fieldset className="rounded-2xl border border-hairline bg-paper p-5 sm:p-6">
        <legend className="px-2 font-display text-[1.02rem] font-semibold text-ink">
          Employee Assistance Programme
        </legend>
        <Toggle
          name="eap_enabled"
          checked={eapEnabled}
          onChange={setEapEnabled}
          label="Show EAP details to participants"
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field name="eap_provider_name" label="Provider name" defaultValue={initial.eapProviderName} placeholder="e.g. the provider your people will recognise" />
          <Field name="eap_hours" label="When it is available" defaultValue={initial.eapHours} placeholder="e.g. 24 hours, every day" />
          <Field name="eap_phone" label="Phone" defaultValue={initial.eapPhone} inputMode="tel" />
          <Field name="eap_email" label="Email" defaultValue={initial.eapEmail} type="email" />
          <Field
            name="eap_url"
            label="Website"
            defaultValue={initial.eapUrl}
            placeholder="https://"
            hint="Must start with https://"
            className="sm:col-span-2"
          />
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-hairline bg-paper p-5 sm:p-6">
        <legend className="px-2 font-display text-[1.02rem] font-semibold text-ink">
          Occupational Health
        </legend>
        <Toggle
          name="oh_enabled"
          checked={ohEnabled}
          onChange={setOhEnabled}
          label="Show Occupational Health details to participants"
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field name="oh_service_name" label="Service name" defaultValue={initial.ohServiceName} />
          <Field name="oh_hours" label="When it is available" defaultValue={initial.ohHours} />
          <Field name="oh_phone" label="Phone" defaultValue={initial.ohPhone} inputMode="tel" />
          <Field name="oh_email" label="Email" defaultValue={initial.ohEmail} type="email" />
          <Field
            name="oh_url"
            label="Website"
            defaultValue={initial.ohUrl}
            placeholder="https://"
            hint="Must start with https://"
            className="sm:col-span-2"
          />
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs tracking-[0.12em] text-faint uppercase">
          One extra line (optional)
        </span>
        <textarea
          name="support_note"
          defaultValue={initial.supportNote}
          rows={3}
          maxLength={400}
          className="pulse-focus rounded-xl border border-hairline bg-paper px-4 py-3 text-sm text-ink"
          placeholder="e.g. You can also ask for the wellbeing team at reception."
        />
        <span className="text-xs leading-relaxed text-slate">
          How to get in touch — not guidance about anybody&rsquo;s answers. Anything that reads as
          clinical advice is refused when you save.
        </span>
      </label>

      {result && (
        <p
          role="status"
          className={`text-sm ${result.ok ? "text-pulse" : "text-pulse-attention"}`}
        >
          {result.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="pulse-focus w-fit rounded-full bg-pulse px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-pulse-deep disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save support routes"}
      </button>
    </form>
  );
}

function Toggle({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="mt-3 flex items-center gap-3">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="h-4 w-4 accent-[#1f4e5f]"
      />
      <span className="text-sm font-medium text-ink">{label}</span>
    </label>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  hint,
  type = "text",
  inputMode,
  className = "",
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  hint?: string;
  type?: string;
  inputMode?: "tel" | "text";
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs tracking-[0.12em] text-faint uppercase">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        inputMode={inputMode}
        className="pulse-focus rounded-xl border border-hairline bg-paper px-4 py-2.5 text-sm text-ink"
      />
      {hint && <span className="text-xs text-slate">{hint}</span>}
    </label>
  );
}
