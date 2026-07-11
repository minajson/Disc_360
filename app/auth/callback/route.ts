import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/server";

/**
 * Auth callback: exchanges the OAuth / email-confirmation code for a session,
 * then forwards to the requested destination (onboarding by default).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/onboarding";

  // Only allow same-origin relative redirects.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, url.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/sign-in?error=auth_callback", url.origin),
  );
}
