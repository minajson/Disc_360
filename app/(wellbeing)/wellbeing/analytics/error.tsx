"use client";

import Link from "next/link";

/**
 * Analytics failure boundary.
 *
 * Deliberately says nothing about the organisation, the cohort or the reason.
 * An error page on a wellbeing surface that leaked "no results for team X"
 * would disclose participation, which is itself the thing suppression exists
 * to protect.
 */
export default function WellbeingAnalyticsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <h1 className="font-display text-h3 font-semibold">This view is not available</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate">
        We could not load Wellbeing Pulse analytics just now. No data was returned.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="pulse-focus rounded-full bg-pulse px-5 py-2.5 text-sm font-medium text-white"
        >
          Try again
        </button>
        <Link
          href="/wellbeing"
          className="pulse-focus rounded-full border border-[rgba(31,78,95,0.24)] px-5 py-2.5 text-sm font-medium text-pulse"
        >
          Back to Wellbeing Pulse
        </Link>
      </div>
    </div>
  );
}
