"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/auth/fields";
import { joinAndStart, type JoinState } from "@/lib/actions/join";

const initialState: JoinState = { status: "idle", message: "" };

interface JoinFormProps {
  token: string;
  invitedEmail: string | null;
}

export function JoinForm({ token, invitedEmail }: JoinFormProps) {
  const [state, formAction, pending] = useActionState(joinAndStart, initialState);

  return (
    <form action={formAction} className="paper-card flex flex-col gap-4 p-7 sm:p-8" noValidate>
      <input type="hidden" name="token" value={token} />

      <TextField label="Full name" id="join-name" name="full_name" autoComplete="name" required />
      <TextField
        label="Email address"
        id="join-email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={invitedEmail ?? ""}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Job title (optional)" id="join-title" name="job_title" />
        <TextField label="Department (optional)" id="join-dept" name="department" />
      </div>
      <TextField
        label="Employee / reference ID (optional)"
        id="join-ref"
        name="reference_id"
      />

      <label className="flex items-start gap-3 rule-t pt-4 text-sm text-slate">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 size-4 accent-[var(--color-botanical)]"
        />
        <span>
          I consent to DISC360 processing my assessment answers to build my
          behavioral profile —{" "}
          <a href="/privacy" target="_blank" className="underline hover:text-ink">
            privacy policy
          </a>
          . Required.
        </span>
      </label>

      {state.status === "error" ? (
        <p role="alert" className="text-sm text-disc-d">
          {state.message}
        </p>
      ) : null}
      {state.status === "account_exists" ? (
        <div role="alert" className="flex flex-col gap-2 rounded-xl bg-sage/25 px-4 py-3">
          <p className="text-sm text-ink">{state.message}</p>
          <Link
            href={`/sign-in?next=/join/${token}`}
            className="text-sm font-medium text-botanical hover:underline"
          >
            Sign in to join this team →
          </Link>
        </div>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Setting things up…" : "Join team and start assessment"}
      </Button>
      <p className="text-center text-xs text-faint">
        Takes about seven minutes. Your answers autosave.
      </p>
    </form>
  );
}
