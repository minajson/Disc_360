/**
 * Identity reconciliation — the pure parts.
 *
 * Address normalisation, the alias state machine, the canonical-identity
 * recommendation and the conflict summary. None of it touches a database, so
 * the rules that decide "which of these two identities survives" and "what is
 * about to change" are unit-testable rather than only observable by running a
 * merge.
 *
 * One rule is enforced structurally rather than by discipline:
 * `recommendCanonical` returns a SUGGESTION and nothing else. Nothing in this
 * module — or anywhere downstream — merges on a name, a domain or a
 * similarity score. Two different people can share a name, and the cost of
 * being wrong is one person reading another person's behavioural report.
 */

export type AliasStatus = "active" | "retired";

export interface IdentityAlias {
  email: string;
  status: AliasStatus;
  provider: string;
  source: string;
  firstSeenAt: string;
  retiredAt: string | null;
}

export interface IdentityTeam {
  id: string;
  name: string;
  role: string;
}

/** One side of a reconciliation, as returned by `identity_summary`. */
export interface IdentitySummary {
  profileId: string;
  fullName: string;
  preferredName: string;
  email: string;
  createdAt: string;
  deactivatedAt: string | null;
  isSuperAdmin: boolean;
  discResults: number;
  focusResults: number;
  combinedSessions: number;
  discSessions: number;
  focusSessions: number;
  reportExports: number;
  teamMemberships: number;
  teams: IdentityTeam[];
  aliases: IdentityAlias[];
}

/** `Prince.Okafor@Company.COM ` → `prince.okafor@company.com` */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Server-side address validation. Intentionally the same shape as the report
 * delivery check — an address DISC360 will not send to is not an address worth
 * making someone's login.
 */
export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  if (/\s/.test(trimmed)) return false;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(trimmed);
}

/** The address currently used for sign-in and for delivering reports. */
export function activeAlias(aliases: IdentityAlias[]): IdentityAlias | null {
  return aliases.find((alias) => alias.status === "active") ?? null;
}

/**
 * Addresses this person has used before.
 *
 * These exist so an administrator searching an old address still finds the
 * person. They are never a delivery destination: a retired address is, by
 * definition, one we have been told to stop using.
 */
export function previousAliases(aliases: IdentityAlias[]): IdentityAlias[] {
  return aliases
    .filter((alias) => alias.status === "retired")
    .sort((a, b) => (b.retiredAt ?? "").localeCompare(a.retiredAt ?? ""));
}

/** Total records a merge would have to carry across. */
export function historyWeight(identity: IdentitySummary): number {
  return (
    identity.discResults +
    identity.focusResults +
    identity.combinedSessions +
    identity.teamMemberships
  );
}

export interface CanonicalRecommendation {
  /** Profile id we suggest keeping — a suggestion, never a default action. */
  profileId: string;
  reason: string;
}

/**
 * Which identity should survive.
 *
 * The one holding established history: re-parenting fewer rows is less to get
 * wrong, and the account someone has been using for a year is the one their
 * colleagues, invitations and team rosters already point at. Ties break to the
 * older account.
 *
 * This is advice for a human. The caller must still choose explicitly.
 */
export function recommendCanonical(
  a: IdentitySummary,
  b: IdentitySummary,
): CanonicalRecommendation {
  const weightA = historyWeight(a);
  const weightB = historyWeight(b);
  if (weightA !== weightB) {
    const winner = weightA > weightB ? a : b;
    return {
      profileId: winner.profileId,
      reason: "Holds the established history — fewer records have to move.",
    };
  }
  const older = a.createdAt <= b.createdAt ? a : b;
  return {
    profileId: older.profileId,
    reason: "Both hold the same amount of history; the older account is kept.",
  };
}

export type ReconciliationBlocker =
  | "super_admin_identity"
  | "retiring_already_deactivated"
  | "canonical_deactivated";

export const BLOCKER_MESSAGES: Record<ReconciliationBlocker, string> = {
  super_admin_identity:
    "A platform administrator account cannot be reconciled. Remove the administrator role first if this is genuinely the same person.",
  retiring_already_deactivated:
    "That identity has already been retired. Open its identity history to see what happened to it.",
  canonical_deactivated:
    "The surviving identity is deactivated. Reactivate it before reconciling anything into it.",
};

export interface SharedTeam {
  teamId: string;
  teamName: string;
  canonicalRole: string;
  retiringRole: string;
}

export interface ReconciliationPreflight {
  blockers: ReconciliationBlocker[];
  canonical: IdentitySummary;
  retiring: IdentitySummary;
  sharedTeams: SharedTeam[];
  sharedOrganizations: string[];
  attemptsToAbandon: { disc: number; focus: number; combined: number };
  singletons: { canonicalHasCoachProfile: boolean; retiringHasCoachProfile: boolean };
  projected: {
    discResults: number;
    focusResults: number;
    combinedSessions: number;
    teamMemberships: number;
  };
}

/** Which roster row survives when both identities sit on one team. */
export function resolveMembershipRole(canonicalRole: string, retiringRole: string): string {
  return canonicalRole === "team_admin" || retiringRole === "team_admin"
    ? "team_admin"
    : canonicalRole;
}

export interface PlanLine {
  label: string;
  before: string;
  after: string;
  /** Something is discarded or collapsed here — the admin should read it. */
  attention?: boolean;
}

/**
 * The plan an administrator confirms against: every number that changes, with
 * its before and after, and the losses stated rather than implied. If a merge
 * would abandon an unfinished attempt or collapse two roster rows, it says so
 * here — the confirmation screen is the last point at which that is cheap.
 */
export function buildReconciliationPlan(preflight: ReconciliationPreflight): PlanLine[] {
  const { canonical, retiring, projected, sharedTeams, attemptsToAbandon } = preflight;
  const abandoned =
    attemptsToAbandon.disc + attemptsToAbandon.focus + attemptsToAbandon.combined;

  const lines: PlanLine[] = [
    {
      label: "Sign-in email",
      before: canonical.email,
      after: retiring.email,
    },
    {
      label: "DISC results",
      before: String(canonical.discResults),
      after: String(projected.discResults),
    },
    {
      label: "Focus results",
      before: String(canonical.focusResults),
      after: String(projected.focusResults),
    },
    {
      label: "Combined assessments",
      before: String(canonical.combinedSessions),
      after: String(projected.combinedSessions),
    },
    {
      label: "Team memberships",
      before: String(canonical.teamMemberships),
      after: String(projected.teamMemberships),
      attention: sharedTeams.length > 0,
    },
  ];

  if (sharedTeams.length > 0) {
    lines.push({
      label: "Duplicate memberships to merge",
      before: sharedTeams.map((team) => team.teamName).join(", "),
      after: `${sharedTeams.length} collapsed to one row each`,
      attention: true,
    });
  }
  if (abandoned > 0) {
    lines.push({
      label: "Unfinished attempts discarded",
      before: String(abandoned),
      after: "abandoned",
      attention: true,
    });
  }

  lines.push({
    label: "Duplicate identity",
    before: retiring.email,
    after: "retired, never deleted",
  });

  return lines;
}

/**
 * Nothing is lost and nothing is invented: the surviving identity ends up with
 * exactly the sum of both sides. The database asserts this too, inside the
 * transaction — this is the version the administrator can read before agreeing
 * to it.
 */
export function projectionIsConservative(preflight: ReconciliationPreflight): boolean {
  const { canonical, retiring, projected } = preflight;
  return (
    projected.discResults === canonical.discResults + retiring.discResults &&
    projected.focusResults === canonical.focusResults + retiring.focusResults &&
    projected.combinedSessions === canonical.combinedSessions + retiring.combinedSessions
  );
}
