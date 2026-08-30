/**
 * What is actually running here.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THE APP REPORTS ITS OWN RELEASE, RATHER THAN THE PLATFORM.
 *
 * A deployment created from local files carries no git metadata — Vercel only
 * records a commit for builds it triggered from the repository. So "which
 * commit is in production?" had no answer at all, and the closest available
 * one was a deployment id that cannot be compared to anything in git.
 *
 * This is a better answer regardless of how the deploy was made: the SHA is
 * baked into the BUNDLE at build time, so what this endpoint returns is the
 * commit the running code was compiled from, not a label attached to a
 * deployment record beside it. A mislabelled deployment cannot lie here.
 *
 * WHY IT IS PUBLIC.
 *
 * It carries a commit SHA, a branch name and a build timestamp — three facts
 * that are already public in the repository, and none of which says anything
 * about a person or an organisation. Requiring authentication would make it
 * useless for the thing it exists for: checking, from outside, that a deploy
 * landed. Nothing else is added to this payload, ever.
 * ─────────────────────────────────────────────────────────────────────
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      // Explicit at build time, falling back to what Vercel sets for a
      // git-triggered build. "unknown" is honest rather than misleading.
      sha: process.env.NEXT_PUBLIC_RELEASE_SHA || process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
      ref:
        process.env.NEXT_PUBLIC_RELEASE_REF ||
        process.env.VERCEL_GIT_COMMIT_REF ||
        "unknown",
      builtAt: process.env.NEXT_PUBLIC_RELEASE_BUILT_AT || "unknown",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
