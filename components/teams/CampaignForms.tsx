"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { TextField, authInputClasses } from "@/components/auth/fields";
import { createCampaign } from "@/lib/actions/campaigns";
import type { ActionState } from "@/lib/actions/teams";

const initialState: ActionState = { status: "idle", message: "" };

export function CreateCampaignForm({ teamId }: { teamId: string }) {
  const [state, formAction, pending] = useActionState(createCampaign, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="team_id" value={teamId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Campaign name" id="campaign-name" name="name" required />
        <TextField label="Start date (optional)" id="campaign-start" name="starts_at" type="date" />
        <TextField label="Deadline (optional)" id="campaign-deadline" name="deadline_at" type="date" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="campaign-message" className="text-sm font-medium text-ink">
          Invitation message (optional)
        </label>
        <textarea
          id="campaign-message"
          name="invitation_message"
          rows={2}
          placeholder="Please complete before the offsite — it takes about seven minutes."
          className={cn(authInputClasses, "resize-y")}
        />
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
        {pending ? "Creating…" : "Create draft campaign"}
      </Button>
    </form>
  );
}
