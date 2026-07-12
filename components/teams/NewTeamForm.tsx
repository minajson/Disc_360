"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { TextField, authInputClasses } from "@/components/auth/fields";
import { createTeam, type ActionState } from "@/lib/actions/teams";

const initialState: ActionState = { status: "idle", message: "" };

interface NewTeamFormProps {
  /** Prefilled from the user's existing organization, if any. */
  defaultOrganizationName: string;
}

export function NewTeamForm({ defaultOrganizationName }: NewTeamFormProps) {
  const [state, formAction, pending] = useActionState(createTeam, initialState);

  return (
    <form action={formAction} className="paper-card flex flex-col gap-5 p-7 sm:p-8" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Team name" id="new-team-name" name="name" required />
        <TextField
          label="Organization or company"
          id="new-team-org"
          name="organization_name"
          defaultValue={defaultOrganizationName}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Event or session name (optional)"
          id="new-team-session"
          name="session_name"
          placeholder="e.g. Q3 Leadership Offsite"
        />
        <TextField label="Department (optional)" id="new-team-dept" name="department" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-team-description" className="text-sm font-medium text-ink">
          Description (optional)
        </label>
        <textarea id="new-team-description" name="description" rows={2} className={cn(authInputClasses, "resize-y")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <TextField label="Team size" id="new-team-size" name="approx_size" type="number" min={2} max={500} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-team-visibility" className="text-sm font-medium text-ink">
            Presentation preference
          </label>
          <select id="new-team-visibility" name="results_named" defaultValue="anonymized" className={authInputClasses}>
            <option value="anonymized">Anonymized</option>
            <option value="named">Named</option>
          </select>
        </div>
        <TextField label="Deadline (optional)" id="new-team-deadline" name="deadline_at" type="date" />
        <TextField label="Timezone (optional)" id="new-team-tz" name="timezone" placeholder="America/New_York" />
      </div>
      <label className="flex items-start gap-3 text-sm text-slate">
        <input
          type="checkbox"
          name="members_can_view_summary"
          defaultChecked
          className="mt-0.5 size-4 accent-[var(--color-botanical)]"
        />
        <span>Participants can view the team summary</span>
      </label>

      {state.status === "error" ? (
        <p role="alert" className="text-sm text-disc-d">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Creating…" : "Create team"}
      </Button>
    </form>
  );
}
