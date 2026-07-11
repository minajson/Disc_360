"use client";

import { useActionState, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { TextField, authInputClasses } from "@/components/auth/fields";
import {
  completeCoachOnboarding,
  completeIndividualOnboarding,
  completeJoinOnboarding,
  completeTeamCreatorOnboarding,
  type OnboardingState,
} from "@/lib/actions/onboarding";

type Intent =
  | "understand_myself"
  | "create_team"
  | "join_team"
  | "manage_clients"
  | "setup_organization";

const intents: { id: Intent; title: string; detail: string }[] = [
  {
    id: "understand_myself",
    title: "Understand myself",
    detail: "Take the assessment and get your personal profile.",
  },
  {
    id: "create_team",
    title: "Create a team",
    detail: "Invite colleagues and map your team's culture.",
  },
  {
    id: "join_team",
    title: "Join a team",
    detail: "You received a team code or an invitation.",
  },
  {
    id: "manage_clients",
    title: "Manage coaching clients",
    detail: "Run assessments and debriefs across client teams.",
  },
  {
    id: "setup_organization",
    title: "Set up an organization",
    detail: "Roll DISC360 out across departments.",
  },
];

const initialState: OnboardingState = { status: "idle", message: "" };

interface OnboardingFlowProps {
  defaultFullName: string;
  defaultEmail: string;
  initialIntent?: string;
}

export function OnboardingFlow({
  defaultFullName,
  initialIntent,
}: OnboardingFlowProps) {
  const [intent, setIntent] = useState<Intent | null>(
    intents.some((option) => option.id === initialIntent)
      ? (initialIntent as Intent)
      : null,
  );

  return (
    <div className="flex w-full max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-display text-h2 font-semibold">
          What would you like to do?
        </h1>
        <p className="text-sm text-slate">
          You can do everything later — this just sets your starting point.
        </p>
      </div>

      <div role="radiogroup" aria-label="Onboarding path" className="grid gap-3 sm:grid-cols-2">
        {intents.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={intent === option.id}
            onClick={() => setIntent(option.id)}
            className={cn(
              "flex flex-col gap-1 rounded-2xl border bg-paper p-5 text-left transition-all duration-200",
              intent === option.id
                ? "border-botanical shadow-[0_16px_32px_-24px_rgba(23,76,60,0.5)]"
                : "border-hairline hover:border-hairline-strong",
            )}
          >
            <span className="font-display text-base font-semibold text-ink">
              {option.title}
            </span>
            <span className="text-xs leading-relaxed text-slate">{option.detail}</span>
          </button>
        ))}
      </div>

      {intent === "understand_myself" ? (
        <ProfileForm action={completeIndividualOnboarding} submitLabel="Continue to your dashboard" defaultFullName={defaultFullName} />
      ) : null}
      {intent === "manage_clients" ? (
        <ProfileForm action={completeCoachOnboarding} submitLabel="Set up my workspace" defaultFullName={defaultFullName} />
      ) : null}
      {intent === "join_team" ? (
        <ProfileForm
          action={completeJoinOnboarding}
          submitLabel="Join team"
          defaultFullName={defaultFullName}
          extraFields={
            <TextField
              label="Team code"
              id="team_code"
              name="team_code"
              placeholder="e.g. ATLAS-1002"
              required
            />
          }
        />
      ) : null}
      {intent === "create_team" || intent === "setup_organization" ? (
        <ProfileForm
          action={completeTeamCreatorOnboarding}
          submitLabel={intent === "create_team" ? "Create team" : "Create organization"}
          defaultFullName={defaultFullName}
          extraFields={
            <>
              <input type="hidden" name="intent_variant" value={intent === "setup_organization" ? "organization" : "team"} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Organization name" id="organization_name" name="organization_name" required />
                <TextField label="Industry (optional)" id="industry" name="industry" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Team name" id="team_name" name="team_name" required />
                <TextField label="Department (optional)" id="department" name="department" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="team_description" className="text-sm font-medium text-ink">
                  Team description (optional)
                </label>
                <textarea id="team_description" name="team_description" rows={2} className={cn(authInputClasses, "resize-y")} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField label="Approx. team size" id="approx_size" name="approx_size" type="number" min={2} max={500} />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="results_named" className="text-sm font-medium text-ink">
                    Result visibility
                  </label>
                  <select id="results_named" name="results_named" defaultValue="anonymized" className={authInputClasses}>
                    <option value="anonymized">Anonymized summaries</option>
                    <option value="named">Named results</option>
                  </select>
                </div>
                <TextField label="Deadline (optional)" id="deadline_at" name="deadline_at" type="date" />
              </div>
            </>
          }
        />
      ) : null}
    </div>
  );
}

function ProfileForm({
  action,
  submitLabel,
  defaultFullName,
  extraFields,
}: {
  action: (prev: OnboardingState, formData: FormData) => Promise<OnboardingState>;
  submitLabel: string;
  defaultFullName: string;
  extraFields?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const timezones = useMemo(
    () => Intl.supportedValuesOf("timeZone"),
    [],
  );
  const defaultTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  return (
    <form action={formAction} className="paper-card flex flex-col gap-5 p-7 sm:p-8" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Full name" id="full_name" name="full_name" defaultValue={defaultFullName} autoComplete="name" required />
        <TextField label="Preferred name" id="preferred_name" name="preferred_name" defaultValue={defaultFullName.split(" ")[0] ?? ""} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Role or profession (optional)" id="profession" name="profession" />
        <TextField label="Country" id="country" name="country" autoComplete="country-name" required />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="timezone" className="text-sm font-medium text-ink">
            Timezone
          </label>
          <select id="timezone" name="timezone" defaultValue={defaultTimezone} className={authInputClasses}>
            {timezones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>
      </div>

      {extraFields}

      <div className="flex flex-col gap-2.5 rule-t pt-4">
        <label className="flex items-start gap-3 text-sm text-slate">
          <input type="checkbox" name="consent" required className="mt-0.5 size-4 accent-[var(--color-botanical)]" />
          <span>
            I consent to DISC360 processing my assessment answers to build my
            behavioral profile, as described in the{" "}
            <a href="/privacy" target="_blank" className="underline hover:text-ink">privacy policy</a>. Required.
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-slate">
          <input type="checkbox" name="product_updates" className="mt-0.5 size-4 accent-[var(--color-botanical)]" />
          <span>Send me occasional product updates. Optional.</span>
        </label>
      </div>

      {state.status === "error" ? (
        <p role="alert" className="text-sm text-disc-d">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
