/**
 * Public base-URL handling for externally shared links and QR codes.
 * Never silently treat localhost as shareable: callers must surface the
 * `isLocal` flag (dev warning) on anything meant to leave this machine.
 */

export interface PublicBaseUrl {
  url: string;
  /** True when the configured URL cannot be reached from another device. */
  isLocal: boolean;
}

const LOCAL_PATTERNS = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];

export function classifyBaseUrl(raw: string | undefined): PublicBaseUrl {
  const url = (raw ?? "http://localhost:3000").replace(/\/+$/, "");
  const isLocal = LOCAL_PATTERNS.some((pattern) => url.includes(pattern));
  return { url, isLocal };
}

export function getPublicBaseUrl(): PublicBaseUrl {
  // NEXT_PUBLIC_* is frozen into the bundles at build time; the unprefixed
  // SITE_URL is read at runtime on the server so a deployed (or test) process
  // can point shared links at the host it actually serves.
  return classifyBaseUrl(process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL);
}

/** The participant-facing join URL for a team's invite token. */
export function buildJoinUrl(base: PublicBaseUrl, inviteToken: string): string {
  return `${base.url}/join/${inviteToken}`;
}

/** Short human-readable form for display next to QR codes. */
export function displayJoinUrl(base: PublicBaseUrl, inviteToken: string): string {
  return buildJoinUrl(base, inviteToken).replace(/^https?:\/\//, "");
}

/**
 * The team summary page. Authenticated — scanning this lands on sign-in
 * first. Distinct from a shared report link, which needs no account.
 */
export function buildTeamResultsUrl(base: PublicBaseUrl, teamId: string): string {
  return `${base.url}/app/teams/${teamId}/results`;
}

/**
 * The public, name-free shared report for one result. The unguessable token
 * is the authorization, so this URL must be treated as a secret.
 *
 * Built from the configured base rather than `window.location.origin`:
 * behind a proxy, a preview alias or a custom domain the browsing origin is
 * not the origin we want other people to receive.
 */
export function buildSharedReportUrl(base: PublicBaseUrl, shareToken: string): string {
  return `${base.url}/r/${shareToken}`;
}
