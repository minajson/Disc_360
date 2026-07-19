import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/**
 * Cookie-less anonymous client for PUBLIC lookups (join resolution). Runs
 * under the anon role: it can execute only the narrowly-granted
 * SECURITY DEFINER join RPCs — deliberately independent of the service-role
 * key, so the public join flow keeps working even if that key is absent or
 * misconfigured in a deployment.
 */
export function createSupabaseAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase anon client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
