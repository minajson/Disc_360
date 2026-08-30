import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/**
 * An organisation's own support routes.
 *
 * ─────────────────────────────────────────────────────────────────────
 * READ THROUGH THE CALLER'S CLIENT, NOT THE SERVICE ROLE.
 *
 * This is one of the few wellbeing reads that genuinely belongs to the
 * participant, so it goes through their own session and RLS answers the
 * question. `organization_support_settings`'s read policy admits organisation
 * members, wellbeing role holders and — via `takes_part_in_org` — anybody on a
 * campaign roster in that organisation. Nothing in the row describes a person.
 *
 * WHAT IS NOT HERE.
 *
 * Any record that somebody looked. There is no write on this path, no audit
 * row, no counter and no column to hold one. Opening the support card is not
 * an event.
 *
 * A route that is switched off, or has no way to reach it, is not returned at
 * all — the card renders from this list, so an incomplete configuration
 * produces no card rather than a support panel with nothing in it. The
 * database enforces the same rule as a check constraint.
 * ─────────────────────────────────────────────────────────────────────
 */

export type SupportRouteKind = "eap" | "occupational_health";

export interface SupportRoute {
  kind: SupportRouteKind;
  /** The organisation's own name for the service, where it gave one. */
  providerName: string | null;
  phone: string | null;
  email: string | null;
  url: string | null;
  hours: string | null;
}

export interface OrganisationSupport {
  routes: SupportRoute[];
  note: string | null;
}

export async function loadOrganisationSupport(
  supabase: SupabaseClient<Database>,
  organizationId: string | null,
): Promise<OrganisationSupport> {
  if (!organizationId) return { routes: [], note: null };

  const { data } = await supabase
    .from("organization_support_settings")
    .select(
      "eap_enabled, eap_provider_name, eap_phone, eap_email, eap_url, eap_hours, oh_enabled, oh_service_name, oh_phone, oh_email, oh_url, oh_hours, support_note",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!data) return { routes: [], note: null };

  const routes: SupportRoute[] = [];

  if (data.eap_enabled && (data.eap_phone || data.eap_email || data.eap_url)) {
    routes.push({
      kind: "eap",
      providerName: data.eap_provider_name,
      phone: data.eap_phone,
      email: data.eap_email,
      url: data.eap_url,
      hours: data.eap_hours,
    });
  }

  if (data.oh_enabled && (data.oh_phone || data.oh_email || data.oh_url)) {
    routes.push({
      kind: "occupational_health",
      providerName: data.oh_service_name,
      phone: data.oh_phone,
      email: data.oh_email,
      url: data.oh_url,
      hours: data.oh_hours,
    });
  }

  return { routes, note: routes.length > 0 ? data.support_note : null };
}

/**
 * Whether the support card should be shown at all.
 *
 * The ONLY input is whether the organisation configured a route. Deliberately
 * not the score, not the threshold, not the department, not the grade — see
 * data/support-content.ts for why conditioning this on a result would be a
 * harm rather than a feature.
 */
export function hasSupport(support: OrganisationSupport): boolean {
  return support.routes.length > 0;
}
