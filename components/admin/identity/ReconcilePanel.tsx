"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reconcileIdentity } from "@/lib/actions/identity";
import {
  BLOCKER_MESSAGES,
  buildReconciliationPlan,
  projectionIsConservative,
  type CanonicalRecommendation,
  type IdentitySummary,
  type ReconciliationPreflight,
} from "@/lib/identity/model";

/**
 * Reconcile identity — three steps, and nothing writes before the third.
 *
 *   choose the surviving identity → read the plan → type its address
 *
 * The plan is generated from the same preflight the database will act on, so
 * what the administrator agrees to is what happens. Two guards that matter:
 * the confirm control does not exist until the plan has been rendered, and it
 * requires the surviving account's address to be typed exactly. A misclick
 * cannot merge two people, because a misclick cannot type an email address.
 */
export function ReconcilePanel({
  preflight,
  recommendation,
  returnPath,
}: {
  preflight: ReconciliationPreflight;
  recommendation: CanonicalRecommendation;
  returnPath: string;
}) {
  const router = useRouter();
  const [canonicalId, setCanonicalId] = useState(recommendation.profileId);
  const [step, setStep] = useState<"choose" | "review" | "confirm">("choose");
  const [confirmation, setConfirmation] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  const { canonical, retiring, blockers } = preflight;
  const blocked = blockers.length > 0;

  // The admin may pick either side; the plan is always expressed from the
  // chosen survivor's point of view.
  const survivor = canonicalId === canonical.profileId ? canonical : retiring;
  const retired = canonicalId === canonical.profileId ? retiring : canonical;
  const oriented: ReconciliationPreflight = {
    ...preflight,
    canonical: survivor,
    retiring: retired,
    projected: preflight.projected,
  };
  const plan = buildReconciliationPlan(oriented);
  const conservative = projectionIsConservative(oriented);

  const submit = () => {
    start(async () => {
      const outcome = await reconcileIdentity({
        canonicalId: survivor.profileId,
        retiringId: retired.profileId,
        confirmation,
        note: note || undefined,
      });
      setResult(outcome);
      if (outcome.ok) router.push(`/admin/users/${survivor.profileId}/identity`);
    });
  };

  return (
    <section className="paper-card flex flex-col gap-6 p-6" aria-label="Reconcile identity">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-h3 font-semibold">Reconcile identity</h2>
        <p className="text-sm leading-relaxed text-slate">
          Two accounts, one real person. The surviving identity keeps its
          records and takes on the other&rsquo;s; nothing is copied and nothing
          is deleted.
        </p>
      </div>

      {blocked ? (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-disc-d/30 p-4">
          {blockers.map((blocker) => (
            <p key={blocker} className="text-sm leading-relaxed text-ink">
              {BLOCKER_MESSAGES[blocker]}
            </p>
          ))}
        </div>
      ) : null}

      {/* ── step 1 · choose the survivor ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[canonical, retiring].map((identity) => (
          <IdentityCard
            key={identity.profileId}
            identity={identity}
            selected={canonicalId === identity.profileId}
            recommended={recommendation.profileId === identity.profileId}
            disabled={blocked || step !== "choose"}
            onSelect={() => setCanonicalId(identity.profileId)}
          />
        ))}
      </div>
      <p className="text-xs leading-relaxed text-faint">
        Recommended: <strong className="text-slate">{
          recommendation.profileId === canonical.profileId ? canonical.email : retiring.email
        }</strong> — {recommendation.reason}
      </p>

      {step === "choose" ? (
        <button
          type="button"
          disabled={blocked}
          onClick={() => setStep("review")}
          className="inline-flex min-h-11 items-center justify-center self-start rounded-full border border-hairline-strong px-5 text-sm font-medium text-ink transition-colors hover:border-botanical hover:text-botanical disabled:opacity-50"
        >
          Review reconciliation plan
        </button>
      ) : null}

      {/* ── step 2 · the plan ── */}
      {step !== "choose" ? (
        <div className="flex flex-col gap-4 rule-t pt-5">
          <h3 className="font-display text-base font-semibold">Reconciliation plan</h3>
          <dl className="flex flex-col divide-y divide-hairline border-y border-hairline">
            {plan.map((line) => (
              <div key={line.label} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5">
                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                  {line.label}
                </dt>
                <dd className="ml-auto flex items-baseline gap-2 text-sm">
                  <span className="text-slate">{line.before}</span>
                  <span aria-hidden className="text-faint">→</span>
                  <span className={line.attention ? "font-medium text-disc-i" : "font-medium text-ink"}>
                    {line.after}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <p className="text-xs leading-relaxed text-faint">
            {conservative
              ? "Every record from both identities is accounted for — nothing is duplicated and nothing is discarded. The database re-checks this inside the transaction and refuses the merge if it does not hold."
              : "The projected totals do not match the sum of both identities. Do not proceed; report this."}
          </p>

          {step === "review" ? (
            <button
              type="button"
              disabled={!conservative}
              onClick={() => setStep("confirm")}
              className="inline-flex min-h-11 items-center justify-center self-start rounded-full bg-botanical px-5 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep disabled:opacity-50"
            >
              Continue
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ── step 3 · typed confirmation ── */}
      {step === "confirm" ? (
        <div className="flex flex-col gap-3 rule-t pt-5">
          <h3 className="font-display text-base font-semibold">Confirm identity reconciliation</h3>
          <p className="text-sm leading-relaxed text-slate">
            Type <strong className="text-ink">{survivor.email}</strong> — the
            surviving identity&rsquo;s current address — to confirm.
          </p>
          <input
            type="text"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            placeholder={survivor.email}
            className="min-h-11 max-w-md rounded-xl border border-hairline bg-mineral px-3 text-sm text-ink outline-none focus:border-botanical"
          />
          <label className="flex max-w-md flex-col gap-1.5 text-sm text-ink">
            Note for the audit record (optional)
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              className="min-h-11 rounded-xl border border-hairline bg-mineral px-3 text-sm text-ink outline-none focus:border-botanical"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending || confirmation.trim().toLowerCase() !== survivor.email.toLowerCase()}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-botanical px-5 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep disabled:opacity-50"
            >
              {pending ? "Reconciling…" : "Confirm identity reconciliation"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("review");
                setConfirmation("");
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-hairline px-5 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical"
            >
              Back
            </button>
            <a
              href={returnPath}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-hairline px-5 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical"
            >
              Cancel
            </a>
          </div>
        </div>
      ) : null}

      {result ? (
        <p
          role="status"
          className={`text-sm leading-relaxed ${result.ok ? "text-botanical" : "text-disc-d"}`}
        >
          {result.message}
        </p>
      ) : null}
    </section>
  );
}

function IdentityCard({
  identity,
  selected,
  recommended,
  disabled,
  onSelect,
}: {
  identity: IdentitySummary;
  selected: boolean;
  recommended: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition-colors ${
        selected ? "border-botanical bg-sand/30" : "border-hairline hover:border-hairline-strong"
      } disabled:cursor-default`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`size-3.5 shrink-0 rounded-full border ${
            selected ? "border-botanical bg-botanical" : "border-hairline-strong"
          }`}
        />
        <span className="text-sm font-medium text-ink">{identity.email}</span>
      </div>
      <p className="font-mono text-[11px] text-faint">
        {identity.fullName} · created{" "}
        {new Date(identity.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </p>
      <p className="text-sm text-slate">
        {identity.discResults} DISC · {identity.focusResults} Focus ·{" "}
        {identity.combinedSessions} Combined · {identity.teamMemberships}{" "}
        {identity.teamMemberships === 1 ? "membership" : "memberships"}
      </p>
      {recommended ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-botanical">
          Recommended canonical
        </span>
      ) : null}
    </button>
  );
}
