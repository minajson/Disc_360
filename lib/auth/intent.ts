/**
 * Post-authentication intent and destination handling.
 *
 * The intent a person arrives with ("I want to create a team") has to survive
 * a round trip through Google/Microsoft and back. It travels as a `next` path
 * on the callback URL — never as form content, and never as anything
 * sensitive: it is a destination, not data.
 *
 * Pure functions with no Next.js or Supabase imports, so the redirect rules
 * are unit-testable without a browser.
 */

export type SignupIntent =
  | "individual"
  | "team"
  | "coach"
  | "join"
  | "organization";

/** Marketing/pricing CTAs use kebab-case; onboarding uses snake_case ids. */
const INTENT_ALIASES: Record<string, SignupIntent> = {
  individual: "individual",
  understand_myself: "individual",
  team: "team",
  "create-team": "team",
  create_team: "team",
  coach: "coach",
  manage_clients: "coach",
  join: "join",
  join_team: "join",
  organization: "organization",
  setup_organization: "organization",
};

/** The onboarding radio id each intent preselects. */
export const ONBOARDING_INTENT_ID: Record<SignupIntent, string> = {
  individual: "understand_myself",
  team: "create_team",
  coach: "manage_clients",
  join: "join_team",
  organization: "setup_organization",
};

export function parseIntent(raw: string | null | undefined): SignupIntent | null {
  if (!raw) return null;
  return INTENT_ALIASES[raw.trim().toLowerCase()] ?? null;
}

/**
 * Same-origin relative paths only. An absolute URL — or a protocol-relative
 * `//evil.com`, which the browser treats as absolute — must never be followed
 * after authentication; that is an open redirect handed to an attacker via a
 * crafted link.
 */
export function isSafeNext(next: string | null | undefined): boolean {
  if (!next) return false;
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//")) return false;
  // Backslashes are normalised to forward slashes by some browsers, so
  // "/\evil.com" can escape the origin.
  if (next.includes("\\")) return false;
  return true;
}

export function safeNextOr(next: string | null | undefined, fallback: string): string {
  return isSafeNext(next) ? (next as string) : fallback;
}

/** Where a brand-new account goes: onboarding, carrying its intent. */
export function onboardingDestination(intent: SignupIntent | null): string {
  return intent ? `/onboarding?intent=${intent}` : "/onboarding";
}

/**
 * Where an already-onboarded account goes. A team intent skips straight to
 * the single team wizard — it must never be routed back through onboarding,
 * which would ask for a profile they already have.
 */
export function onboardedDestination(intent: SignupIntent | null): string {
  switch (intent) {
    case "team":
    case "organization":
      return "/app/teams/new";
    case "coach":
      return "/app/coach";
    case "join":
      return "/app/invitations";
    default:
      return "/app";
  }
}

/* ── Auth error codes ─────────────────────────────────────────────── */

export type AuthErrorCode =
  | "deactivated"
  | "oauth_denied"
  | "oauth_failed"
  | "oauth_provider"
  | "callback_failed"
  | "session_failed";

/**
 * Human-readable, resolvable messages. Every code the callback can emit has an
 * entry here — an OAuth failure must never bounce the user back to a page that
 * silently looks unchanged.
 */
export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  deactivated:
    "This account has been deactivated by the platform administrator. Contact hello@disc360.app to restore access.",
  oauth_denied:
    "You cancelled the sign-in before it finished. You can try again, or use email and password.",
  oauth_failed:
    "That sign-in provider could not complete the request. Try again, or use email and password below.",
  oauth_provider:
    "This sign-in provider isn't configured on this deployment yet. Use email and password, or contact your administrator.",
  callback_failed:
    "We couldn't finish signing you in — the link may have expired. Request a new one, or use email and password.",
  session_failed:
    "We signed you in but couldn't start your session. Please try again.",
};

export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return AUTH_ERROR_MESSAGES[code as AuthErrorCode] ?? null;
}

/**
 * Maps the error Supabase/the provider hands back on the callback URL onto one
 * of our codes. `access_denied` is the user pressing "Cancel", which deserves
 * a gentler message than a genuine failure.
 */
export function classifyCallbackError(
  error: string | null,
  errorCode: string | null,
): AuthErrorCode {
  const value = (errorCode || error || "").toLowerCase();
  if (value.includes("access_denied")) return "oauth_denied";
  if (value.includes("provider") || value.includes("validation_failed")) {
    return "oauth_provider";
  }
  return "oauth_failed";
}
