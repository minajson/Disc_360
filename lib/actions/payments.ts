"use server";

import { redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { paymentProvider } from "@/lib/payments/provider";

/** Purchase the $8 Team plan, then continue to team setup. */
export async function purchaseTeamPlan(): Promise<void> {
  const { supabase, user } = await requireOnboarded();

  const result = await paymentProvider.checkoutTeamPlan(user.id, "/app/teams/new");

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: result.ok ? "entitlement.purchased" : "entitlement.purchase_failed",
    entity_type: "entitlement",
    metadata: { product: "team", amount_cents: 800, simulated: true },
  });

  redirect(result.ok ? result.redirectTo : "/pricing?intent=create-team&error=1");
}
