"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { TextField, authInputClasses } from "@/components/auth/fields";
import {
  archiveTeam,
  rotateInviteLink,
  updateTeamSettings,
  type ActionState,
} from "@/lib/actions/teams";

const initialState: ActionState = { status: "idle", message: "" };

interface TeamSettings {
  id: string;
  name: string;
  description: string;
  department: string | null;
  timezone: string | null;
  logo_url: string | null;
  results_named: boolean;
  members_can_view_summary: boolean;
  deadline_at: string | null;
}

export function TeamSettingsForm({ team }: { team: TeamSettings }) {
  const [state, formAction, pending] = useActionState(updateTeamSettings, initialState);

  return (
    <form action={formAction} className="paper-card flex flex-col gap-5 p-7 sm:p-8" noValidate>
      <input type="hidden" name="team_id" value={team.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Team name" id="team-name" name="name" defaultValue={team.name} required />
        <TextField label="Department" id="team-dept" name="department" defaultValue={team.department ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="team-description" className="text-sm font-medium text-ink">
          Description
        </label>
        <textarea
          id="team-description"
          name="description"
          rows={2}
          defaultValue={team.description}
          className={cn(authInputClasses, "resize-y")}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Timezone" id="team-tz" name="timezone" defaultValue={team.timezone ?? ""} placeholder="e.g. America/New_York" />
        <TextField label="Logo URL (https)" id="team-logo" name="logo_url" type="url" defaultValue={team.logo_url ?? ""} placeholder="https://…" />
        <TextField
          label="Completion deadline"
          id="team-deadline"
          name="deadline_at"
          type="date"
          defaultValue={team.deadline_at ? team.deadline_at.slice(0, 10) : ""}
        />
      </div>

      <div className="grid gap-4 rule-t pt-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="team-visibility" className="text-sm font-medium text-ink">
            Result visibility
          </label>
          <select
            id="team-visibility"
            name="results_named"
            defaultValue={team.results_named ? "named" : "anonymized"}
            className={authInputClasses}
          >
            <option value="anonymized">Anonymized summaries</option>
            <option value="named">Named results</option>
          </select>
          <p className="text-xs text-slate">
            Anonymized reports never show who is which dot.
          </p>
        </div>
        <label className="flex items-start gap-3 pt-7 text-sm text-slate">
          <input
            type="checkbox"
            name="members_can_view_summary"
            defaultChecked={team.members_can_view_summary}
            className="mt-0.5 size-4 accent-[var(--color-botanical)]"
          />
          <span>Members can view the team summary</span>
        </label>
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
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

export function TeamDangerZone({ teamId }: { teamId: string }) {
  const confirmAndRun = (message: string, run: () => void) => (event: React.FormEvent) => {
    if (!window.confirm(message)) event.preventDefault();
    else run();
  };

  return (
    <div className="paper-card flex flex-col gap-5 border-disc-d/30 p-7">
      <h2 className="font-display text-base font-semibold text-ink">
        Careful actions
      </h2>
      <div className="flex flex-wrap gap-3">
        <form
          action={rotateInviteLink.bind(null, teamId)}
          onSubmit={confirmAndRun(
            "Rotate the invitation link? The old link stops working immediately.",
            () => undefined,
          )}
        >
          <button
            type="submit"
            className="rounded-full border border-hairline px-5 py-2.5 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical"
          >
            Rotate invitation link
          </button>
        </form>
        <form
          action={archiveTeam.bind(null, teamId)}
          onSubmit={confirmAndRun(
            "Archive this team? Members keep their personal results; the team disappears from lists.",
            () => undefined,
          )}
        >
          <button
            type="submit"
            className="rounded-full border border-disc-d/40 px-5 py-2.5 text-sm text-disc-d transition-colors hover:bg-disc-d-soft"
          >
            Archive team
          </button>
        </form>
      </div>
    </div>
  );
}
