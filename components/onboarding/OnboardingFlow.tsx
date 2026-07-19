"use client";

import { useActionState, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { TextField, authInputClasses } from "@/components/auth/fields";
import {
  completeCoachOnboarding,
  completeIndividualOnboarding,
  completeInvitedOnboarding,
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

export interface OnboardingInvitation {
  token: string;
  teamName: string;
  presenterName: string | null;
  presenterTitle: string | null;
  /** "Today's session" label, e.g. "DISC Behaviour Assessment". */
  sessionLabel: string | null;
}

interface OnboardingFlowProps {
  defaultFullName: string;
  defaultEmail: string;
  initialIntent?: string;
  /** Present when the user arrived through a validated invitation token. */
  invitation?: OnboardingInvitation | null;
}

export function OnboardingFlow({
  defaultFullName,
  initialIntent,
  invitation = null,
}: OnboardingFlowProps) {
  const [intent, setIntent] = useState<Intent | null>(
    intents.some((option) => option.id === initialIntent)
      ? (initialIntent as Intent)
      : null,
  );

  if (invitation) {
    return <InvitedFlow invitation={invitation} defaultFullName={defaultFullName} />;
  }

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
        /*
         * Profile only — deliberately no team fields.
         *
         * This step used to collect organization name, team name, department,
         * size, visibility and deadline, and then throw all of it away at the
         * entitlement gate, leaving the user to retype every value into
         * /app/teams/new. Team details are now asked exactly once, by the
         * wizard, after the plan is settled.
         */
        <ProfileForm
          action={completeTeamCreatorOnboarding}
          submitLabel="Continue"
          defaultFullName={defaultFullName}
          extraFields={
            <>
              <input
                type="hidden"
                name="intent_variant"
                value={intent === "setup_organization" ? "organization" : "team"}
              />
              <p className="rule-t pt-4 text-sm leading-relaxed text-slate">
                Next you&rsquo;ll set up the team itself — name, size, deadline
                and how results are presented. We only need your own details
                here.
              </p>
            </>
          }
        />
      ) : null}
    </div>
  );
}

type InvitedPathway = "participant" | "coach" | "organization";

/**
 * Onboarding when the team is ALREADY resolved from a validated invitation
 * token: the invitation is summarised up top, the team code is never asked
 * for, and joining as a participant is the default path. Coach/organization
 * setup requires explicitly leaving the invitation first.
 */
function InvitedFlow({
  invitation,
  defaultFullName,
}: {
  invitation: OnboardingInvitation;
  defaultFullName: string;
}) {
  const [pathway, setPathway] = useState<InvitedPathway>("participant");
  const [leaveConfirmed, setLeaveConfirmed] = useState(false);

  const pathways: { id: InvitedPathway; title: string; detail: string }[] = [
    {
      id: "participant",
      title: "Join as participant",
      detail: `Take part in ${invitation.teamName}'s session.`,
    },
    { id: "coach", title: "Set up as coach", detail: "Run sessions for your own client teams." },
    {
      id: "organization",
      title: "Set up an organization",
      detail: "Roll DISC360 out across departments.",
    },
  ];
  const leavingPathway = pathway !== "participant";

  return (
    <div className="flex w-full max-w-2xl flex-col gap-8">
      {/* invitation summary */}
      <div className="paper-card flex flex-col gap-1.5 border-l-4 border-l-botanical p-6 text-left">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
          You are joining
        </span>
        <span className="font-display text-h3 font-semibold text-ink">{invitation.teamName}</span>
        {invitation.presenterName ? (
          <span className="text-sm text-slate">
            Facilitated by {invitation.presenterName}
            {invitation.presenterTitle ? ` · ${invitation.presenterTitle}` : ""}
          </span>
        ) : null}
        {invitation.sessionLabel ? (
          <span className="pt-1 text-sm text-slate">
            Today&rsquo;s session:{" "}
            <span className="font-medium text-ink">{invitation.sessionLabel}</span>
          </span>
        ) : null}
      </div>

      <div role="radiogroup" aria-label="Account pathway" className="grid gap-3 sm:grid-cols-3">
        {pathways.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={pathway === option.id}
            onClick={() => {
              setPathway(option.id);
              setLeaveConfirmed(false);
            }}
            className={cn(
              "flex flex-col gap-1 rounded-2xl border bg-paper p-5 text-left transition-all duration-200",
              pathway === option.id
                ? "border-botanical shadow-[0_16px_32px_-24px_rgba(23,76,60,0.5)]"
                : "border-hairline hover:border-hairline-strong",
            )}
          >
            <span className="font-display text-base font-semibold text-ink">{option.title}</span>
            <span className="text-xs leading-relaxed text-slate">{option.detail}</span>
          </button>
        ))}
      </div>

      {pathway === "participant" ? (
        <ProfileForm
          action={completeInvitedOnboarding}
          submitLabel={`Join ${invitation.teamName}`}
          defaultFullName={defaultFullName}
          extraFields={<input type="hidden" name="join_token" value={invitation.token} />}
        />
      ) : null}

      {leavingPathway && !leaveConfirmed ? (
        <div role="alert" className="paper-card flex flex-col gap-3 border-l-4 border-l-disc-i p-6">
          <p className="text-sm leading-relaxed text-ink">
            You opened an invitation to join{" "}
            <span className="font-semibold">{invitation.teamName}</span> as a participant.
            Continuing as a {pathway === "coach" ? "coach" : "organization administrator"} will
            leave this invitation.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => setLeaveConfirmed(true)}>
              Continue and leave the invitation
            </Button>
            <Button type="button" variant="outline" onClick={() => setPathway("participant")}>
              Stay and join {invitation.teamName}
            </Button>
          </div>
        </div>
      ) : null}

      {pathway === "coach" && leaveConfirmed ? (
        <ProfileForm
          action={completeCoachOnboarding}
          submitLabel="Set up my workspace"
          defaultFullName={defaultFullName}
        />
      ) : null}
      {pathway === "organization" && leaveConfirmed ? (
        <ProfileForm
          action={completeTeamCreatorOnboarding}
          submitLabel="Continue"
          defaultFullName={defaultFullName}
          extraFields={<input type="hidden" name="intent_variant" value="organization" />}
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
