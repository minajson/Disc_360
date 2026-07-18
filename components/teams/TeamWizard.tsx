"use client";

import { useActionState, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { TextField, authInputClasses } from "@/components/auth/fields";
import {
  saveDraftStepOne,
  saveDraftStepTwo,
  type DraftState,
  type TeamDraft,
} from "@/lib/actions/team-drafts";
import { createTeamFromDraft } from "@/lib/actions/teams";
import type { ActionState } from "@/lib/actions/teams";

/**
 * The single team-creation journey.
 *
 * Every field lives here and nowhere else. Onboarding used to ask for team
 * details and then discard them at the paywall, so people typed everything
 * twice; that step now collects profile data only.
 *
 * Each step is committed to a server-side draft as the user advances, which is
 * what lets values survive sign-in, payment and a browser reload. Local state
 * mirrors the draft purely so Back is instant — the server copy is the source
 * of truth, and it is re-read on every page load.
 */

const STEPS = ["Team", "Assessment settings", "Review"] as const;

interface TeamWizardProps {
  draft: TeamDraft;
  /** Prefilled when the user already administers an organization. */
  defaultOrganizationName: string;
  isSuperAdmin: boolean;
}

const draftInitial: DraftState = { status: "idle", message: "" };
const createInitial: ActionState = { status: "idle", message: "" };

export function TeamWizard({
  draft,
  defaultOrganizationName,
  isSuperAdmin,
}: TeamWizardProps) {
  const [step, setStep] = useState(0);

  // Seeded from the server draft, then kept in sync as steps are saved.
  const [values, setValues] = useState<TeamDraft>({
    ...draft,
    organizationName: draft.organizationName || defaultOrganizationName,
  });

  const [stepOneState, saveStepOne, stepOnePending] = useActionState(
    async (prev: DraftState, formData: FormData) => {
      const result = await saveDraftStepOne(prev, formData);
      if (result.status === "idle") {
        setValues((current) => ({
          ...current,
          assessmentType: (formData.get("assessment_type") as typeof current.assessmentType) ?? "disc",
          teamName: String(formData.get("team_name") ?? ""),
          organizationName: String(formData.get("organization_name") ?? ""),
          sessionName: String(formData.get("session_name") ?? ""),
          department: String(formData.get("department") ?? ""),
          approximateSize: formData.get("approximate_size")
            ? Number(formData.get("approximate_size"))
            : null,
        }));
        setStep(1);
      }
      return result;
    },
    draftInitial,
  );

  const [stepTwoState, saveStepTwo, stepTwoPending] = useActionState(
    async (prev: DraftState, formData: FormData) => {
      const result = await saveDraftStepTwo(prev, formData);
      if (result.status === "idle") {
        setValues((current) => ({
          ...current,
          deadlineAt: String(formData.get("deadline_at") ?? ""),
          timezone: String(formData.get("timezone") ?? ""),
          resultsNamed: formData.get("results_named") === "named",
          membersCanViewSummary: formData.get("members_can_view_summary") === "on",
          participantLimit: formData.get("participant_limit")
            ? Number(formData.get("participant_limit"))
            : null,
        }));
        setStep(2);
      }
      return result;
    },
    draftInitial,
  );

  const [createState, create, creating] = useActionState(
    createTeamFromDraft,
    createInitial,
  );

  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);
  const detectedTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  return (
    <div className="flex flex-col gap-7">
      <ol className="flex items-center gap-2" aria-label="Progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              aria-current={index === step ? "step" : undefined}
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px]",
                index < step && "bg-botanical text-mineral",
                index === step && "bg-ink text-mineral",
                index > step && "border border-hairline text-faint",
              )}
            >
              {index + 1}
            </span>
            <span
              className={cn(
                "whitespace-nowrap text-xs",
                index === step ? "font-medium text-ink" : "text-faint",
              )}
            >
              {label}
            </span>
            {index < STEPS.length - 1 ? (
              <span className="h-px flex-1 bg-hairline" aria-hidden />
            ) : null}
          </li>
        ))}
      </ol>

      {/* ── Step 1 — team ── */}
      {step === 0 ? (
        <form action={saveStepOne} className="paper-card flex flex-col gap-5 p-7 sm:p-8" noValidate>
          <input type="hidden" name="draft_id" value={values.id} />

          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-1 text-sm font-medium text-ink">Assessment</legend>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {(
                [
                  { value: "disc", title: "DISC only", detail: "Behavioural style" },
                  { value: "focus", title: "Focus Pulse only", detail: "Attention & focus" },
                  { value: "combined", title: "Combined", detail: "DISC + Focus" },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer flex-col gap-0.5 rounded-2xl border p-4 transition-colors",
                    values.assessmentType === option.value
                      ? "border-botanical bg-sage/20"
                      : "border-hairline hover:border-hairline-strong",
                  )}
                >
                  <input
                    type="radio"
                    name="assessment_type"
                    value={option.value}
                    defaultChecked={values.assessmentType === option.value}
                    onChange={() =>
                      setValues((current) => ({ ...current, assessmentType: option.value }))
                    }
                    className="sr-only"
                  />
                  <span className="font-display text-base font-semibold text-ink">{option.title}</span>
                  <span className="text-xs text-slate">{option.detail}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Team name"
              id="wizard-team-name"
              name="team_name"
              defaultValue={values.teamName}
              required
            />
            <TextField
              label="Organization or company"
              id="wizard-org"
              name="organization_name"
              defaultValue={values.organizationName}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Session or event name (optional)"
              id="wizard-session"
              name="session_name"
              defaultValue={values.sessionName}
              placeholder="e.g. Q3 Leadership Offsite"
            />
            <TextField
              label="Department (optional)"
              id="wizard-dept"
              name="department"
              defaultValue={values.department}
            />
          </div>
          <TextField
            label="Approximate team size"
            id="wizard-size"
            name="approximate_size"
            type="number"
            min={2}
            max={500}
            defaultValue={values.approximateSize ?? ""}
          />

          {stepOneState.status === "error" ? (
            <p role="alert" className="text-sm text-disc-d">
              {stepOneState.message}
            </p>
          ) : null}

          <div className="flex justify-end rule-t pt-5">
            <Button type="submit" size="lg" disabled={stepOnePending}>
              {stepOnePending ? "Saving…" : "Continue"}
            </Button>
          </div>
        </form>
      ) : null}

      {/* ── Step 2 — assessment settings ── */}
      {step === 1 ? (
        <form action={saveStepTwo} className="paper-card flex flex-col gap-5 p-7 sm:p-8" noValidate>
          <input type="hidden" name="draft_id" value={values.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Completion deadline (optional)"
              id="wizard-deadline"
              name="deadline_at"
              type="date"
              defaultValue={values.deadlineAt}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="wizard-tz" className="text-sm font-medium text-ink">
                Timezone
              </label>
              <select
                id="wizard-tz"
                name="timezone"
                defaultValue={values.timezone || detectedTimezone}
                className={authInputClasses}
              >
                {timezones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="wizard-named" className="text-sm font-medium text-ink">
                Presentation
              </label>
              <select
                id="wizard-named"
                name="results_named"
                defaultValue={values.resultsNamed ? "named" : "anonymized"}
                className={authInputClasses}
              >
                <option value="anonymized">Anonymized summaries</option>
                <option value="named">Named results</option>
              </select>
            </div>
            <TextField
              label="Participant limit (optional)"
              id="wizard-limit"
              name="participant_limit"
              type="number"
              min={1}
              max={1000}
              defaultValue={values.participantLimit ?? ""}
            />
          </div>

          <label className="flex items-start gap-3 text-sm text-slate">
            <input
              type="checkbox"
              name="members_can_view_summary"
              defaultChecked={values.membersCanViewSummary}
              className="mt-0.5 size-4 accent-botanical"
            />
            <span>Participants can view the team summary</span>
          </label>

          {stepTwoState.status === "error" ? (
            <p role="alert" className="text-sm text-disc-d">
              {stepTwoState.message}
            </p>
          ) : null}

          <div className="flex items-center justify-between rule-t pt-5">
            <Button type="button" variant="ghost" onClick={() => setStep(0)}>
              ← Back
            </Button>
            <Button type="submit" size="lg" disabled={stepTwoPending}>
              {stepTwoPending ? "Saving…" : "Continue"}
            </Button>
          </div>
        </form>
      ) : null}

      {/* ── Step 3 — review ── */}
      {step === 2 ? (
        <form action={create} className="paper-card flex flex-col gap-5 p-7 sm:p-8">
          <input type="hidden" name="draft_id" value={values.id} />
          <h2 className="font-display text-h3 font-semibold">Review and create</h2>

          <dl className="flex flex-col gap-0 rule-t" data-testid="wizard-review">
            {(
              [
                [
                  "Assessment",
                  values.assessmentType === "combined"
                    ? "Combined DISC + Focus"
                    : values.assessmentType === "focus"
                      ? "Focus Pulse only"
                      : "DISC only",
                ],
                ["Team name", values.teamName],
                ["Organization", values.organizationName],
                ["Session", values.sessionName || "—"],
                ["Department", values.department || "—"],
                ["Approximate size", values.approximateSize ? String(values.approximateSize) : "—"],
                ["Deadline", values.deadlineAt || "No deadline"],
                ["Timezone", values.timezone || detectedTimezone],
                ["Presentation", values.resultsNamed ? "Named results" : "Anonymized summaries"],
                [
                  "Members can view summary",
                  values.membersCanViewSummary ? "Yes" : "No",
                ],
                [
                  "Participant limit",
                  values.participantLimit ? String(values.participantLimit) : "No limit",
                ],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-6 border-b border-hairline/60 py-2.5 last:border-0"
              >
                <dt className="text-sm text-slate">{label}</dt>
                <dd className="text-right text-sm font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <p className="text-xs leading-relaxed text-faint">
            {isSuperAdmin
              ? "Creating as platform admin — no entitlement is consumed."
              : "Your $8 Team plan will be applied to this team."}
          </p>

          {createState.status === "error" ? (
            <p role="alert" className="rounded-xl bg-disc-d-soft px-4 py-3 text-sm text-disc-d">
              {createState.message}
            </p>
          ) : null}

          <div className="flex items-center justify-between rule-t pt-5">
            <Button type="button" variant="ghost" onClick={() => setStep(1)} disabled={creating}>
              ← Back
            </Button>
            {/* Disabled while pending: the draft status transition is the real
                guard, but this stops the second click reaching the server. */}
            <Button type="submit" size="lg" disabled={creating}>
              {creating ? "Creating…" : "Create team"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
