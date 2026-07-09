"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSession } from "@/lib/assessment/client";
import { Button } from "@/components/ui/Button";

export function StartAssessmentButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "creating" | "error">("idle");

  const start = async () => {
    setState("creating");
    try {
      const { session } = await createSession();
      router.push(`/assessment/${session.id}`);
    } catch {
      setState("error");
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <Button size="lg" onClick={start} disabled={state === "creating"}>
        {state === "creating" ? "Preparing your session…" : "Begin the assessment"}
      </Button>
      {state === "error" ? (
        <p role="alert" className="text-sm text-disc-d-glow">
          Something went wrong starting your session — please try again.
        </p>
      ) : null}
    </div>
  );
}
