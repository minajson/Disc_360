/**
 * The deployment rules the licensing gate depends on, as pure functions.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THESE ARE NOT IN environment.ts.
 *
 * They were, and that made them untestable. `environment.ts` is `server-only`,
 * so the unit runner cannot import it, so the two predicates that decide
 * whether unlicensed content may be served to a participant were covered only
 * by tests that READ THE SOURCE and matched a regex against it.
 *
 * That is the wrong shape of proof for this particular rule. Every comment in
 * this feature rests on one claim — "`isProductionEnvironment()` returns true
 * unconditionally on Vercel, so nothing can open the hosted product" — and a
 * regex cannot show it is true. It can only show that a line of code looks
 * like it.
 *
 * So the rules take their inputs as an argument and live here, where they can
 * be executed against every combination that matters. `environment.ts` stays
 * as the one place that reads `process.env`.
 * ─────────────────────────────────────────────────────────────────────
 */

/** The subset of the environment these rules read. */
export interface DeploymentEnv {
  VERCEL?: string | undefined;
  VERCEL_ENV?: string | undefined;
  NODE_ENV?: string | undefined;
  WELLBEING_LOCAL_TEST?: string | undefined;
  WELLBEING_DEMO_MODE?: string | undefined;
}

/**
 * Is this the deployment real participants use?
 *
 *  1 · Anything running on Vercel is production, UNCONDITIONALLY. This is
 *      checked first and no later branch can reach past it, so a stray flag in
 *      the hosted project changes nothing.
 *  2 · A development build is not production.
 *  3 · A production BUILD anywhere else is still production unless explicitly
 *      marked a local test deployment. The default is the cautious answer.
 */
export function isProduction(env: DeploymentEnv): boolean {
  if (env.VERCEL === "1" || env.VERCEL_ENV) return true;
  if (env.NODE_ENV !== "production") return false;
  return env.WELLBEING_LOCAL_TEST !== "true";
}

/**
 * The management demo flag. Opt-in and exact: absent means off.
 *
 * It does NOT open production on its own — `canServeToParticipants` requires
 * non-production AND this flag.
 */
export function isDemoEnabled(env: DeploymentEnv): boolean {
  return env.WELLBEING_DEMO_MODE === "true";
}
