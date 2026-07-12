import "server-only";
import { createSupabaseAdminClient } from "@/lib/db/admin";

/**
 * Payment abstraction. Swap `DevCheckoutProvider` for a Stripe-backed
 * implementation without touching call sites: `checkout()` returns where to
 * send the user next, and successful payment must create an `entitlements`
 * row for the purchaser.
 */

export interface CheckoutResult {
  ok: boolean;
  redirectTo: string;
  error?: string;
}

export interface PaymentProvider {
  /** Purchase one Team plan for the given user. */
  checkoutTeamPlan(userId: string, returnTo: string): Promise<CheckoutResult>;
}

/**
 * Development checkout: grants the entitlement instantly and records it as
 * simulated. The purchase UI labels this clearly as a development checkout.
 */
export const DevCheckoutProvider: PaymentProvider = {
  async checkoutTeamPlan(userId, returnTo) {
    // Service role: entitlement grants are server-controlled writes.
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("entitlements").insert({
      purchaser_id: userId,
      product: "team",
      amount_cents: 800,
      status: "active",
      simulated: true,
    });
    if (error) {
      return { ok: false, redirectTo: returnTo, error: "Purchase failed — try again." };
    }
    return { ok: true, redirectTo: returnTo };
  },
};

/** The active provider. Stripe replaces this when configured. */
export const paymentProvider: PaymentProvider = DevCheckoutProvider;
