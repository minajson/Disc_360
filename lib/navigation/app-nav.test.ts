import assert from "node:assert/strict";
import { test } from "node:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  accountMenuFor,
  isActive,
  navFor,
  PLATFORM_ADMIN_LINK,
  RETURN_TO_APP,
  resolveExperience,
  SUPER_ADMIN_NAV,
  type AppExperience,
  type NavItem,
} from "./app-nav.ts";

const APP_DIR = join(import.meta.dirname, "..", "..", "app");

/**
 * Every route the app can actually serve, derived from the filesystem.
 * Next.js route groups — the parenthesised directories — are transparent in
 * the URL, so they are stripped. Dynamic segments are kept as-is; no nav item
 * should point at one.
 */
const collectRoutes = (dir: string, segments: string[] = []): string[] => {
  const routes: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
      routes.push(
        ...collectRoutes(
          join(dir, entry.name),
          isGroup ? segments : [...segments, entry.name],
        ),
      );
    } else if (entry.name === "page.tsx") {
      routes.push(`/${segments.join("/")}`);
    }
  }
  return routes;
};

const ROUTES = new Set(collectRoutes(APP_DIR));

const EXPERIENCES: AppExperience[] = ["individual", "facilitator", "coach"];

const allNavItems = (): NavItem[] => [
  ...EXPERIENCES.flatMap(navFor),
  ...SUPER_ADMIN_NAV,
  RETURN_TO_APP,
  PLATFORM_ADMIN_LINK,
  ...EXPERIENCES.flatMap((experience) => accountMenuFor(experience, true)),
];

/* ── The nav must never point at a route that does not exist ── */

test("the route scanner finds the routes we know exist", () => {
  // Guards the test itself: a broken scanner would make every check vacuous.
  assert.ok(ROUTES.size > 20, `found ${ROUTES.size} routes`);
  assert.ok(ROUTES.has("/app"), "scanner resolves route groups");
  assert.ok(ROUTES.has("/admin"), "scanner resolves the admin area");
  assert.ok(ROUTES.has("/pricing"), "scanner resolves marketing routes");
});

test("every navigation destination exists as a real page", () => {
  for (const item of allNavItems()) {
    assert.ok(
      ROUTES.has(item.href),
      `nav item "${item.label}" points at ${item.href}, which has no page.tsx`,
    );
  }
});

test("no navigation item points at a dynamic segment", () => {
  for (const item of allNavItems()) {
    assert.doesNotMatch(
      item.href,
      /\[|\]/,
      `nav item "${item.label}" must not require a url parameter`,
    );
  }
});

/* ── The four experiences ───────────────────────────────────── */

test("individual navigation matches the specified set", () => {
  assert.deepEqual(
    navFor("individual").map((item) => item.label),
    ["Home", "Take Assessment", "My Results", "Team Invitations", "Account"],
  );
});

test("facilitator navigation matches the specified set", () => {
  assert.deepEqual(
    navFor("facilitator").map((item) => item.label),
    ["Dashboard", "My Teams", "Participants", "Present", "Reports", "Account"],
  );
});

test("coach navigation matches the specified set", () => {
  assert.deepEqual(
    navFor("coach").map((item) => item.label),
    [
      "Workspace",
      "Clients",
      "Teams",
      "Assessments",
      "Presentations",
      "Reports",
      "Coach Profile",
      "Account",
    ],
  );
});

test("super admin navigation matches the specified set", () => {
  assert.deepEqual(
    SUPER_ADMIN_NAV.map((item) => item.label),
    [
      "Overview",
      "Users",
      "Teams",
      "Submissions",
      "Payments",
      "Emails",
      "Reports",
      "Roles",
      "Settings",
    ],
  );
  assert.equal(RETURN_TO_APP.label, "Return to DISC360");
  assert.equal(RETURN_TO_APP.href, "/app");
});

/* ── Separation of concerns between experiences ─────────────── */

test("an individual sees no team administration", () => {
  const hrefs = navFor("individual").map((item) => item.href);
  for (const forbidden of ["/app/teams", "/app/participants", "/app/present"]) {
    assert.ok(
      !hrefs.includes(forbidden),
      `individuals must not see ${forbidden}`,
    );
  }
});

test("coach navigation is not mixed with platform administration", () => {
  for (const item of navFor("coach")) {
    assert.ok(
      !item.href.startsWith("/admin"),
      `coach nav must not contain ${item.href}`,
    );
  }
});

test("no experience nav contains the admin area", () => {
  for (const experience of EXPERIENCES) {
    for (const item of navFor(experience)) {
      assert.ok(!item.href.startsWith("/admin"));
    }
  }
});

test("every experience can reach its account page", () => {
  for (const experience of EXPERIENCES) {
    const hrefs = navFor(experience).map((item) => item.href);
    assert.ok(hrefs.includes("/app/settings"), `${experience} has Account`);
  }
});

/* ── Experience resolution ──────────────────────────────────── */

test("a plain signup is an individual", () => {
  assert.equal(
    resolveExperience({
      isCoach: false,
      isTeamAdmin: false,
      hasTeamEntitlement: false,
    }),
    "individual",
  );
});

test("a team entitlement alone promotes to facilitator", () => {
  // Otherwise paying for the Team plan leads nowhere.
  assert.equal(
    resolveExperience({
      isCoach: false,
      isTeamAdmin: false,
      hasTeamEntitlement: true,
    }),
    "facilitator",
  );
});

test("administering a team promotes to facilitator", () => {
  assert.equal(
    resolveExperience({
      isCoach: false,
      isTeamAdmin: true,
      hasTeamEntitlement: false,
    }),
    "facilitator",
  );
});

test("coach outranks facilitator", () => {
  assert.equal(
    resolveExperience({
      isCoach: true,
      isTeamAdmin: true,
      hasTeamEntitlement: true,
    }),
    "coach",
  );
});

/* ── Account menu and Platform Admin visibility ─────────────── */

test("super admins get the Platform Admin link in the account menu", () => {
  for (const experience of EXPERIENCES) {
    const labels = accountMenuFor(experience, true).map((item) => item.label);
    assert.ok(
      labels.includes("Platform Admin"),
      `${experience} super admin sees Platform Admin`,
    );
  }
});

test("normal users never see the Platform Admin link", () => {
  for (const experience of EXPERIENCES) {
    const items = accountMenuFor(experience, false);
    for (const item of items) {
      assert.ok(!item.href.startsWith("/admin"), `${experience} is clean`);
      assert.notEqual(item.label, "Platform Admin");
    }
  }
});

/* ── Active-state matching ──────────────────────────────────── */

test("exact items do not match their descendants", () => {
  // /app must not light up while the user is on /app/teams.
  const home: NavItem = { href: "/app", label: "Home", exact: true };
  assert.ok(isActive(home, "/app"));
  assert.ok(!isActive(home, "/app/teams"));
});

test("prefix items match nested pages", () => {
  const teams: NavItem = { href: "/app/teams", label: "My Teams" };
  assert.ok(isActive(teams, "/app/teams"));
  assert.ok(isActive(teams, "/app/teams/abc/dashboard"));
  assert.ok(!isActive(teams, "/app/reports"));
});

test("the roots of every experience are marked exact", () => {
  // Without this, the first nav item stays highlighted on every page.
  for (const experience of EXPERIENCES) {
    const first = navFor(experience)[0];
    assert.ok(first?.exact, `${experience} root is exact`);
  }
  assert.ok(SUPER_ADMIN_NAV[0]?.exact, "admin overview is exact");
});
