import "server-only";

/**
 * TEMPORARY server-side diagnostics for the production team-dashboard
 * incident (missing runtime configuration). One structured line per event so
 * platform log search can filter on `disc360:diag`.
 *
 * Never log tokens, cookies, keys, emails or any personal data — only ids,
 * step names and Supabase error code/message (which are non-sensitive).
 * Remove once the production environment has been stable for a few releases.
 */
export function logRouteDiagnostic(event: {
  route: string;
  teamId?: string;
  userId?: string;
  step: string;
  code?: string;
  message?: string;
}) {
  console.error(
    `disc360:diag ${JSON.stringify({
      route: event.route,
      teamId: event.teamId,
      userId: event.userId,
      step: event.step,
      code: event.code,
      message: event.message?.slice(0, 300),
    })}`,
  );
}

/** True when the service-role admin client can be constructed. */
export function adminClientConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
