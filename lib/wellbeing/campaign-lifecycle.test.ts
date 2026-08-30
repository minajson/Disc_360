import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  admitsParticipants,
  controlsFor,
  joiningSummary,
  LIFECYCLE_CONFIRMATION,
  LIFECYCLE_DETAIL,
  LIFECYCLE_LABEL,
  lifecycleOf,
  PARTICIPANT_REFUSAL,
  readCapacity,
  resultOf,
  statusValueOf,
  type CampaignLifecycle,
  type LifecycleAction,
} from "./campaign-lifecycle.ts";

/**
 * The campaign lifecycle.
 *
 * The bug these tests exist because of: a facilitator was shown "Joining is
 * switched off" on a campaign that was admitting participants normally, with
 * no control anywhere to change it. Two of the tests below are about the
 * lifecycle being correct; the rest are about it being OPERABLE and about it
 * never costing anybody their answers.
 */

const ALL: CampaignLifecycle[] = ["draft", "open", "paused", "closed", "archived"];

/* ── the state, and where it comes from ─────────────────────────────── */

test("the stored status maps to the spoken lifecycle in both directions", () => {
  assert.equal(lifecycleOf("active"), "open");
  assert.equal(lifecycleOf("draft"), "draft");
  assert.equal(lifecycleOf("paused"), "paused");
  assert.equal(lifecycleOf("closed"), "closed");
  assert.equal(lifecycleOf("archived"), "archived");

  for (const lifecycle of ALL) {
    assert.equal(lifecycleOf(statusValueOf(lifecycle)), lifecycle);
  }
});

test("an unrecognised status refuses participants rather than admitting them", () => {
  // A build that meets a status it does not know must fail closed. `draft` is
  // the state that refuses while still being administrable.
  for (const unknown of ["", "suspended", "ACTIVE", null, undefined]) {
    assert.equal(lifecycleOf(unknown as string), "draft");
    assert.equal(admitsParticipants(lifecycleOf(unknown as string)), false);
  }
});

test("exactly one state admits participants", () => {
  const admitting = ALL.filter(admitsParticipants);
  assert.deepEqual(admitting, ["open"]);
});

test("every state says plainly whether people can join", () => {
  for (const lifecycle of ALL) {
    const summary = joiningSummary(lifecycle);
    assert.match(summary, /^Participants can(not)? join\.$/);
    assert.equal(summary === "Participants can join.", admitsParticipants(lifecycle));
  }
});

/* ── the controls the facilitator is given ──────────────────────────── */

test("every operable state offers a control, and archived deliberately does not", () => {
  assert.deepEqual(
    controlsFor("draft").map((control) => control.action),
    ["open"],
  );
  assert.deepEqual(
    controlsFor("open").map((control) => control.action),
    ["pause", "close"],
  );
  assert.deepEqual(
    controlsFor("paused").map((control) => control.action),
    ["resume", "close"],
  );
  assert.deepEqual(
    controlsFor("closed").map((control) => control.action),
    ["reopen", "archive"],
  );
  assert.deepEqual(controlsFor("archived"), []);
});

test("a paused campaign always offers a way to resume", () => {
  // The reported defect in one line: a state with no way out of it.
  const resume = controlsFor("paused").find((control) => control.action === "resume");
  assert.ok(resume, "paused must offer Resume joining");
  assert.equal(resume!.label, "Resume joining");
  assert.equal(resume!.primary, true);
});

test("at most one control per state is the primary one", () => {
  for (const lifecycle of ALL) {
    const primary = controlsFor(lifecycle).filter((control) => control.primary);
    assert.ok(primary.length <= 1, `${lifecycle} offers ${primary.length} primary controls`);
  }
});

test("closing confirms; pausing does not", () => {
  const close = controlsFor("open").find((control) => control.action === "close")!;
  assert.ok(close.confirm, "closing a campaign must ask first");
  assert.match(close.confirm!, /kept/i, "the confirmation must say responses are kept");

  const pause = controlsFor("open").find((control) => control.action === "pause")!;
  assert.equal(pause.confirm, null, "pausing mid-session must not open a dialog");

  const reopen = controlsFor("closed").find((control) => control.action === "reopen")!;
  assert.ok(reopen.confirm, "reopening a campaign must ask first");
  const archive = controlsFor("closed").find((control) => control.action === "archive")!;
  assert.ok(archive.confirm);
  assert.match(archive.confirm!, /Nothing is deleted/i);
});

test("an action not offered from a state is refused rather than applied", () => {
  assert.equal(resultOf("open", "open"), null);
  assert.equal(resultOf("draft", "pause"), null);
  assert.equal(resultOf("closed", "pause"), null);
  assert.equal(resultOf("archived", "reopen"), null);
  // Archived is reachable only from closed, and never named directly by a
  // client: there is no transition into it from a running campaign.
  for (const lifecycle of ALL) {
    if (lifecycle === "closed") continue;
    assert.equal(resultOf(lifecycle, "archive"), null);
  }
});

test("each offered action lands where the facilitator was told it would", () => {
  assert.equal(resultOf("draft", "open"), "open");
  assert.equal(resultOf("open", "pause"), "paused");
  assert.equal(resultOf("paused", "resume"), "open");
  assert.equal(resultOf("open", "close"), "closed");
  assert.equal(resultOf("paused", "close"), "closed");
  assert.equal(resultOf("closed", "reopen"), "open");
  assert.equal(resultOf("closed", "archive"), "archived");
});

test("pause then resume returns a campaign to exactly where it started", () => {
  const paused = resultOf("open", "pause")!;
  assert.equal(resultOf(paused, "resume"), "open");
});

/* ── what everybody is told ─────────────────────────────────────────── */

test("every state has a label, a detail, and neither is engineering vocabulary", () => {
  const forbidden =
    /opaque|token|derived|pinned|schema|column|nullable|boolean|join_enabled|version_id/i;
  for (const lifecycle of ALL) {
    assert.ok(LIFECYCLE_LABEL[lifecycle], `${lifecycle} has no label`);
    assert.ok(LIFECYCLE_DETAIL[lifecycle], `${lifecycle} has no detail`);
    assert.doesNotMatch(LIFECYCLE_LABEL[lifecycle], forbidden);
    assert.doesNotMatch(LIFECYCLE_DETAIL[lifecycle], forbidden);
  }
});

test("every non-open state tells a participant what is happening without blaming them", () => {
  for (const lifecycle of ALL) {
    if (lifecycle === "open") continue;
    const message = PARTICIPANT_REFUSAL[lifecycle];
    assert.ok(message, `${lifecycle} has no participant message`);
    assert.doesNotMatch(message, /you (cannot|are not) (allowed|permitted|eligible)/i);
    assert.doesNotMatch(message, /error|invalid|denied|forbidden/i);
  }
});

test("no state's wording tells a participant their answers were lost", () => {
  const texts = [
    ...ALL.map((lifecycle) => LIFECYCLE_DETAIL[lifecycle]),
    ...Object.values(LIFECYCLE_CONFIRMATION),
    ...Object.values(PARTICIPANT_REFUSAL),
  ];
  for (const text of texts) {
    // The words themselves are allowed — "Nothing is deleted" is the
    // reassurance a facilitator needs before archiving. What is forbidden is
    // an affirmative claim that somebody's answers went away.
    assert.doesNotMatch(
      text,
      /(responses|answers|data|results)[^.]{0,40}\b(deleted|erased|removed|discarded|lost)/i,
    );
  }
});

test("pausing and closing both promise the responses are kept", () => {
  assert.match(LIFECYCLE_DETAIL.paused, /kept/i);
  assert.match(LIFECYCLE_DETAIL.closed, /kept/i);
  assert.match(LIFECYCLE_DETAIL.archived, /kept/i);
});

/* ── capacity is reported beside the state, never as it ─────────────── */

test("capacity is a fact about a campaign, not one of its states", () => {
  // "At capacity" used to be a lifecycle value, which left a full campaign
  // with no answer to "is this open?" and no action to take.
  assert.ok(!ALL.includes("full" as CampaignLifecycle));

  assert.deepEqual(readCapacity(null, 12), {
    remaining: null,
    label: "Unrestricted",
    isFull: false,
  });
  assert.deepEqual(readCapacity(30, 12), {
    remaining: 18,
    label: "18 places remaining",
    isFull: false,
  });
  assert.equal(readCapacity(30, 29).label, "1 place remaining");
  assert.deepEqual(readCapacity(30, 30), {
    remaining: 0,
    label: "No places remaining",
    isFull: true,
  });
  // Over-subscription is a data state, not a negative number on screen.
  assert.deepEqual(readCapacity(30, 34), {
    remaining: 0,
    label: "No places remaining",
    isFull: true,
  });
});

/* ── the promise that no transition destroys data ───────────────────── */

test("the lifecycle action deletes nothing, and touches no participant table", () => {
  const source = readFileSync(
    new URL("../actions/wellbeing-campaign.ts", import.meta.url),
    "utf8",
  );

  assert.ok(
    !/\.delete\(/.test(source),
    "the lifecycle action must never issue a delete: pausing, closing, reopening and archiving are status changes",
  );

  for (const table of [
    "wellbeing_sessions",
    "wellbeing_responses",
    "wellbeing_results",
    "wellbeing_report_deliveries",
  ]) {
    assert.ok(
      !source.includes(`"${table}"`),
      `the lifecycle action must not touch ${table}`,
    );
  }
});

test("the facilitator's state is read from the campaign, never from the DISC join flag", () => {
  const source = readFileSync(
    new URL("./campaign-workspace.ts", import.meta.url),
    "utf8",
  );
  // `join_enabled` is false on EVERY wellbeing roster on purpose — it is what
  // stops the DISC invitation resolver admitting a wellbeing participant. It
  // was being read as "this campaign is closed". It may appear in prose
  // explaining that; it may not appear in a selected column list.
  const selects = source.match(/\.select\([\s\S]*?\)/g) ?? [];
  for (const select of selects) {
    assert.ok(
      !select.includes("join_enabled"),
      "campaign lifecycle must not be derived from teams.join_enabled",
    );
  }
});

test("every action has a confirmation sentence for after it succeeds", () => {
  const actions: LifecycleAction[] = ["open", "pause", "resume", "close", "reopen", "archive"];
  for (const action of actions) {
    assert.ok(LIFECYCLE_CONFIRMATION[action], `${action} has no confirmation`);
  }
});
