import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveRecipients, undeliverableSummary, type RosterEntry } from "./recipients.ts";

const claimed = (overrides: Partial<RosterEntry> = {}): RosterEntry => ({
  teamMemberId: "m1",
  profileId: "p1",
  displayName: "Prince Okafor",
  rosterEmail: "prince.old@company.com",
  profileEmail: "prince.new@company.com",
  ...overrides,
});

test("a claimed roster entry resolves to the canonical account address", () => {
  const { deliverable } = resolveRecipients([claimed()]);
  assert.equal(deliverable.length, 1);
  assert.equal(deliverable[0]!.email, "prince.new@company.com");
  assert.equal(deliverable[0]!.source, "canonical");
});

test("a retired address is never a delivery destination", () => {
  // The roster still carries the address the person joined under. After an
  // identity change that address is precisely the one we were told to stop
  // using, so it must not appear anywhere in the result.
  const { deliverable } = resolveRecipients([claimed()]);
  const addresses = deliverable.map((recipient) => recipient.email);
  assert.ok(!addresses.includes("prince.old@company.com"), addresses.join());
});

test("an unclaimed roster entry falls back to the roster address", () => {
  const { deliverable } = resolveRecipients([
    { teamMemberId: "m2", profileId: null, displayName: "Not Joined Yet", rosterEmail: "pending@company.com" },
  ]);
  assert.equal(deliverable[0]!.email, "pending@company.com");
  assert.equal(deliverable[0]!.source, "roster");
});

test("a claimed entry whose account has no address is undeliverable, not fallen back", () => {
  // Falling back to the roster string here would mail the retired address.
  const { deliverable, undeliverable } = resolveRecipients([
    claimed({ profileEmail: "" }),
  ]);
  assert.equal(deliverable.length, 0);
  assert.equal(undeliverable[0]!.reason, "no_address");
});

test("invalid addresses are surfaced rather than attempted", () => {
  const { deliverable, undeliverable } = resolveRecipients([
    { teamMemberId: "m3", profileId: null, displayName: "Typo", rosterEmail: "not-an-email" },
    { teamMemberId: "m4", profileId: null, displayName: "Blank", rosterEmail: "   " },
  ]);
  assert.equal(deliverable.length, 0);
  assert.deepEqual(
    undeliverable.map((entry) => entry.reason),
    ["invalid_address", "no_address"],
  );
});

test("one person receives one message even from two roster rows", () => {
  // Two rows can legitimately resolve to one account between a reconciliation
  // and its roster cleanup. Nobody should get the report twice.
  const { deliverable } = resolveRecipients([
    claimed({ teamMemberId: "m1", rosterEmail: "prince.old@company.com" }),
    claimed({ teamMemberId: "m2", rosterEmail: "prince.new@company.com" }),
  ]);
  assert.equal(deliverable.length, 1);
});

test("deduplication is case-insensitive", () => {
  const { deliverable } = resolveRecipients([
    claimed({ teamMemberId: "m1", profileEmail: "Prince@Company.com" }),
    claimed({ teamMemberId: "m2", profileId: "p2", profileEmail: "prince@company.com" }),
  ]);
  assert.equal(deliverable.length, 1);
});

test("the undeliverable count is reported in plain language", () => {
  const none = resolveRecipients([claimed()]);
  assert.equal(undeliverableSummary(none), null);

  const some = resolveRecipients([
    claimed({ profileEmail: "" }),
    claimed({ teamMemberId: "m2", profileId: "p2", profileEmail: "" }),
    claimed({ teamMemberId: "m3", profileId: "p3", profileEmail: "" }),
  ]);
  assert.equal(undeliverableSummary(some), "3 participants have no deliverable email address.");

  const one = resolveRecipients([claimed({ profileEmail: "" })]);
  assert.equal(undeliverableSummary(one), "1 participant has no deliverable email address.");
});
