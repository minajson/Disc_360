"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { TextField, authInputClasses } from "@/components/auth/fields";
import {
  addMember,
  importMembers,
  updateMember,
  type ActionState,
} from "@/lib/actions/teams";

const initialState: ActionState = { status: "idle", message: "" };

function StateMessage({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={cn(
        "text-sm",
        state.status === "error" ? "text-disc-d" : "text-botanical",
      )}
    >
      {state.message}
    </p>
  );
}

export function AddMemberForm({ teamId }: { teamId: string }) {
  const [state, formAction, pending] = useActionState(addMember, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="team_id" value={teamId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Full name" id="add-name" name="display_name" required />
        <TextField label="Email" id="add-email" name="email" type="email" required />
        <TextField label="Department (optional)" id="add-dept" name="department" />
      </div>
      <StateMessage state={state} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Adding…" : "Add member & invite"}
      </Button>
    </form>
  );
}

export function ImportCsvForm({ teamId }: { teamId: string }) {
  const [state, formAction, pending] = useActionState(importMembers, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="team_id" value={teamId} />
      <label htmlFor="csv" className="text-sm font-medium text-ink">
        Bulk import (CSV)
      </label>
      <p className="text-xs text-slate">
        One person per line: <code className="font-mono">name, email, department</code> — department optional, header row allowed.
      </p>
      <textarea
        id="csv"
        name="csv"
        rows={5}
        placeholder={"Ada Lovelace, ada@example.com, Engineering\nGrace Hopper, grace@example.com"}
        className={cn(authInputClasses, "resize-y font-mono text-xs")}
        required
      />
      <StateMessage state={state} />
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        {pending ? "Importing…" : "Import members"}
      </Button>
    </form>
  );
}

interface EditableMember {
  id: string;
  display_name: string;
  email: string;
  department: string | null;
  role: string;
}

export function MemberEditor({
  teamId,
  member,
}: {
  teamId: string;
  member: EditableMember;
}) {
  const [state, formAction, pending] = useActionState(updateMember, initialState);
  return (
    <details className="group">
      <summary className="cursor-pointer list-none rounded-full border border-hairline px-3.5 py-1.5 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical">
        Edit
      </summary>
      <form
        action={formAction}
        className="absolute left-0 right-0 z-10 mt-2 flex flex-col gap-3 rounded-2xl border border-hairline bg-paper p-5 shadow-[0_24px_48px_-24px_rgba(23,32,29,0.35)]"
        noValidate
      >
        <input type="hidden" name="team_id" value={teamId} />
        <input type="hidden" name="member_id" value={member.id} />
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField
            label="Name"
            id={`name-${member.id}`}
            name="display_name"
            defaultValue={member.display_name}
            required
          />
          <TextField
            label="Department"
            id={`dept-${member.id}`}
            name="department"
            defaultValue={member.department ?? ""}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`role-${member.id}`} className="text-sm font-medium text-ink">
              Role
            </label>
            <select
              id={`role-${member.id}`}
              name="role"
              defaultValue={member.role}
              className={authInputClasses}
            >
              <option value="member">Member</option>
              <option value="team_admin">Team admin</option>
            </select>
          </div>
        </div>
        <StateMessage state={state} />
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
    </details>
  );
}
