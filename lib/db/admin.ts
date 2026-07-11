import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/**
 * Service-role client — BYPASSES RLS. Import only inside server actions or
 * route handlers, and only after an explicit authorization check. Every call
 * site must carry a comment justifying the bypass (e.g. invitation-token
 * acceptance, cross-member team reporting with anonymization).
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
