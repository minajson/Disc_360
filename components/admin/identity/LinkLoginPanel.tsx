"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { findLoginToLink } from "@/lib/actions/identity";

/**
 * Link another login.
 *
 * This only ever *locates* the identity behind an address and hands the
 * administrator the two profiles side by side. It merges nothing — deciding
 * that two accounts are one person is a judgement, and the confirmation for it
 * lives in the reconciliation panel, behind a preflight and a typed address.
 */
export function LinkLoginPanel({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string; profileId?: string } | null>(
    null,
  );
  const [pending, start] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    start(async () => {
      const outcome = await findLoginToLink(profileId, email);
      setResult(outcome);
      if (outcome.ok && outcome.profileId) {
        router.push(`/admin/users/${profileId}/identity?with=${outcome.profileId}`);
      }
    });
  };

  return (
    <section className="paper-card flex flex-col gap-4 p-6" aria-label="Link another login">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-h3 font-semibold">Link another login</h2>
        <p className="text-sm leading-relaxed text-slate">
          When the same person has ended up with a second account. Enter the
          other address to review both identities before deciding anything.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm text-ink">
          Other sign-in email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="off"
            required
            className="min-h-11 rounded-xl border border-hairline bg-mineral px-3 text-sm text-ink outline-none focus:border-botanical"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !email}
          className="inline-flex min-h-11 items-center justify-center self-start rounded-full border border-hairline-strong px-5 text-sm font-medium text-ink transition-colors hover:border-botanical hover:text-botanical disabled:opacity-50"
        >
          {pending ? "Looking up…" : "Find identity"}
        </button>
      </form>

      {result && !result.ok ? (
        <p role="status" className="text-sm leading-relaxed text-disc-d">
          {result.message}
        </p>
      ) : null}
    </section>
  );
}
