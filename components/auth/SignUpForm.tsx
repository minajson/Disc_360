"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/db/browser";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/auth/fields";

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password.length < 10) {
      setError("Use at least 10 characters for your password.");
      return;
    }

    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const intent = searchParams.get("intent");
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: String(form.get("email")),
      password,
      options: {
        data: { full_name: String(form.get("full_name")) },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding${intent ? `?intent=${intent}` : ""}`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setPending(false);
      return;
    }

    // Local/dev without confirmations: session exists → continue directly.
    if (data.session) {
      router.push(`/onboarding${intent ? `?intent=${intent}` : ""}`);
      router.refresh();
      return;
    }
    setConfirmationSent(true);
    setPending(false);
  };

  if (confirmationSent) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
        <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="var(--color-botanical)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
        <p className="text-sm leading-relaxed text-slate">
          Check your inbox — we sent a verification link. Once verified,
          you&rsquo;ll continue straight into onboarding.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <TextField
        label="Full name"
        id="full_name"
        name="full_name"
        autoComplete="name"
        required
      />
      <TextField
        label="Email"
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <TextField
        label="Password"
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
      />
      {error ? (
        <p role="alert" className="text-sm text-disc-d">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-xs leading-relaxed text-faint">
        By creating an account you agree to the{" "}
        <a href="/terms" className="underline hover:text-ink">terms</a> and{" "}
        <a href="/privacy" className="underline hover:text-ink">privacy policy</a>.
      </p>
    </form>
  );
}
