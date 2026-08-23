"use client";

import { useState, useTransition } from "react";
import {
  grantWellbeingRoleAction,
  installWellbeingTaxonomyAction,
  revokeWellbeingRoleAction,
  setWellbeingPolicyAction,
  type AdminActionResult,
} from "@/lib/actions/wellbeing-admin";

export interface GovernanceOrganization {
  id: string;
  name: string;
  threshold: number;
  minCohort: number;
  policyIsDefault: boolean;
  departmentCount: number;
  officeCount: number;
}

export interface GovernanceGrant {
  id: string;
  personName: string;
  personEmail: string;
  organizationName: string;
  role: string;
  grantedAt: string;
}

export interface GovernancePerson {
  id: string;
  name: string;
  email: string;
}

const ROLE_LABEL: Record<string, string> = {
  wellbeing_governance: "Governance",
  wellbeing_analyst: "Analyst",
};

const input =
  "w-full rounded-xl border border-hairline bg-paper px-3.5 py-2.5 text-sm text-ink focus:border-botanical focus:outline-none";

function Feedback({ result }: { result: AdminActionResult | null }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={`text-sm ${result.ok ? "text-botanical" : "text-disc-d"}`}
    >
      {result.message}
    </p>
  );
}

/**
 * Platform administration of Wellbeing Pulse governance.
 *
 * The panel makes the privilege boundary visible rather than only enforcing
 * it: granting a role is platform administration, but exercising governance —
 * changing the screening threshold or the confidentiality floor — requires the
 * governance role itself, and the threshold form says so when the administrator
 * does not hold it.
 */
export function WellbeingGovernance({
  organizations,
  grants,
  people,
  governedOrganizationIds,
}: {
  organizations: GovernanceOrganization[];
  grants: GovernanceGrant[];
  people: GovernancePerson[];
  /** Organisations where the signed-in administrator holds governance. */
  governedOrganizationIds: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [grantResult, setGrantResult] = useState<AdminActionResult | null>(null);
  const [policyResult, setPolicyResult] = useState<AdminActionResult | null>(null);
  const [taxonomyResult, setTaxonomyResult] = useState<AdminActionResult | null>(null);
  const [policyOrg, setPolicyOrg] = useState(organizations[0]?.id ?? "");

  const canGovern = governedOrganizationIds.includes(policyOrg);
  const selected = organizations.find((entry) => entry.id === policyOrg);

  const run = (
    action: (formData: FormData) => Promise<AdminActionResult>,
    formData: FormData,
    setResult: (result: AdminActionResult) => void,
  ) => {
    startTransition(async () => setResult(await action(formData)));
  };

  return (
    <div className="flex flex-col gap-8">
      {/* ── grants ────────────────────────────────────────────────── */}
      <section className="paper-card flex flex-col gap-5 p-6">
        <div>
          <h2 className="font-display text-h3 font-semibold">Wellbeing access</h2>
          <p className="mt-1.5 text-sm text-slate">
            Wellbeing roles are separate from team and platform administration and are never
            inherited from them. Neither role can read an individual&rsquo;s wellbeing responses or
            score — that capability does not exist in the schema.
          </p>
        </div>

        <form
          action={(formData) => run(grantWellbeingRoleAction, formData, setGrantResult)}
          className="grid gap-3 sm:grid-cols-4"
        >
          <select name="profile_id" required className={input} aria-label="Person">
            <option value="">Person…</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name || person.email}
              </option>
            ))}
          </select>
          <select name="organization_id" required className={input} aria-label="Organisation">
            <option value="">Organisation…</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          <select name="role" required className={input} aria-label="Role">
            <option value="wellbeing_analyst">Analyst — aggregate reporting</option>
            <option value="wellbeing_governance">Governance — threshold and policy</option>
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-botanical px-5 py-2.5 text-sm font-medium text-mineral disabled:opacity-60"
          >
            Grant
          </button>
        </form>
        <Feedback result={grantResult} />

        {grants.length > 0 ? (
          <ul className="divide-y divide-hairline">
            {grants.map((grant) => (
              <li key={grant.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="text-sm font-medium text-ink">{grant.personName}</span>
                <span className="text-xs text-slate">{grant.personEmail}</span>
                <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-medium text-ink">
                  {ROLE_LABEL[grant.role] ?? grant.role}
                </span>
                <span className="text-xs text-slate">{grant.organizationName}</span>
                <form
                  action={(formData) => run(revokeWellbeingRoleAction, formData, setGrantResult)}
                  className="ml-auto"
                >
                  <input type="hidden" name="grant_id" value={grant.id} />
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-full border border-hairline px-3 py-1 text-xs text-slate hover:text-disc-d disabled:opacity-60"
                  >
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate">No wellbeing roles are currently granted.</p>
        )}
      </section>

      {/* ── policy ────────────────────────────────────────────────── */}
      <section className="paper-card flex flex-col gap-5 p-6">
        <div>
          <h2 className="font-display text-h3 font-semibold">Screening policy</h2>
          <p className="mt-1.5 text-sm text-slate">
            GHQ-12 cut-offs vary between populations, settings and languages. The default of 4
            implements the widely-used 3/4 cut-off and has not been validated against any specific
            workforce. Changing it appends a new policy — existing results keep the threshold they
            were scored against.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className={input}
            value={policyOrg}
            onChange={(event) => setPolicyOrg(event.target.value)}
            aria-label="Organisation for policy"
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          {selected && (
            <p className="self-center font-mono text-xs text-slate">
              In force: threshold {selected.threshold} · minimum group {selected.minCohort}
              {selected.policyIsDefault ? " (platform default)" : ""}
            </p>
          )}
        </div>

        {canGovern ? (
          <form
            action={(formData) => run(setWellbeingPolicyAction, formData, setPolicyResult)}
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="organization_id" value={policyOrg} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
                Screening threshold (1–12)
                <input
                  name="screening_threshold"
                  type="number"
                  min={1}
                  max={12}
                  defaultValue={selected?.threshold ?? 4}
                  required
                  className={input}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
                Minimum reporting group (5 or more)
                <input
                  name="min_cohort_size"
                  type="number"
                  min={5}
                  max={100}
                  defaultValue={selected?.minCohort ?? 7}
                  required
                  className={input}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Rationale — the population this was validated against, and who approved it
              <textarea name="rationale" rows={3} minLength={20} required className={input} />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="w-fit rounded-full bg-botanical px-5 py-2.5 text-sm font-medium text-mineral disabled:opacity-60"
            >
              Record policy change
            </button>
          </form>
        ) : (
          <p className="rounded-xl border border-hairline bg-canvas px-4 py-3 text-sm text-slate">
            Changing the screening threshold requires the Wellbeing{" "}
            <strong className="font-medium text-ink">governance</strong> role for this
            organisation. Platform administration alone does not grant it — assign the role above
            first, so the change is attributable to someone accountable for it.
          </p>
        )}
        <Feedback result={policyResult} />
      </section>

      {/* ── taxonomy ──────────────────────────────────────────────── */}
      <section className="paper-card flex flex-col gap-5 p-6">
        <div>
          <h2 className="font-display text-h3 font-semibold">Department / Function catalogue</h2>
          <p className="mt-1.5 text-sm text-slate">
            The governed lookup participants choose from. Installing is additive — existing entries
            and renamed entries are left alone.
          </p>
        </div>
        <ul className="divide-y divide-hairline">
          {organizations.map((organization) => (
            <li key={organization.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="text-sm font-medium text-ink">{organization.name}</span>
              <span className="font-mono text-xs text-slate">
                {organization.departmentCount} functions · {organization.officeCount} offices
              </span>
              <form
                action={(formData) =>
                  run(installWellbeingTaxonomyAction, formData, setTaxonomyResult)
                }
                className="ml-auto"
              >
                <input type="hidden" name="organization_id" value={organization.id} />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full border border-hairline px-3.5 py-1.5 text-xs font-medium text-slate hover:text-botanical disabled:opacity-60"
                >
                  Install defaults
                </button>
              </form>
            </li>
          ))}
        </ul>
        <Feedback result={taxonomyResult} />
      </section>
    </div>
  );
}
