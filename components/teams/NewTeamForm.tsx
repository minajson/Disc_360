"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { TextField, authInputClasses } from "@/components/auth/fields";
import { createTeam, type ActionState } from "@/lib/actions/teams";

const initialState: ActionState = { status: "idle", message: "" };

interface OrgOption {
  id: string;
  name: string;
}

export function NewTeamForm({ organizations }: { organizations: OrgOption[] }) {
  const [state, formAction, pending] = useActionState(createTeam, initialState);

  return (
    <form action={formAction} className="paper-card flex flex-col gap-5 p-7 sm:p-8" noValidate>
      {organizations.length === 1 ? (
        <input type="hidden" name="organization_id" value={organizations[0]!.id} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-team-org" className="text-sm font-medium text-ink">
            Organization
          </label>
          <select id="new-team-org" name="organization_id" className={authInputClasses}>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Team name" id="new-team-name" name="name" required />
        <TextField label="Department (optional)" id="new-team-dept" name="department" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-team-description" className="text-sm font-medium text-ink">
          Description (optional)
        </label>
        <textarea id="new-team-description" name="description" rows={2} className={cn(authInputClasses, "resize-y")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <TextField label="Approx. size" id="new-team-size" name="approx_size" type="number" min={2} max={500} />
        <TextField label="Timezone" id="new-team-tz" name="timezone" placeholder="America/New_York" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-team-visibility" className="text-sm font-medium text-ink">
            Result visibility
          </label>
          <select id="new-team-visibility" name="results_named" defaultValue="anonymized" className={authInputClasses}>
            <option value="anonymized">Anonymized</option>
            <option value="named">Named</option>
          </select>
        </div>
        <TextField label="Deadline (optional)" id="new-team-deadline" name="deadline_at" type="date" />
      </div>
      <label className="flex items-start gap-3 text-sm text-slate">
        <input
          type="checkbox"
          name="members_can_view_summary"
          defaultChecked
          className="mt-0.5 size-4 accent-[var(--color-botanical)]"
        />
        <span>Members can view the team summary</span>
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
