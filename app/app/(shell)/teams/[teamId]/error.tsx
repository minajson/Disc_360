"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-level error boundary for the team area. Shows a calm, generic state —
 * never the raw error (server messages can reference infrastructure) — with a
 * real retry via reset(). The digest ties what the user saw to the server-side
 * log line for the same failure.
 */
export default function TeamRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client-side breadcrumb: digest only — the server log carries the cause.
    console.error(`team route error digest=${error.digest ?? "none"}`);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-4 px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-faint">Team dashboard</p>
      <h1 className="font-display text-h3 font-semibold text-ink">
        This page couldn&rsquo;t load
      </h1>
      <p className="text-sm leading-relaxed text-slate">
        Something went wrong on our side while loading this team. Your data is
        safe. Try again — if it keeps happening, share the reference below with
        support.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-faint">Reference: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-botanical px-5 py-2 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
        >
          Try again
        </button>
        <Link
          href="/app/teams"
          className="rounded-full border border-hairline bg-paper px-5 py-2 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical"
        >
          Back to your teams
        </Link>
      </div>
    </div>
  );
}
