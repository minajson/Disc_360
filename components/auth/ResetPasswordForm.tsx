"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/db/browser";
import { notifyPasswordChanged } from "@/lib/actions/settings";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/auth/fields";

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password.length < 10) {
      setError("Use at least 10 characters for your password.");
      return;
    }
    if (password !== String(form.get("confirm"))) {
      setError("Passwords don't match.");
      return;
    }

    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(
        updateError.message.includes("session")
          ? "This reset link has expired — request a new one from the sign-in page."
          : updateError.message,
      );
      setPending(false);
      return;
    }
    void notifyPasswordChanged();
    router.push("/app");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <TextField
        label="New password"
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
      />
      <TextField
        label="Confirm new password"
        id="confirm"
        name="confirm"
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
        {pending ? "Updating…" : "Set new password"}
      </Button>
    </form>
  );
}
