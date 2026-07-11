"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import {
  updateNotificationPreferences,
  type SettingsState,
} from "@/lib/actions/settings";

const initialState: SettingsState = { status: "idle", message: "" };

interface Prefs {
  assessment_reminders: boolean;
  team_updates: boolean;
  report_notifications: boolean;
  product_updates: boolean;
}

const options: { name: keyof Prefs; label: string; detail: string }[] = [
  {
    name: "assessment_reminders",
    label: "Assessment reminders",
    detail: "Nudges before campaign deadlines you haven't completed.",
  },
  {
    name: "team_updates",
    label: "Team updates",
    detail: "Campaign invitations and team activity that involves you.",
  },
  {
    name: "report_notifications",
    label: "Report notifications",
    detail: "A note when a new report of yours is ready.",
  },
  {
    name: "product_updates",
    label: "Product communications",
    detail: "Occasional product news. Off by default.",
  },
];

export function NotificationPrefsForm({ prefs }: { prefs: Prefs }) {
  const [state, formAction, pending] = useActionState(
    updateNotificationPreferences,
    initialState,
  );

  return (
    <form action={formAction} className="paper-card flex flex-col gap-5 p-7 sm:p-8" noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-base font-semibold">Email notifications</h2>
        <p className="text-xs text-slate">
          Essential account email (verification, security) is always delivered.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {options.map((option) => (
          <label key={option.name} className="flex items-start gap-3">
            <input
              type="checkbox"
              name={option.name}
              defaultChecked={prefs[option.name]}
              className="mt-1 size-4 accent-[var(--color-botanical)]"
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-ink">{option.label}</span>
              <span className="text-xs text-slate">{option.detail}</span>
            </span>
          </label>
        ))}
      </div>
      {state.status !== "idle" ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={cn("text-sm", state.status === "error" ? "text-disc-d" : "text-botanical")}
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save preferences"}
      </Button>
    </form>
  );
}
