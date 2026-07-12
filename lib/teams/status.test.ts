import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveParticipantStatus } from "./status.ts";

const base = {
  hasProfile: false,
  hasOpenSession: false,
  hasResult: false,
  reportEmailed: false,
};

test("unclaimed roster entry is invited", () => {
  assert.equal(deriveParticipantStatus(base), "invited");
});

test("claimed account without activity is opened", () => {
  assert.equal(deriveParticipantStatus({ ...base, hasProfile: true }), "opened");
});

test("open session means started", () => {
  assert.equal(
    deriveParticipantStatus({ ...base, hasProfile: true, hasOpenSession: true }),
    "started",
  );
});

test("result outranks an open session", () => {
  assert.equal(
    deriveParticipantStatus({
      ...base,
      hasProfile: true,
      hasOpenSession: true,
      hasResult: true,
    }),
    "completed",
  );
});

test("report email upgrades completed to report_sent", () => {
  assert.equal(
    deriveParticipantStatus({
      ...base,
      hasProfile: true,
      hasResult: true,
      reportEmailed: true,
    }),
    "report_sent",
  );
});

test("report email without a result never reports report_sent", () => {
  assert.equal(
    deriveParticipantStatus({ ...base, hasProfile: true, reportEmailed: true }),
    "opened",
  );
});
