import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activeAlias,
  buildReconciliationPlan,
  historyWeight,
  isValidEmail,
  normalizeEmail,
  previousAliases,
  projectionIsConservative,
  recommendCanonical,
  resolveMembershipRole,
  type IdentitySummary,
  type ReconciliationPreflight,
} from "./model.ts";

function identity(overrides: Partial<IdentitySummary> = {}): IdentitySummary {
  return {
    profileId: "00000000-0000-4000-8000-00000000000a",
    fullName: "Prince Okafor",
    preferredName: "Prince",
    email: "prince.old@company.com",
    createdAt: "2026-05-10T09:00:00.000Z",
    deactivatedAt: null,
    isSuperAdmin: false,
    discResults: 3,
    focusResults: 2,
    combinedSessions: 1,
    discSessions: 4,
    focusSessions: 2,
    reportExports: 0,
    teamMemberships: 3,
    teams: [],
    aliases: [],
    ...overrides,
  };
}

const B = identity({
  profileId: "00000000-0000-4000-8000-00000000000b",
  email: "prince.new@company.com",
  createdAt: "2026-08-07T09:00:00.000Z",
  discResults: 1,
  focusResults: 0,
  combinedSessions: 0,
  discSessions: 1,
  focusSessions: 0,
  teamMemberships: 1,
});

function preflight(overrides: Partial<ReconciliationPreflight> = {}): ReconciliationPreflight {
  const canonical = identity();
  return {
    blockers: [],
    canonical,
    retiring: B,
    sharedTeams: [],
    sharedOrganizations: [],
    attemptsToAbandon: { disc: 0, focus: 0, combined: 0 },
    singletons: { canonicalHasCoachProfile: false, retiringHasCoachProfile: false },
    projected: {
      discResults: canonical.discResults + B.discResults,
      focusResults: canonical.focusResults + B.focusResults,
      combinedSessions: canonical.combinedSessions + B.combinedSessions,
      teamMemberships: canonical.teamMemberships + B.teamMemberships,
    },
    ...overrides,
  };
}

test("email normalisation is case- and whitespace-insensitive", () => {
  assert.equal(normalizeEmail("  Prince.Okafor@Company.COM "), "prince.okafor@company.com");
  assert.equal(normalizeEmail("a@b.co"), "a@b.co");
});

test("email validation rejects what would break delivery or a header", () => {
  assert.ok(isValidEmail("prince@company.com"));
  assert.ok(isValidEmail("first.last+tag@sub.example.co.uk"));
  assert.ok(!isValidEmail(""));
  assert.ok(!isValidEmail("prince@company"));
  assert.ok(!isValidEmail("prince@@company.com"));
  assert.ok(!isValidEmail("prince @company.com"));
  assert.ok(!isValidEmail("prince@company.com\nbcc: someone@else.com"));
});

test("exactly one alias is active; the rest are history, newest first", () => {
  const aliases = [
    { email: "old@c.com", status: "retired" as const, provider: "email", source: "reconciliation", firstSeenAt: "2026-01-01", retiredAt: "2026-06-01" },
    { email: "new@c.com", status: "active" as const, provider: "email", source: "auth_sync", firstSeenAt: "2026-06-01", retiredAt: null },
    { email: "older@c.com", status: "retired" as const, provider: "email", source: "signup", firstSeenAt: "2025-01-01", retiredAt: "2026-01-01" },
  ];
  assert.equal(activeAlias(aliases)?.email, "new@c.com");
  assert.deepEqual(
    previousAliases(aliases).map((alias) => alias.email),
    ["old@c.com", "older@c.com"],
  );
});

test("the identity holding established history is recommended", () => {
  const a = identity();
  assert.equal(historyWeight(a), 9);
  assert.equal(historyWeight(B), 2);
  assert.equal(recommendCanonical(a, B).profileId, a.profileId);
  // Order of the arguments must not change the answer.
  assert.equal(recommendCanonical(B, a).profileId, a.profileId);
});

test("an even match falls back to the older account, never to a name", () => {
  const older = identity({ profileId: "older", createdAt: "2025-01-01T00:00:00.000Z" });
  const newer = identity({ profileId: "newer", createdAt: "2026-01-01T00:00:00.000Z" });
  const recommendation = recommendCanonical(newer, older);
  assert.equal(recommendation.profileId, "older");
  assert.match(recommendation.reason, /older account/);
});

test("the recommendation is advice — it carries no authority to act", () => {
  // The whole safety property: recommendCanonical returns data. It has no way
  // to cause a merge, so a name or domain collision cannot produce one.
  const recommendation = recommendCanonical(identity(), B);
  assert.deepEqual(Object.keys(recommendation).sort(), ["profileId", "reason"]);
  assert.equal(typeof recommendation.profileId, "string");
});

test("a facilitator role survives the merge of two roster rows", () => {
  assert.equal(resolveMembershipRole("member", "team_admin"), "team_admin");
  assert.equal(resolveMembershipRole("team_admin", "member"), "team_admin");
  assert.equal(resolveMembershipRole("member", "member"), "member");
});

test("the plan states the new sign-in address and the summed totals", () => {
  const plan = buildReconciliationPlan(preflight());
  const byLabel = new Map(plan.map((line) => [line.label, line]));
  assert.equal(byLabel.get("Sign-in email")?.before, "prince.old@company.com");
  assert.equal(byLabel.get("Sign-in email")?.after, "prince.new@company.com");
  assert.equal(byLabel.get("DISC results")?.before, "3");
  assert.equal(byLabel.get("DISC results")?.after, "4");
  assert.equal(byLabel.get("Focus results")?.after, "2");
  assert.equal(byLabel.get("Duplicate identity")?.after, "retired, never deleted");
});

test("the plan flags what is collapsed or discarded rather than implying it", () => {
  const plan = buildReconciliationPlan(
    preflight({
      sharedTeams: [
        { teamId: "t1", teamName: "Applications & ERP", canonicalRole: "member", retiringRole: "team_admin" },
      ],
      attemptsToAbandon: { disc: 1, focus: 0, combined: 0 },
    }),
  );
  const attention = plan.filter((line) => line.attention).map((line) => line.label);
  assert.ok(attention.includes("Duplicate memberships to merge"), attention.join());
  assert.ok(attention.includes("Unfinished attempts discarded"), attention.join());
  assert.ok(attention.includes("Team memberships"), attention.join());

  const discarded = plan.find((line) => line.label === "Unfinished attempts discarded");
  assert.equal(discarded?.before, "1");
});

test("a projection that is not the exact sum of both sides is rejected", () => {
  assert.ok(projectionIsConservative(preflight()));

  // One result quietly appearing — the shape a duplicating merge would take.
  const inflated = preflight();
  inflated.projected.discResults += 1;
  assert.ok(!projectionIsConservative(inflated), "an extra result must not pass");

  // One result quietly vanishing.
  const lossy = preflight();
  lossy.projected.focusResults -= 1;
  assert.ok(!projectionIsConservative(lossy), "a missing result must not pass");
});
