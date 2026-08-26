"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  completeWellbeingPulse,
  saveWellbeingContext,
  saveWellbeingResponse,
} from "@/lib/actions/wellbeing";
import {
  WELLBEING_DEPARTMENT_LABEL,
  WELLBEING_SUB_UNIT_HELP,
  WELLBEING_SUB_UNIT_LABEL,
  WORK_LOCATIONS,
  type WorkLocation,
} from "@/data/wellbeing-taxonomy";
import { EMAIL_OPT_IN_HELP, EMAIL_OPT_IN_LABEL } from "@/data/wellbeing-content";
import type { WellbeingFormOptions, WellbeingItemView } from "@/lib/wellbeing/queries";

/**
 * The Wellbeing Pulse questionnaire.
 *
 * Mobile-first by construction: one item per screen, full-width option
 * targets, no horizontal scroll and no hover-dependent affordance. The
 * participant journey is overwhelmingly phone-based, so the phone layout is
 * the layout and the desktop one is the adaptation.
 *
 * Answers autosave to the server as they are chosen, so a dropped connection
 * or a closed tab costs at most the current item. Nothing is scored here — the
 * browser posts positions, and `completeWellbeingPulse` does the arithmetic
 * server-side from the stored rows.
 */

export interface PulseFlowProps {
  sessionId: string;
  /** Shown above every item. Empty for instruments that carry none. */
  instruction: string;
  items: WellbeingItemView[];
  options: WellbeingFormOptions;
  accountEmail: string;
  initial: {
    departmentName: string | null;
    subUnitName: string | null;
    workLocation: WorkLocation | null;
    officeLocationName: string | null;
    jobTitle: string | null;
    selfReportedFirstTime: boolean | null;
    emailOptIn: boolean;
    contactEmail: string | null;
    answers: Record<string, number>;
    currentIndex: number;
    contextComplete: boolean;
  };
}

const fieldClasses =
  "w-full rounded-xl border border-[rgba(31,78,95,0.22)] bg-paper px-4 py-3 text-[0.95rem] text-ink placeholder:text-faint focus:border-pulse focus:outline-none";

export function PulseFlow({
  sessionId,
  instruction,
  items,
  options,
  accountEmail,
  initial,
}: PulseFlowProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [stage, setStage] = useState<"context" | "items">(
    initial.contextComplete ? "items" : "context",
  );
  const [index, setIndex] = useState(Math.min(initial.currentIndex, items.length - 1));
  const [answers, setAnswers] = useState<Record<string, number>>(initial.answers);
  const [error, setError] = useState<string | null>(null);

  const [departmentName, setDepartmentName] = useState(initial.departmentName ?? "");
  const [subUnitName, setSubUnitName] = useState(initial.subUnitName ?? "");
  const [workLocation, setWorkLocation] = useState<WorkLocation | "">(initial.workLocation ?? "");
  const [officeLocationName, setOfficeLocationName] = useState(initial.officeLocationName ?? "");
  const [jobTitle, setJobTitle] = useState(initial.jobTitle ?? "");
  const [firstTime, setFirstTime] = useState<"" | "yes" | "no">(
    initial.selfReportedFirstTime === null || initial.selfReportedFirstTime === undefined
      ? ""
      : initial.selfReportedFirstTime
        ? "yes"
        : "no",
  );
  const [emailOptIn, setEmailOptIn] = useState(initial.emailOptIn);
  const [contactEmail, setContactEmail] = useState(initial.contactEmail ?? "");

  const answeredCount = Object.keys(answers).length;
  const officeRequired = workLocation === "office_based";

  const departmentId = useMemo(
    () => options.departments.find((entry) => entry.name === departmentName)?.id ?? null,
    [options.departments, departmentName],
  );

  /**
   * Sub-units offered for the chosen Department / Function.
   *
   * A sub-unit with no parent is cross-functional and is always offered. When
   * a department is chosen, its own sub-units are offered too — and if that
   * leaves nothing at all, the full list is shown rather than an empty select:
   * a catalogue that has not been parented yet is a configuration state, not a
   * reason to block somebody from answering.
   */
  const subUnitOptions = useMemo(() => {
    const unparented = options.subUnits.filter((entry) => entry.departmentId === null);
    if (!departmentId) return options.subUnits;
    const matching = options.subUnits.filter((entry) => entry.departmentId === departmentId);
    const narrowed = [...matching, ...unparented];
    return narrowed.length > 0 ? narrowed : options.subUnits;
  }, [options.subUnits, departmentId]);

  const subUnitId = useMemo(
    () => options.subUnits.find((entry) => entry.name === subUnitName)?.id ?? null,
    [options.subUnits, subUnitName],
  );

  const officeLocationId = useMemo(
    () => options.officeLocations.find((entry) => entry.name === officeLocationName)?.id ?? null,
    [options.officeLocations, officeLocationName],
  );

  function submitContext(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    // Sub-unit is a governed REQUIRED dimension, unconditionally.
    //
    // It used to be required only where a catalogue existed, which quietly
    // collected responses with a hole in a dimension the analytics compares
    // on. A campaign whose organisation has no sub-units does not reach a
    // participant at all now — `checkCampaignReadiness` refuses it — so by
    // the time this form renders there is always something to choose.
    if (!departmentName || !subUnitName || !workLocation) {
      setError("Please choose your Department / Function and Work Location.");
      return;
    }
    if (officeRequired && !officeLocationName) {
      setError("Please choose your Office Location.");
      return;
    }

    startTransition(async () => {
      const outcome = await saveWellbeingContext({
        sessionId,
        departmentId,
        departmentName,
        subUnitId,
        subUnitName,
        workLocation,
        // Field-based work sends nothing at all, rather than an empty string.
        officeLocationId: officeRequired ? officeLocationId : null,
        officeLocationName: officeRequired ? officeLocationName : null,
        jobTitle: jobTitle || null,
        selfReportedFirstTime: firstTime === "" ? null : firstTime === "yes",
        emailOptIn,
        contactEmail: contactEmail || null,
      });
      if (!outcome.ok) {
        setError(outcome.error ?? "Could not save your details.");
        return;
      }
      setStage("items");
    });
  }

  function choose(item: WellbeingItemView, position: number) {
    setError(null);
    setAnswers((current) => ({ ...current, [item.id]: position }));

    startTransition(async () => {
      const outcome = await saveWellbeingResponse({
        sessionId,
        itemId: item.id,
        position,
        itemIndex: index,
      });
      if (!outcome.ok) {
        setError(outcome.error ?? "Could not save that answer. Please try again.");
        // Roll the choice back so the screen never shows an answer the server
        // did not accept.
        setAnswers((current) => {
          const next = { ...current };
          delete next[item.id];
          return next;
        });
        return;
      }
      if (index < items.length - 1) setIndex(index + 1);
    });
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const outcome = await completeWellbeingPulse(sessionId);
      if (!outcome.ok || !outcome.resultId) {
        setError(outcome.error ?? "Could not finish your pulse.");
        return;
      }
      router.push(`/wellbeing/result/${outcome.resultId}`);
    });
  }

  /* ── context step ─────────────────────────────────────────────────── */

  if (stage === "context") {
    return (
      <form onSubmit={submitContext} className="pulse-card flex flex-col gap-6 p-6 sm:p-9">
        <div>
          <h2 className="font-display text-h3 font-semibold">A little about your role</h2>
          <p className="mt-2 text-sm text-slate">
            This is used only to group responses for reporting. Groups are never reported unless
            they are large enough that no one in them can be identified.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="wb-department" className="text-sm font-medium text-ink">
            {WELLBEING_DEPARTMENT_LABEL}
          </label>
          <select
            id="wb-department"
            required
            value={departmentName}
            onChange={(event) => {
              setDepartmentName(event.target.value);
              // Changing department can invalidate the chosen sub-unit.
              // Cleared here, in the event that caused it, rather than in an
              // effect reacting to it — the effect version re-rendered twice
              // and briefly showed a unit that no longer belonged.
              setSubUnitName("");
            }}
            className={fieldClasses}
          >
            <option value="">Select…</option>
            {options.departments.map((entry) => (
              <option key={entry.id} value={entry.name}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="wb-sub-unit" className="text-sm font-medium text-ink">
            {WELLBEING_SUB_UNIT_LABEL}
          </label>
          <select
            id="wb-sub-unit"
            required
            value={subUnitName}
            onChange={(event) => setSubUnitName(event.target.value)}
            className={fieldClasses}
          >
            <option value="">Select…</option>
            {subUnitOptions.map((entry) => (
              <option key={entry.id} value={entry.name}>
                {entry.name}
              </option>
            ))}
          </select>
          <p className="text-xs leading-relaxed text-slate">{WELLBEING_SUB_UNIT_HELP}</p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">Work Location</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {WORK_LOCATIONS.map((entry) => (
              <label
                key={entry.value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[0.95rem] transition-colors ${
                  workLocation === entry.value
                    ? "border-pulse bg-pulse-soft/50 font-medium text-pulse-deep"
                    : "border-[rgba(31,78,95,0.22)] bg-paper text-ink hover:border-pulse"
                }`}
              >
                <input
                  type="radio"
                  name="work_location"
                  value={entry.value}
                  checked={workLocation === entry.value}
                  onChange={() => {
                    setWorkLocation(entry.value);
                    // Moving to field-based clears any office already chosen,
                    // so a stale value can never be submitted or stored.
                    if (entry.value === "field_based") setOfficeLocationName("");
                  }}
                  className="h-4 w-4 accent-[#1f4e5f]"
                />
                {entry.label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Shown only for office-based work. Field-based respondents are never
            asked, and null is stored rather than a placeholder value. */}
        {officeRequired && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="wb-office" className="text-sm font-medium text-ink">
              Office Location
            </label>
            <select
              id="wb-office"
              required
              value={officeLocationName}
              onChange={(event) => setOfficeLocationName(event.target.value)}
              className={fieldClasses}
            >
              <option value="">Select…</option>
              {options.officeLocations.map((entry) => (
                <option key={entry.id} value={entry.name}>
                  {entry.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="wb-job" className="text-sm font-medium text-ink">
            Job Title <span className="font-normal text-slate">(optional)</span>
          </label>
          <input
            id="wb-job"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            maxLength={160}
            className={fieldClasses}
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">
            Is this your first time filling this form?
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ].map((entry) => (
              <label
                key={entry.value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[0.95rem] transition-colors ${
                  firstTime === entry.value
                    ? "border-pulse bg-pulse-soft/50 font-medium text-pulse-deep"
                    : "border-[rgba(31,78,95,0.22)] bg-paper text-ink hover:border-pulse"
                }`}
              >
                <input
                  type="radio"
                  name="first_time"
                  value={entry.value}
                  checked={firstTime === entry.value}
                  onChange={() => setFirstTime(entry.value as "yes" | "no")}
                  className="h-4 w-4 accent-[#1f4e5f]"
                />
                {entry.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-slate">
            Your previous pulses are kept either way — this answer is for reporting only.
          </p>
        </fieldset>

        <div className="flex flex-col gap-3 rounded-2xl border border-[rgba(31,78,95,0.16)] bg-pulse-mist/60 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={emailOptIn}
              onChange={(event) => setEmailOptIn(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#1f4e5f]"
            />
            <span className="text-[0.95rem] font-medium text-ink">{EMAIL_OPT_IN_LABEL}</span>
          </label>
          <p className="text-xs leading-relaxed text-slate">{EMAIL_OPT_IN_HELP}</p>
          {emailOptIn && (
            <input
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder={accountEmail || "you@example.com"}
              maxLength={254}
              className={fieldClasses}
              aria-label="Email address for your report"
            />
          )}
          {emailOptIn && accountEmail && !contactEmail && (
            <p className="text-xs text-slate">
              Leave blank to use your account address, {accountEmail}.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-pulse-attention">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="pulse-focus w-full rounded-full bg-pulse px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-pulse-deep disabled:opacity-60 sm:w-fit"
        >
          {pending ? "Saving…" : "Continue to the questions"}
        </button>
      </form>
    );
  }

  /* ── item step ────────────────────────────────────────────────────── */

  const item = items[index]!;
  const chosen = answers[item.id];
  const allAnswered = answeredCount === items.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-medium text-slate">
          <span className="font-mono">
            {index + 1} / {items.length}
          </span>
          <span>
            {answeredCount} of {items.length} answered
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-pulse-soft"
          role="progressbar"
          aria-valuenow={answeredCount}
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-label="Questions answered"
        >
          <div
            className="h-full rounded-full bg-pulse transition-[width] duration-300"
            style={{ width: `${(answeredCount / items.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="pulse-card flex flex-col gap-6 p-6 sm:p-9">
        {instruction && (
          <p className="text-sm leading-relaxed text-slate">{instruction}</p>
        )}
        <h2 className="font-display text-[clamp(1.25rem,3.5vw,1.6rem)] leading-snug font-semibold text-balance">
          {item.prompt}
        </h2>

        <div className="flex flex-col gap-2.5">
          {item.options.map((option) => {
            const selected = chosen === option.position;
            return (
              <button
                key={option.position}
                type="button"
                onClick={() => choose(item, option.position)}
                disabled={pending}
                aria-pressed={selected}
                className={`pulse-focus w-full rounded-2xl border px-5 py-4 text-left text-[0.98rem] leading-snug transition-colors disabled:opacity-70 ${
                  selected
                    ? "border-pulse bg-pulse-soft/60 font-medium text-pulse-deep"
                    : "border-[rgba(31,78,95,0.2)] bg-paper text-ink hover:border-pulse hover:bg-pulse-mist/60"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-pulse-attention">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setIndex(Math.max(0, index - 1))}
          disabled={index === 0 || pending}
          className="pulse-focus rounded-full border border-[rgba(31,78,95,0.22)] px-5 py-2.5 text-sm font-medium text-slate transition-colors hover:text-pulse disabled:opacity-40"
        >
          ← Back
        </button>

        {index < items.length - 1 ? (
          <button
            type="button"
            onClick={() => setIndex(index + 1)}
            disabled={chosen === undefined || pending}
            className="pulse-focus rounded-full border border-[rgba(31,78,95,0.22)] px-5 py-2.5 text-sm font-medium text-slate transition-colors hover:text-pulse disabled:opacity-40"
          >
            Next →
          </button>
        ) : null}

        {allAnswered && (
          <button
            type="button"
            onClick={finish}
            disabled={pending}
            className="pulse-focus ml-auto rounded-full bg-pulse px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-pulse-deep disabled:opacity-60"
          >
            {pending ? "Finishing…" : "See my result"}
          </button>
        )}
      </div>
    </div>
  );
}
