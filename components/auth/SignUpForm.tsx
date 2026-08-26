"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/db/browser";
import { isSafeNext, onboardingDestination, parseIntent } from "@/lib/auth/intent";
import { Button } from "@/components/ui/Button";
import { PasswordField, TextField } from "@/components/auth/fields";

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
    const intent = parseIntent(searchParams.get("intent"));

    // The destination the person actually arrived with.
    //
    // A Wellbeing Pulse invitation sends them here as
    // `/sign-up?next=/wellbeing/join/{token}`, and that token is the ONLY
    // thing that grants them membership of the campaign. Dropping it — which
    // both branches below used to do — delivered a participant who had just
    // scanned a printed code into generic onboarding, where they are asked for
    // a team code they do not have.
    //
    // Validated, never trusted: an absolute or protocol-relative URL here
    // would be an open redirect handed over via a crafted sign-up link. The
    // callback re-validates it independently.
    const requestedNext = searchParams.get("next");
    const safeNext = isSafeNext(requestedNext) ? (requestedNext as string) : null;

    // Built with URL rather than interpolation: the previous string produced
    // "?next=/onboarding?intent=team", where the un-encoded "?intent" became a
    // parameter of the callback instead of part of next. The callback owns the
    // onboarding-vs-app decision, so it only needs the intent.
    const callback = new URL("/auth/callback", window.location.origin);
    if (intent) callback.searchParams.set("intent", intent);
    // Carried through the confirmation email too. With confirmations enabled —
    // which is how production runs — this link IS the journey, so a `next`
    // missing here loses the campaign on exactly the deployment that matters.
    if (safeNext) callback.searchParams.set("next", safeNext);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: String(form.get("email")),
      password,
      options: {
        data: { full_name: String(form.get("full_name")) },
        emailRedirectTo: callback.toString(),
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setPending(false);
      return;
    }

    // Local/dev without confirmations: session exists → continue directly,
    // to the invitation when there is one rather than to generic onboarding.
    if (data.session) {
      router.push(safeNext ?? onboardingDestination(intent));
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
      <PasswordField
        label="Password"
        id="password"
        name="password"
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
