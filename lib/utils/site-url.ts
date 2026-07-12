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
  return classifyBaseUrl(process.env.NEXT_PUBLIC_SITE_URL);
}

/** The participant-facing join URL for a team's invite token. */
export function buildJoinUrl(base: PublicBaseUrl, inviteToken: string): string {
  return `${base.url}/join/${inviteToken}`;
}

/** Short human-readable form for display next to QR codes. */
export function displayJoinUrl(base: PublicBaseUrl, inviteToken: string): string {
  return buildJoinUrl(base, inviteToken).replace(/^https?:\/\//, "");
}
