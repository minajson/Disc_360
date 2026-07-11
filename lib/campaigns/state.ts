/**
 * Campaign lifecycle — pure and unit-testable.
 * draft → scheduled → active → closed → archived, with reopen (closed→active)
 * and direct draft→active launches.
 */

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "closed"
  | "archived";

const TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["scheduled", "active", "archived"],
  scheduled: ["active", "draft", "archived"],
  active: ["closed", "archived"],
  closed: ["active", "archived"],
  archived: [],
};

export function canTransition(
  from: CampaignStatus,
  to: CampaignStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: CampaignStatus,
  to: CampaignStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid campaign transition: ${from} → ${to}`);
  }
}

/** Status a launched campaign should take given its start date. */
export function launchStatus(startsAt: string | null, now: Date): CampaignStatus {
  if (startsAt && new Date(startsAt) > now) return "scheduled";
  return "active";
}
