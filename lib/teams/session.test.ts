import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canTransition,
  participantView,
  qrFilename,
  reviewAllowed,
} from "./session.ts";

test("session transitions follow the facilitated flow", () => {
  assert.ok(canTransition("draft", "presentation"));
  assert.ok(canTransition("presentation", "assessment_open"));
  assert.ok(canTransition("assessment_open", "assessment_closed"));
  assert.ok(canTransition("assessment_closed", "results"));
  assert.ok(canTransition("results", "ended"));
  // honest reversals
  assert.ok(canTransition("assessment_closed", "assessment_open"));
  assert.ok(canTransition("assessment_open", "presentation"));
  // illegal jumps
  assert.ok(!canTransition("draft", "results"));
  assert.ok(!canTransition("presentation", "results"));
  assert.ok(!canTransition("ended", "results"));
});

test("the assessment is startable in EVERY session state — no facilitator gate", () => {
  const none = { hasOpenSession: false, hasResult: false };
  const states = [
    "draft",
    "presentation",
    "assessment_open",
    "assessment_closed",
    "results",
    "ended",
  ] as const;
  for (const state of states) {
    assert.equal(participantView(state, none).cta, "begin_assessment", `begin in ${state}`);
    assert.equal(
      participantView(state, { hasOpenSession: true, hasResult: false }).cta,
      "continue_assessment",
      `resume in ${state}`,
    );
  }
});

test("participant card reflects progress; results wait on the facilitator's release", () => {
  const none = { hasOpenSession: false, hasResult: false };
  // The live deck is offered alongside the assessment while presenting.
  assert.equal(participantView("presentation", none).joinLive, true);
  assert.equal(participantView("assessment_open", none).joinLive, false);
  // Submitted → waiting until the facilitator releases; then the result opens.
  const done = { hasOpenSession: false, hasResult: true };
  assert.match(participantView("assessment_open", done).status, /Assessment submitted/);
  assert.equal(participantView("assessment_open", done).cta, "waiting");
  assert.equal(participantView("assessment_closed", done).cta, "waiting");
  assert.equal(participantView("results", done).cta, "view_result");
  assert.equal(participantView("ended", done).cta, "view_result");
});

test("review access respects the coach's presentation setting", () => {
  assert.ok(!reviewAllowed("results", "live_only"));
  assert.ok(reviewAllowed("presentation", "live_and_review"));
  assert.ok(!reviewAllowed("presentation", "review_after_session"));
  assert.ok(reviewAllowed("assessment_open", "review_after_session"));
  assert.ok(reviewAllowed("ended", "review_after_session"));
});

test("QR filename is sanitized and stable", () => {
  assert.equal(qrFilename("NGRE"), "DISC360-NGRE-QR.png");
  assert.equal(qrFilename("Équipe Alpha #1!"), "DISC360-Equipe-Alpha-1-QR.png");
  assert.equal(qrFilename("  "), "DISC360-team-QR.png");
});
