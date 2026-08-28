import "server-only";
import { isDemoEnabled, isProduction } from "./environment-rules";

/**
 * The two facts the licensing gate depends on.
 *
 * Kept in one tiny module, read from the environment in exactly one place, so
 * `canServeToParticipants` stays pure and directly testable and there is a
 * single line to audit when asking "could unlicensed content ever be served?".
 */

/**
 * Is this the PRODUCTION DEPLOYMENT?
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT SIMPLY `NODE_ENV === "production"`.
 *
 * It used to be, and that conflated two different things. `NODE_ENV` describes
 * how the code was BUILT; it is "production" for any optimised build,
 * including the one the end-to-end suite runs against on a laptop. So a local
 * test server was indistinguishable from the hosted deployment, and an
 * instrument that may legitimately be exercised locally before release could
 * not be exercised anywhere at all.
 *
 * The question the licensing gate actually needs answered is "is this the
 * deployment real participants use?", which is a fact about WHERE this is
 * running, not about how it was compiled.
 *
 * THE RULE, AND WHY IT FAILS CLOSED.
 *
 *  1 · Anything running on Vercel is production, unconditionally. No
 *      environment variable can talk it out of that, so a stray flag in the
 *      hosted project changes nothing.
 *  2 · A development build is not production.
 *  3 * A production BUILD anywhere else is still treated as production unless
 *      it is explicitly marked as a local test deployment. The default is the
 *      cautious answer: if nobody said otherwise, assume real participants.
 *
 * The marker is deliberately awkward to set by accident — it must be exactly
 * "true", it is named for what it is, and rule 1 makes it inert in the one
 * place where being wrong would matter.
 * ─────────────────────────────────────────────────────────────────────
 */
export function isProductionEnvironment(): boolean {
  // The rule itself lives in environment-rules.ts, which is not `server-only`
  // and is therefore executable by the unit runner against every combination.
  // This module's whole job is to be the one place that reads process.env.
  return isProduction(process.env);
}

/**
 * The management demo flag.
 *
 * Opt-in and explicit: absent means off. It does NOT open production on its
 * own — `canServeToParticipants` requires non-production AND this flag, so
 * setting it in a production environment by accident changes nothing.
 */
export function isWellbeingDemoEnabled(): boolean {
  return isDemoEnabled(process.env);
}
