"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/auth/fields";
import { joinTeamByCode } from "@/lib/actions/invitations";

export function JoinByCodeForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // On success the action redirects server-side (the reliable navigation
  // path for server actions); only failures return here.
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    const code = String(new FormData(event.currentTarget).get("team_code") ?? "");
    const result = await joinTeamByCode(code);
    if (!result.ok) {
      setError(result.error ?? "Could not join with that code.");
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <TextField
        label="Team code"
        id="join-code"
        name="team_code"
        placeholder="e.g. ATLAS-1002"
        required
      />
      {error ? (
        <p role="alert" className="text-sm text-disc-d">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Joining…" : "Join team"}
      </Button>
    </form>
  );
}
