"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/db/browser";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/auth/fields";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const supabase = createSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      String(form.get("email")),
      { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` },
    );
    if (resetError) {
      setError(resetError.message);
      setPending(false);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <p role="status" className="py-2 text-sm leading-relaxed text-slate">
        If an account exists for that address, a reset link is on its way.
        The link expires in one hour.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <TextField
        label="Email"
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      {error ? (
        <p role="alert" className="text-sm text-disc-d">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
