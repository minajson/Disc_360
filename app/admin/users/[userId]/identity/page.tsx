import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/guards";
import {
  getIdentityHistory,
  getIdentitySummary,
  getReconciliationPreflight,
} from "@/lib/identity/queries";
import { activeAlias, previousAliases, recommendCanonical } from "@/lib/identity/model";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { StatusBadge } from "@/components/admin/table";
import { ChangeEmailPanel } from "@/components/admin/identity/ChangeEmailPanel";
import { LinkLoginPanel } from "@/components/admin/identity/LinkLoginPanel";
import { ReconcilePanel } from "@/components/admin/identity/ReconcilePanel";
import { ReconciliationConfirmation } from "@/components/admin/identity/ReconciliationConfirmation";
import { IdentityHistoryList } from "@/components/admin/identity/IdentityHistoryList";

export const metadata: Metadata = { title: "Manage identity · Admin" };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

/**
 * Manage identity — platform administrators only.
 *
 * `requireSuperAdmin()` guards this page and the whole /admin segment, and
 * every action it renders re-checks platform scope server-side. A team
 * facilitator holds `is_team_admin` on their own teams, which is a different
 * predicate entirely and grants none of this.
 *
 * The reconciliation panel appears only once a second identity has been named
 * and its preflight has been read. There is no control on this page that
 * merges anything from a name, a domain or a similarity score.
 */
export default async function ManageIdentityPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ with?: string }>;
}) {
  await requireSuperAdmin();
  const { userId } = await params;
  const { with: counterpartId } = await searchParams;

  const identity = await getIdentitySummary(userId);
  if (!identity) notFound();

  const history = await getIdentityHistory(userId);
  const current = activeAlias(identity.aliases);
  const previous = previousAliases(identity.aliases);

  // A counterpart is only ever named explicitly, by an administrator who
  // located it. Nothing here searches for "probably the same person".
  const { context } = await (async () => {
    if (!counterpartId || counterpartId === userId) return { context: null };
    const { user } = await requireSuperAdmin();
    const preflight = await getReconciliationPreflight(user.id, userId, counterpartId);
    if (!preflight) return { context: null };
    return {
      context: {
        preflight,
        recommendation: recommendCanonical(preflight.canonical, preflight.retiring),
      },
    };
  })();

  /*
   * The reconciliation that has ALREADY happened for this pair, if any.
   *
   * ───────────────────────────────────────────────────────────────────
   * WHY THE PAGE OWNS THE CONFIRMATION.
   *
   * When `?with=` names an identity that has just been merged away, the
   * preflight above returns null and `ReconcilePanel` stops rendering. That is
   * correct — there is nothing left to reconcile — but it is also the moment
   * the operator most needs to be told what happened, and a client component
   * that is no longer rendered cannot tell them.
   *
   * A Server Action re-renders the route it was invoked from, so this branch
   * is reached IMMEDIATELY after the merge, in the same response. Reading the
   * outcome from the record the merge wrote means the confirmation is present
   * in that render rather than racing it.
   * ───────────────────────────────────────────────────────────────────
   */
  const settledReconciliation =
    counterpartId && !context
      ? (history.find(
          (entry) =>
            entry.retiredProfileId === counterpartId &&
            (entry.status === "completed" || entry.status === "pending_auth"),
        ) ?? null)
      : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Manage identity</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">
          {identity.fullName || identity.email}
        </h1>
        <p className="font-mono text-xs text-faint">
          <Link href={`/admin/users/${userId}`} className="hover:text-botanical">
            ← back to user
          </Link>
          {" · "}account created {formatDate(identity.createdAt)}
          {identity.deactivatedAt ? " · RETIRED" : ""}
        </p>
      </div>

      {/* ── who this is ── */}
      <section className="paper-card flex flex-col gap-5 p-6" aria-label="Identity overview">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Current sign-in email
            </span>
            <p className="text-sm font-medium text-ink">{identity.email}</p>
            <span className="font-mono text-[11px] text-faint">
              {current ? `${current.provider} · since ${formatDate(current.firstSeenAt)}` : "no alias recorded"}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Previous identities
            </span>
            {previous.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {previous.map((alias) => (
                  <li key={alias.email} className="text-sm text-slate">
                    {alias.email}
                    <span className="font-mono text-[11px] text-faint">
                      {alias.retiredAt ? ` · retired ${formatDate(alias.retiredAt)}` : ""}
                      {alias.source === "reconciliation" ? " · from reconciliation" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate">None — this address has never changed.</p>
            )}
            {previous.length > 0 ? (
              <p className="text-[11px] leading-relaxed text-faint">
                Previous addresses are searchable by administrators and are never
                used to deliver a report.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 rule-t pt-5 sm:grid-cols-4">
          {[
            { label: "DISC", value: identity.discResults },
            { label: "Focus", value: identity.focusResults },
            { label: "Combined", value: identity.combinedSessions },
            { label: "Teams", value: identity.teamMemberships },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
                {stat.label}
              </span>
              <span className="font-display text-h3 font-semibold tabular-nums text-ink">
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        {identity.teams.length > 0 ? (
          <div className="flex flex-wrap gap-2 rule-t pt-5">
            {identity.teams.map((team) => (
              <span
                key={team.id}
                className="inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-1 text-xs text-slate"
              >
                {team.name}
                {team.role === "team_admin" ? (
                  <StatusBadge tone="blue">facilitator</StatusBadge>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {/* ── actions ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChangeEmailPanel profileId={userId} currentEmail={identity.email} />
        <LinkLoginPanel profileId={userId} />
      </div>

      {context ? (
        <ReconcilePanel
          preflight={context.preflight}
          recommendation={context.recommendation}
          returnPath={`/admin/users/${userId}/identity`}
        />
      ) : null}

      {settledReconciliation ? (
        <ReconciliationConfirmation
          entry={settledReconciliation}
          survivingEmail={identity.email}
          retiredEmail={settledReconciliation.oldEmail}
          continueHref={`/admin/users/${userId}/identity`}
        />
      ) : null}

      <IdentityHistoryList entries={history} />
    </div>
  );
}
