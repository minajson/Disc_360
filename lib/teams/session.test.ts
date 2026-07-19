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

test("participant card mirrors the coach's state", () => {
  const none = { hasOpenSession: false, hasResult: false };
  assert.equal(participantView("draft", none).cta, "none");
  assert.equal(participantView("presentation", none).cta, "join_live");
  assert.equal(participantView("assessment_open", none).cta, "begin_assessment");
  assert.equal(
    participantView("assessment_open", { hasOpenSession: true, hasResult: false }).cta,
    "continue_assessment",
  );
  assert.equal(
    participantView("assessment_open", { hasOpenSession: false, hasResult: true }).status,
    "Assessment submitted",
  );
  assert.equal(
    participantView("results", { hasOpenSession: false, hasResult: true }).cta,
    "view_result",
  );
  assert.equal(participantView("results", none).cta, "none");
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
