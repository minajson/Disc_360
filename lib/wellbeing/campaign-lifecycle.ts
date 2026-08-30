/**
 * Wellbeing Pulse — the campaign lifecycle a facilitator actually operates.
 *
 * ─────────────────────────────────────────────────────────────────────
 * FOUR STATES, AND WHY NOT FIVE.
 *
 *   DRAFT   prepared, not admitting. Deliberate, never the default.
 *   OPEN    participants can join.
 *   PAUSED  joining temporarily off. Nothing already answered is affected.
 *   CLOSED  ended. Historical data retained in full.
 *
 * ARCHIVED exists in the database as a filing state and is surfaced here, but
 * it is not a state a facilitator moves a live campaign into from the running
 * panel; it is where a closed campaign goes to leave the working list.
 *
 * "AT CAPACITY" IS NOT A LIFECYCLE STATE, DELIBERATELY.
 *
 * It used to be. A campaign that had filled its places reported its status as
 * "At capacity", which reads as something the facilitator did and offers no
 * action — while the real question, "is this campaign open?", had no answer on
 * screen. Capacity is a fact ABOUT an open campaign, so it is reported beside
 * the state ("Open · 4 places remaining"), never instead of it.
 *
 * WHERE THE STATE COMES FROM.
 *
 * `wellbeing_campaigns.status`, and nothing else. It is the same column
 * `wellbeing_campaign_admits()` and `wellbeing_campaign_by_token()` consult,
 * so what a facilitator is told and what a scanner experiences cannot diverge.
 *
 * In particular it is NOT `teams.join_enabled`. That flag is false for every
 * wellbeing roster on purpose — it is what stops the DISC invitation resolver
 * delivering a wellbeing participant into the DISC assessment — and reading it
 * as a wellbeing lifecycle state is what put "Joining is switched off" on
 * every healthy production campaign with no control to switch it back on.
 *
 * NO TRANSITION DESTROYS DATA.
 *
 * Every transition below is a status change on the campaign row. Pausing,
 * closing, reopening and archiving leave `wellbeing_sessions`,
 * `wellbeing_responses` and `wellbeing_results` untouched — see
 * `campaign-lifecycle.test.ts`, which asserts the action module contains no
 * delete against any of them.
 * ─────────────────────────────────────────────────────────────────────
 */

/** The lifecycle as the product speaks it. */
export type CampaignLifecycle = "draft" | "open" | "paused" | "closed" | "archived";

/** The lifecycle as `wellbeing_campaigns.status` stores it. */
export type CampaignStatusValue = "draft" | "active" | "paused" | "closed" | "archived";

const FROM_STATUS: Record<CampaignStatusValue, CampaignLifecycle> = {
  draft: "draft",
  active: "open",
  paused: "paused",
  closed: "closed",
  archived: "archived",
};

const TO_STATUS: Record<CampaignLifecycle, CampaignStatusValue> = {
  draft: "draft",
  open: "active",
  paused: "paused",
  closed: "closed",
  archived: "archived",
};

/**
 * `active` is the stored word and `open` is the spoken one. An unknown value
 * resolves to `draft` rather than throwing: a campaign whose status this build
 * does not recognise must not admit anybody, and `draft` is the state that
 * refuses while still being administrable.
 */
export function lifecycleOf(status: string | null | undefined): CampaignLifecycle {
  return FROM_STATUS[status as CampaignStatusValue] ?? "draft";
}

export function statusValueOf(lifecycle: CampaignLifecycle): CampaignStatusValue {
  return TO_STATUS[lifecycle];
}

/**
 * The single question every participant-facing path asks.
 *
 * Expiry is checked by the caller that holds it — this function is about the
 * lifecycle alone, and the database enforces expiry independently in
 * `wellbeing_campaign_admits()`.
 */
export function admitsParticipants(lifecycle: CampaignLifecycle): boolean {
  return lifecycle === "open";
}

/* ── what the facilitator is told ───────────────────────────────────── */

export const LIFECYCLE_LABEL: Record<CampaignLifecycle, string> = {
  draft: "Draft",
  open: "Campaign open",
  paused: "Campaign paused",
  closed: "Campaign closed",
  archived: "Campaign archived",
};

/**
 * The sentence under the label. Written for the person running the room, not
 * for the person who wrote the schema: it says what is true for participants
 * right now, and it always says what happened to existing responses, because
 * "does pausing lose the answers we already have?" is the first thing a
 * facilitator asks and the answer is always no.
 */
export const LIFECYCLE_DETAIL: Record<CampaignLifecycle, string> = {
  draft: "Not yet open. Participants who scan the code are asked to check back.",
  open: "Participants can join using the QR code or link.",
  paused: "New participants cannot currently join. Responses already given are kept.",
  closed: "This campaign has ended. All responses are kept and reporting continues.",
  archived: "Archived and no longer running. All responses are kept.",
};

/** Whether the state means participants can join, in one plain sentence. */
export function joiningSummary(lifecycle: CampaignLifecycle): string {
  return admitsParticipants(lifecycle)
    ? "Participants can join."
    : "Participants cannot join.";
}

/* ── the actions ────────────────────────────────────────────────────── */

export type LifecycleAction = "open" | "pause" | "resume" | "close" | "reopen" | "archive";

export interface LifecycleControl {
  action: LifecycleAction;
  label: string;
  /** Primary gets the filled button; there is at most one per state. */
  primary: boolean;
  /**
   * Irreversible-feeling or wide-reaching transitions confirm first. Closing
   * ends a campaign people may be halfway through, and archiving takes it off
   * the working list, so both ask. Pausing and resuming do not — a facilitator
   * pausing a room mid-session should not have to read a dialog.
   */
  confirm: string | null;
}

const CONTROLS: Record<LifecycleAction, LifecycleControl> = {
  open: { action: "open", label: "Open campaign", primary: true, confirm: null },
  pause: { action: "pause", label: "Pause joining", primary: true, confirm: null },
  resume: { action: "resume", label: "Resume joining", primary: true, confirm: null },
  close: {
    action: "close",
    label: "Close campaign",
    primary: false,
    confirm:
      "Close this campaign? New participants will not be able to join. Everything already answered is kept, and reporting continues.",
  },
  reopen: {
    action: "reopen",
    label: "Reopen campaign",
    primary: true,
    confirm:
      "Reopen this campaign? Participants will be able to join again, and new responses will be added to the ones already recorded.",
  },
  archive: {
    action: "archive",
    label: "Archive campaign",
    primary: false,
    confirm:
      "Archive this campaign? It leaves your working list. Nothing is deleted and its reporting stays available.",
  },
};

/**
 * The transitions offered in each state — in the order they should be shown,
 * primary first.
 *
 * An archived campaign offers nothing. Un-archiving is a governance act, not a
 * button on the operational panel, and offering it here would put the most
 * consequential transition in the product beside "Pause joining".
 */
const ALLOWED: Record<CampaignLifecycle, LifecycleAction[]> = {
  draft: ["open"],
  open: ["pause", "close"],
  paused: ["resume", "close"],
  closed: ["reopen", "archive"],
  archived: [],
};

export function controlsFor(lifecycle: CampaignLifecycle): LifecycleControl[] {
  return ALLOWED[lifecycle].map((action) => CONTROLS[action]);
}

/** The state an action lands in, or null if it is not offered from here. */
export function resultOf(
  lifecycle: CampaignLifecycle,
  action: LifecycleAction,
): CampaignLifecycle | null {
  if (!ALLOWED[lifecycle].includes(action)) return null;
  switch (action) {
    case "open":
    case "resume":
    case "reopen":
      return "open";
    case "pause":
      return "paused";
    case "close":
      return "closed";
    case "archive":
      return "archived";
  }
}

/** What the facilitator is told after the transition succeeded. */
export const LIFECYCLE_CONFIRMATION: Record<LifecycleAction, string> = {
  open: "Campaign open. Participants can join using the QR code or link.",
  pause: "Joining paused. Responses already given are unaffected.",
  resume: "Joining resumed. Participants can join again.",
  close: "Campaign closed. All responses are kept and reporting continues.",
  reopen: "Campaign reopened. Participants can join again.",
  archive: "Campaign archived. Nothing was deleted.",
};

/* ── what a participant is told ─────────────────────────────────────── */

/**
 * Written for somebody standing in a corridor holding a phone. It says what
 * to do next, and it never blames them for the state of the campaign.
 */
export const PARTICIPANT_REFUSAL: Record<
  Exclude<CampaignLifecycle, "open">,
  string
> = {
  draft: "This check-in has not opened yet. Please check back with whoever invited you.",
  paused:
    "This check-in is paused, so it is not accepting new participants at the moment. Please check back with whoever invited you.",
  closed: "This check-in has ended, so it is no longer accepting responses.",
  archived: "This check-in has ended, so it is no longer accepting responses.",
};

/* ── capacity, reported beside the state and never as it ────────────── */

export interface CapacityReading {
  /** Null when the campaign is uncapped. */
  remaining: number | null;
  label: string;
  isFull: boolean;
}

export function readCapacity(capacity: number | null, joined: number): CapacityReading {
  if (capacity === null) return { remaining: null, label: "Unrestricted", isFull: false };
  const remaining = Math.max(0, capacity - joined);
  return {
    remaining,
    label:
      remaining === 0
        ? "No places remaining"
        : `${remaining} place${remaining === 1 ? "" : "s"} remaining`,
    isFull: remaining === 0,
  };
}
