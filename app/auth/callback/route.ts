import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/server";
import {
  classifyCallbackError,
  isSafeNext,
  onboardedDestination,
  onboardingDestination,
  parseIntent,
} from "@/lib/auth/intent";

/**
 * Auth callback: OAuth and email-confirmation land here.
 *
 * Three things this route must get right, each of which was previously wrong:
 *
 * 1. Providers report failures as `?error=` / `?error_code=` on this URL, with
 *    no `code`. Ignoring them sent the user back to /sign-in with a code the
 *    sign-in page did not render — a silent bounce that looked like a dead
 *    button. Every failure now leaves with a specific, readable reason.
 * 2. The original intent travels as `?next=`. Without it, a Google user who
 *    clicked "Create a team" was dropped on a generic dashboard.
 * 3. A returning OAuth user must not be sent through onboarding again, and a
 *    brand-new one must not be dropped into the app without a profile. The
 *    decision is made here, from `onboarded_at`, not guessed by the caller.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const intent = parseIntent(url.searchParams.get("intent"));
  const requestedNext = url.searchParams.get("next");

  const fail = (reason: string) => {
    const target = new URL("/sign-in", url.origin);
    target.searchParams.set("error", reason);
    if (intent) target.searchParams.set("intent", intent);
    return NextResponse.redirect(target);
  };

  // The provider or Supabase rejected the request before issuing a code.
  const providerError = url.searchParams.get("error");
  const providerErrorCode = url.searchParams.get("error_code");
  if (providerError || providerErrorCode) {
    return fail(classifyCallbackError(providerError, providerErrorCode));
  }

  if (!code) return fail("callback_failed");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail("callback_failed");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("session_failed");

  // An explicit, safe ?next= wins — it is how a deep link survives sign-in.
  if (isSafeNext(requestedNext)) {
    return NextResponse.redirect(new URL(requestedNext as string, url.origin));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at, deactivated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.deactivated_at) {
    await supabase.auth.signOut();
    return fail("deactivated");
  }

  const destination = profile?.onboarded_at
    ? onboardedDestination(intent)
    : onboardingDestination(intent);

  return NextResponse.redirect(new URL(destination, url.origin));
}
