/**
 * Which OAuth providers are genuinely configured.
 *
 * This cannot be asked of Supabase. `/auth/v1/settings` reports a provider as
 * enabled whenever its config block is enabled, regardless of whether real
 * credentials exist — and when an `env(...)` substitution finds no variable,
 * the CLI forwards the *literal string* `env(GOOGLE_CLIENT_ID)` to the
 * provider as the client id. The user is then bounced to a Google/Microsoft
 * error page, which looks like "sign-in is broken" rather than "sign-in is
 * not set up".
 *
 * So the app decides for itself, server-side, and refuses to start a flow it
 * knows cannot complete. Only booleans are exposed to the client — never an
 * id, never a secret.
 *
 * Pure and dependency-free so it can be unit-tested: callers pass the
 * environment in.
 */

export type OAuthProviderId = "google" | "azure";

export interface OAuthProviderStatus {
  id: OAuthProviderId;
  label: string;
  configured: boolean;
  /** Shown when `configured` is false. Names the provider, never generic. */
  unconfiguredMessage: string;
}

/**
 * A value counts as set only when it is non-empty and is not an unsubstituted
 * `env(...)` placeholder left behind by the Supabase CLI.
 */
export function isCredentialSet(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed === "") return false;
  return !/^env\(.*\)$/i.test(trimmed);
}

const PROVIDERS: {
  id: OAuthProviderId;
  label: string;
  displayName: string;
  vars: string[];
}[] = [
  {
    id: "google",
    label: "Continue with Google",
    displayName: "Google",
    vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  },
  {
    id: "azure",
    label: "Continue with Microsoft",
    displayName: "Microsoft",
    // AZURE_TENANT_URL selects the account-type policy; without it Supabase
    // cannot know whether personal accounts are permitted.
    vars: ["AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_TENANT_URL"],
  },
];

export function getOAuthProviderStatus(
  env: Record<string, string | undefined> = process.env,
): OAuthProviderStatus[] {
  return PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.label,
    configured: provider.vars.every((name) => isCredentialSet(env[name])),
    unconfiguredMessage: `${provider.displayName} sign-in requires provider configuration.`,
  }));
}

/**
 * Only the providers that can actually complete a sign-in.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY A SECOND RESOLVER RATHER THAN A CHANGE TO THE FIRST.
 *
 * On the sign-in and sign-up pages an unconfigured provider is worth showing:
 * the person came there to authenticate, they may be looking for Microsoft
 * specifically, and "Microsoft sign-in requires provider configuration" is a
 * more useful answer than a button that silently is not there.
 *
 * An invitation is different. Somebody has scanned a printed code and is
 * deciding, in a corridor, whether to take part at all. A button that looks
 * like a way in and turns out not to be is a reason to give up, and it is the
 * product's fault rather than theirs. So the invitation offers only what
 * works, and what does not work is simply absent.
 *
 * When Azure is configured this starts returning Microsoft with no code change
 * — the difference is environment, not a list somebody has to remember to
 * update.
 * ─────────────────────────────────────────────────────────────────────
 */
export function getUsableOAuthProviders(
  env: Record<string, string | undefined> = process.env,
): OAuthProviderStatus[] {
  return getOAuthProviderStatus(env).filter((provider) => provider.configured);
}
