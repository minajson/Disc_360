"use client";

import { useState, useTransition } from "react";
import { changeSignInEmail } from "@/lib/actions/identity";

/**
 * Change sign-in email — for an address nobody has used before.
 *
 * The address is typed twice, and nothing moves when the administrator
 * submits: a verification link goes to the new address and `auth.users.email`
 * changes only when the participant follows it. Until then they keep signing
 * in exactly as they do now, which is why this can be offered without any risk
 * of locking someone out of their own history.
 */
export function ChangeEmailPanel({
  profileId,
  currentEmail,
}: {
  profileId: string;
  currentEmail: string;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    start(async () => {
      const outcome = await changeSignInEmail({ profileId, newEmail, confirmEmail });
      setResult(outcome);
      if (outcome.ok) {
        setNewEmail("");
        setConfirmEmail("");
      }
    });
  };

  const field =
    "min-h-11 rounded-xl border border-hairline bg-mineral px-3 text-sm text-ink outline-none focus:border-botanical";

  return (
    <section className="paper-card flex flex-col gap-4 p-6" aria-label="Change sign-in email">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-h3 font-semibold">Change sign-in email</h2>
        <p className="text-sm leading-relaxed text-slate">
          For an address no DISC360 account uses yet. The participant confirms
          it before it becomes their login — their assessments, reports and
          teams are untouched either way.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm text-ink">
          Current email
          <input value={currentEmail} readOnly className={`${field} text-slate`} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-ink">
          New email
          <input
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            autoComplete="off"
            required
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-ink">
          Type the new email again
          <input
            type="email"
            value={confirmEmail}
            onChange={(event) => setConfirmEmail(event.target.value)}
            autoComplete="off"
            required
            className={field}
          />
        </label>
        <button
          type="submit"
          disabled={pending || !newEmail || !confirmEmail}
          className="inline-flex min-h-11 items-center justify-center self-start rounded-full bg-botanical px-5 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep disabled:opacity-50"
        >
          {pending ? "Sending verification…" : "Send verification"}
        </button>
      </form>

      {result ? (
        <p
          role="status"
          className={`text-sm leading-relaxed ${result.ok ? "text-botanical" : "text-disc-d"}`}
        >
          {result.message}
        </p>
      ) : null}
    </section>
  );
}
