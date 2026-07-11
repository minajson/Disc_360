"use client";

import { useActionState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { TextField, authInputClasses } from "@/components/auth/fields";
import { updateProfile, type SettingsState } from "@/lib/actions/settings";
import type { ProfileRow } from "@/lib/auth/guards";

const initialState: SettingsState = { status: "idle", message: "" };

export function ProfileSettingsForm({ profile }: { profile: ProfileRow }) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);
  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);

  return (
    <form action={formAction} className="paper-card flex flex-col gap-5 p-7 sm:p-8" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Full name" id="full_name" name="full_name" defaultValue={profile.full_name} required />
        <TextField label="Preferred name" id="preferred_name" name="preferred_name" defaultValue={profile.preferred_name} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Role or profession" id="profession" name="profession" defaultValue={profile.profession ?? ""} />
        <TextField label="Country" id="country" name="country" defaultValue={profile.country ?? ""} required />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="timezone" className="text-sm font-medium text-ink">
            Timezone
          </label>
          <select
            id="timezone"
            name="timezone"
            defaultValue={profile.timezone ?? "UTC"}
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

      {state.status !== "idle" ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={state.status === "error" ? "text-sm text-disc-d" : "text-sm text-botanical"}
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
