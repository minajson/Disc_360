import "server-only";

/**
 * The two facts the licensing gate depends on.
 *
 * Kept in one tiny module, read from the environment in exactly one place, so
 * `canServeToParticipants` stays pure and directly testable and there is a
 * single line to audit when asking "could unlicensed content ever be served?".
 */

/** True in a production deployment. */
export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * The management demo flag.
 *
 * Opt-in and explicit: absent means off. It does NOT open production on its
 * own — `canServeToParticipants` requires non-production AND this flag, so
 * setting it in a production environment by accident changes nothing.
 */
export function isWellbeingDemoEnabled(): boolean {
  return process.env.WELLBEING_DEMO_MODE === "true";
}
