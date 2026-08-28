import Link from "next/link";
import type { IdentityHistoryEntry } from "@/lib/identity/queries";

/**
 * The outcome of an irreversible reconciliation, rendered from the record.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS IS A SERVER COMPONENT AND NOT PANEL STATE.
 *
 * `ReconcilePanel` used to hold the outcome in `useState` and show it after
 * the mutation returned. It could not work, and it took two attempts to see
 * why:
 *
 *   1 · The panel called `router.push` in the same transition as the state
 *       update, so it unmounted before the message painted.
 *   2 · Removing the push was not enough. A Server Action re-renders the route
 *       it was invoked from as part of its response — that is inherent, not
 *       something `revalidatePath` opts into. After the merge the retiring
 *       identity is deactivated, `getReconciliationPreflight` returns null,
 *       and the page stops rendering `ReconcilePanel` at all. The confirmation
 *       went with it.
 *
 * Client state cannot survive its own server parent deciding to stop rendering
 * it. So the confirmation is not client state: it is read from
 * `identity_reconciliations`, the row the merge itself wrote.
 *
 * That is strictly better than a message. It survives the re-render, a reload,
 * a closed laptop and a different browser — an operator who merged two people
 * and lost their connection can come back and still be told what happened.
 * ─────────────────────────────────────────────────────────────────────
 */
export function ReconciliationConfirmation({
  entry,
  survivingEmail,
  retiredEmail,
  continueHref,
}: {
  entry: IdentityHistoryEntry;
  survivingEmail: string;
  retiredEmail: string | null;
  continueHref: string;
}) {
  // `pending_auth` means the records ARE merged and only the sign-in address
  // needs retrying. It must never read as a failure — nothing needs undoing.
  const complete = entry.status === "completed";

  return (
    <section
      role="status"
      aria-label="Reconciliation outcome"
      className="paper-card flex flex-col gap-4 p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-h3 font-semibold">
          {complete ? "Identity reconciled" : "Records merged — one step outstanding"}
        </h2>
        <p className={`text-sm leading-relaxed ${complete ? "text-botanical" : "text-disc-d"}`}>
          {complete
            ? `${survivingEmail} now signs in to the surviving participant. Both identities' records are held under one account, and nothing was duplicated or discarded.`
            : "The records were merged successfully, but the sign-in address could not be applied. The participant can still sign in with their previous address — retry the authentication step."}
        </p>
      </div>

      <dl className="flex flex-col gap-1 font-mono text-xs text-slate">
        <div className="flex gap-2">
          <dt>Surviving identity</dt>
          <dd className="text-ink">{survivingEmail}</dd>
        </div>
        {retiredEmail ? (
          <div className="flex gap-2">
            <dt>Retired identity</dt>
            <dd className="text-ink">{retiredEmail}</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt>Audit record</dt>
          <dd className="text-ink">{entry.id}</dd>
        </div>
      </dl>

      <Link
        href={continueHref}
        className="inline-flex min-h-11 items-center justify-center self-start rounded-full bg-botanical px-5 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
      >
        Continue to the surviving identity
      </Link>
    </section>
  );
}
