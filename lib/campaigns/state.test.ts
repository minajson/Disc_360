import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertTransition,
  canTransition,
  launchStatus,
  type CampaignStatus,
} from "./state.ts";

test("draft can launch, schedule or archive — nothing else", () => {
  assert.equal(canTransition("draft", "active"), true);
  assert.equal(canTransition("draft", "scheduled"), true);
  assert.equal(canTransition("draft", "archived"), true);
  assert.equal(canTransition("draft", "closed"), false);
});

test("active can close or archive, not return to draft", () => {
  assert.equal(canTransition("active", "closed"), true);
  assert.equal(canTransition("active", "archived"), true);
  assert.equal(canTransition("active", "draft"), false);
  assert.equal(canTransition("active", "scheduled"), false);
});

test("closed campaigns can reopen", () => {
  assert.equal(canTransition("closed", "active"), true);
  assert.equal(canTransition("closed", "archived"), true);
  assert.equal(canTransition("closed", "draft"), false);
});

test("archived is terminal", () => {
  for (const to of ["draft", "scheduled", "active", "closed"] as CampaignStatus[]) {
    assert.equal(canTransition("archived", to), false);
  }
});

test("assertTransition throws on invalid moves", () => {
  assert.throws(() => assertTransition("archived", "active"));
  assert.doesNotThrow(() => assertTransition("scheduled", "active"));
});

test("launch status respects future start dates", () => {
  const now = new Date("2026-07-11T12:00:00Z");
  assert.equal(launchStatus(null, now), "active");
  assert.equal(launchStatus("2026-07-01T00:00:00Z", now), "active");
  assert.equal(launchStatus("2026-08-01T00:00:00Z", now), "scheduled");
});
