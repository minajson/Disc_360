"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/db/browser";
import {
  authErrorMessage,
  onboardedDestination,
  parseIntent,
  safeNextOr,
} from "@/lib/auth/intent";
import { Button } from "@/components/ui/Button";
import { PasswordField, TextField } from "@/components/auth/fields";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "That email and password combination doesn't match our records."
          : signInError.message,
      );
      setPending(false);
      return;
    }
    // `next` is attacker-supplied via a crafted link, so it is validated
    // rather than trusted; an intent alone routes to the right landing place.
    const next = searchParams.get("next");
    const intent = parseIntent(searchParams.get("intent"));
    router.push(safeNextOr(next, onboardedDestination(intent)));
    router.refresh();
  };

  // Every code the auth callback can emit renders here. Previously only
  // "deactivated" did, so an OAuth failure bounced back to this page showing
  // nothing at all — indistinguishable from a button that does nothing.
  const notice = error ?? authErrorMessage(searchParams.get("error"));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {notice ? (
        <p role="alert" className="rounded-xl bg-disc-d-soft px-4 py-3 text-sm text-disc-d">
          {notice}
        </p>
      ) : null}
      <TextField
        label="Email"
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <div className="flex flex-col gap-1.5">
        <PasswordField
          label="Password"
          id="password"
          name="password"
          autoComplete="current-password"
          required
        />
        <Link
          href="/forgot-password"
          className="self-end text-xs text-slate hover:text-botanical"
        >
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
