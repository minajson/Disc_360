"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/auth/fields";
import { acceptTeamCode } from "@/lib/actions/invitations";

export function JoinByCodeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const code = String(new FormData(event.currentTarget).get("team_code") ?? "");
    startTransition(async () => {
      const result = await acceptTeamCode(code);
      if (result.ok && result.teamId) {
        router.push(`/app/teams/${result.teamId}`);
        router.refresh();
      } else {
        setError(result.error ?? "Could not join with that code.");
      }
    });
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
