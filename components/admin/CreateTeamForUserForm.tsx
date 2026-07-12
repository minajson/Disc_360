"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/auth/fields";
import {
  createTeamForUser,
  type AdminActionState,
} from "@/lib/actions/admin";

const initialState: AdminActionState = { status: "idle", message: "" };

export function CreateTeamForUserForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(createTeamForUser, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="user_id" value={userId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Team name" id="admin-team-name" name="team_name" required />
        <TextField label="Organization name" id="admin-org-name" name="organization_name" required />
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
        {pending ? "Creating…" : "Create team (comped)"}
      </Button>
    </form>
  );
}
