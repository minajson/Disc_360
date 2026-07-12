"use client";

import { useTransition } from "react";
import { purchaseTeamPlan } from "@/lib/actions/payments";
import { Button } from "@/components/ui/Button";

export function PurchaseTeamPlanButton({ size = "md" }: { size?: "md" | "lg" }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-1.5">
      <Button
        size={size}
        disabled={pending}
        onClick={() => startTransition(() => purchaseTeamPlan())}
      >
        {pending ? "Processing…" : "Buy Team plan · $8"}
      </Button>
      <span className="text-center font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
        Development checkout — no card charged
      </span>
    </div>
  );
}
