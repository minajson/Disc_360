import { isValidEmail, normalizeEmail } from "./model.ts";

/**
 * Canonical recipient resolution.
 *
 * `team_members.email` is a roster label captured when someone joined. Nothing
 * keeps it current, so after an identity change it can point at an address the
 * person has told us to stop using. Any feature that mails a team — the Team
 * Summary distribution being the immediate one — must resolve through the
 * canonical identity instead:
 *
 *     team_members.profile_id → profiles.email
 *
 * and fall back to the roster string ONLY for an entry nobody has claimed yet,
 * where there is no canonical identity to ask.
 *
 * Retired aliases are never a destination. A previous address exists so an
 * administrator can find the person; delivering to it would defeat the point
 * of having changed it.
 *
 * Pure, so the resolution rule is testable without a mail provider.
 */

export interface RosterEntry {
  teamMemberId: string;
  /** Null for a pre-created roster row nobody has signed up against yet. */
  profileId: string | null;
  displayName: string;
  /** The address captured on the roster. Not authoritative when claimed. */
  rosterEmail: string;
  /** The canonical account address, when this entry is claimed. */
  profileEmail?: string | null;
}

export type RecipientSource = "canonical" | "roster";

export interface ResolvedRecipient {
  teamMemberId: string;
  profileId: string | null;
  displayName: string;
  email: string;
  source: RecipientSource;
}

export interface UndeliverableRecipient {
  teamMemberId: string;
  profileId: string | null;
  displayName: string;
  reason: "no_address" | "invalid_address";
}

export interface RecipientResolution {
  deliverable: ResolvedRecipient[];
  undeliverable: UndeliverableRecipient[];
}

export function resolveRecipients(entries: RosterEntry[]): RecipientResolution {
  const deliverable: ResolvedRecipient[] = [];
  const undeliverable: UndeliverableRecipient[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    // A claimed entry answers with the account address, always — even when the
    // roster still carries the address the person joined under.
    const claimed = Boolean(entry.profileId);
    const candidate = claimed ? (entry.profileEmail ?? "") : entry.rosterEmail;
    const source: RecipientSource = claimed ? "canonical" : "roster";

    if (!candidate.trim()) {
      undeliverable.push({
        teamMemberId: entry.teamMemberId,
        profileId: entry.profileId,
        displayName: entry.displayName,
        reason: "no_address",
      });
      continue;
    }
    if (!isValidEmail(candidate)) {
      undeliverable.push({
        teamMemberId: entry.teamMemberId,
        profileId: entry.profileId,
        displayName: entry.displayName,
        reason: "invalid_address",
      });
      continue;
    }

    // One person, one message. After a reconciliation two roster rows can
    // legitimately resolve to the same account before the duplicate is
    // cleaned up, and nobody should receive the same report twice.
    const key = normalizeEmail(candidate);
    if (seen.has(key)) continue;
    seen.add(key);

    deliverable.push({
      teamMemberId: entry.teamMemberId,
      profileId: entry.profileId,
      displayName: entry.displayName,
      email: candidate.trim(),
      source,
    });
  }

  return { deliverable, undeliverable };
}

/** "3 participants have no deliverable email address." */
export function undeliverableSummary(resolution: RecipientResolution): string | null {
  const count = resolution.undeliverable.length;
  if (count === 0) return null;
  return `${count} participant${count === 1 ? " has" : "s have"} no deliverable email address.`;
}
