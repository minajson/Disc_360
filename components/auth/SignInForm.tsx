"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/db/browser";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/auth/fields";

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
    router.push(searchParams.get("next") ?? "/app");
    router.refresh();
  };

  const blockedNotice =
    searchParams.get("error") === "deactivated"
      ? "This account has been deactivated by the platform administrator. Contact hello@disc360.app to restore access."
      : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {blockedNotice ? (
        <p role="alert" className="rounded-xl bg-disc-d-soft px-4 py-3 text-sm text-disc-d">
          {blockedNotice}
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
        <TextField
          label="Password"
          id="password"
          name="password"
          type="password"
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
      {error ? (
        <p role="alert" className="text-sm text-disc-d">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
