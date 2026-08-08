"use client";

import { useTransition, useState } from "react";
import { retryReconciliationAuth } from "@/lib/actions/identity";
import { StatusBadge } from "@/components/admin/table";
import type { IdentityHistoryEntry } from "@/lib/identity/queries";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

const ACTION_LABEL: Record<string, string> = {
  email_change: "Sign-in email change",
  reconcile: "Identity reconciliation",
};

/**
 * Identity history — every change to this person's login, with its evidence.
 *
 * `pending_auth` is shown as an actionable state rather than an error: the
 * records are already merged and consistent, only the authentication step is
 * outstanding, and the participant can still sign in throughout. Retrying is
 * safe to repeat.
 */
export function IdentityHistoryList({ entries }: { entries: IdentityHistoryEntry[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const retry = (id: string) => {
    setPendingId(id);
    start(async () => {
      const outcome = await retryReconciliationAuth(id);
      setNotice(outcome.message);
      setPendingId(null);
    });
  };

  return (
    <section className="flex flex-col gap-3" aria-label="Identity history">
      <h2 className="font-display text-h3 font-semibold">Identity history</h2>

      {entries.length === 0 ? (
        <p className="paper-card p-5 text-sm text-slate">
          No identity changes recorded for this participant.
        </p>
      ) : (
        <div className="paper-card divide-y divide-hairline p-0">
          {entries.map((entry) => {
            const conflicts = entry.conflictsResolved as Record<string, number>;
            const merged = Number(conflicts.memberships_deduplicated ?? 0);
            const abandoned = Number(conflicts.in_progress_attempts_abandoned ?? 0);
            return (
              <div key={entry.id} className="flex flex-col gap-2 px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium text-ink">
                    {ACTION_LABEL[entry.action] ?? entry.action}
                  </span>
                  <StatusBadge
                    tone={
                      entry.status === "completed"
                        ? "green"
                        : entry.status === "failed"
                          ? "red"
                          : "blue"
                    }
                  >
                    {entry.status === "pending_auth" ? "awaiting authentication" : entry.status}
                  </StatusBadge>
                  <span className="font-mono text-xs text-faint">
                    {formatDate(entry.createdAt)}
                    {entry.performedByName ? ` · by ${entry.performedByName}` : ""}
                  </span>
                </div>

                <p className="text-sm text-slate">
                  {entry.oldEmail ?? "—"}
                  <span aria-hidden className="text-faint"> → </span>
                  {entry.newEmail ?? "—"}
                </p>

                {merged > 0 || abandoned > 0 ? (
                  <p className="font-mono text-[11px] text-faint">
                    {merged > 0 ? `${merged} duplicate membership${merged === 1 ? "" : "s"} merged` : ""}
                    {merged > 0 && abandoned > 0 ? " · " : ""}
                    {abandoned > 0
                      ? `${abandoned} unfinished attempt${abandoned === 1 ? "" : "s"} abandoned`
                      : ""}
                  </p>
                ) : null}

                {entry.note ? (
                  <p className="text-xs leading-relaxed text-faint">{entry.note}</p>
                ) : null}

                {entry.status === "pending_auth" && entry.action === "reconcile" ? (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs leading-relaxed text-slate">
                      Records were merged successfully. The participant can still
                      sign in with their previous address until this completes.
                    </p>
                    <button
                      type="button"
                      onClick={() => retry(entry.id)}
                      disabled={pending}
                      className="inline-flex min-h-10 items-center justify-center self-start rounded-full border border-hairline px-4 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical disabled:opacity-50"
                    >
                      {pending && pendingId === entry.id
                        ? "Retrying…"
                        : "Complete authentication step"}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {notice ? (
        <p role="status" className="text-sm text-botanical">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
