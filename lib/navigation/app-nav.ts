/**
 * Role-aware application navigation.
 *
 * Navigation is organised by user intention, not by product area. An
 * individual, a facilitator and a coach each get a nav that names the thing
 * they came to do, and nothing else — a person who cannot administer a team
 * never sees team administration.
 *
 * Every set is derived here so desktop, mobile and the account menu render
 * the same arrays and cannot drift apart. Pure functions, no I/O: the
 * membership lookups happen in the layout and arrive as `ExperienceSignals`.
 */

export type AppExperience = "individual" | "facilitator" | "coach";

export interface NavItem {
  href: string;
  label: string;
  /** Match the path exactly instead of by prefix — needed for roots like /app. */
  exact?: boolean;
}

/** A. Individual — self-awareness, no team administration. */
const INDIVIDUAL_NAV: readonly NavItem[] = [
  { href: "/app", label: "Home", exact: true },
  { href: "/app/assessments", label: "Take Assessment" },
  { href: "/app/history", label: "My Results" },
  { href: "/app/invitations", label: "Team Invitations" },
  { href: "/app/settings", label: "Account" },
];

/** B. Team facilitator / team admin — runs sessions for other people. */
const FACILITATOR_NAV: readonly NavItem[] = [
  { href: "/app", label: "Dashboard", exact: true },
  { href: "/app/teams", label: "My Teams" },
  { href: "/app/participants", label: "Participants" },
  { href: "/app/present", label: "Present" },
  { href: "/app/reports", label: "Reports" },
  { href: "/app/settings", label: "Account" },
];

/** C. Coach — client engagements. Never mixed with platform administration. */
const COACH_NAV: readonly NavItem[] = [
  { href: "/app/coach", label: "Workspace", exact: true },
  { href: "/app/coach/clients", label: "Clients" },
  { href: "/app/teams", label: "Teams" },
  { href: "/app/assessments", label: "Assessments" },
  { href: "/app/present", label: "Presentations" },
  { href: "/app/reports", label: "Reports" },
  { href: "/app/coach/profile", label: "Coach Profile" },
  { href: "/app/settings", label: "Account" },
];

/** D. Platform super admin — the /admin area has its own shell. */
export const SUPER_ADMIN_NAV: readonly NavItem[] = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/submissions", label: "Submissions" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/emails", label: "Emails" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/roles", label: "Roles" },
  { href: "/admin/settings", label: "Settings" },
];

/** The way back out of the admin area, kept separate so it can be styled apart. */
export const RETURN_TO_APP: NavItem = { href: "/app", label: "Return to DISC360" };

export const PLATFORM_ADMIN_LINK: NavItem = {
  href: "/admin",
  label: "Platform Admin",
};

const NAV_BY_EXPERIENCE: Record<AppExperience, readonly NavItem[]> = {
  individual: INDIVIDUAL_NAV,
  facilitator: FACILITATOR_NAV,
  coach: COACH_NAV,
};

export function navFor(experience: AppExperience): NavItem[] {
  return [...NAV_BY_EXPERIENCE[experience]];
}

export interface ExperienceSignals {
  /** Has a coach profile, or signed up intending to manage clients. */
  isCoach: boolean;
  /** Holds team_admin on at least one live team. */
  isTeamAdmin: boolean;
  /** Has paid for (or been granted) the Team plan. */
  hasTeamEntitlement: boolean;
}

/**
 * Coach outranks facilitator outranks individual. A coach who also runs their
 * own teams is still a coach — their nav already reaches Teams and Present,
 * so demoting them to the facilitator set would only remove Clients and
 * Coach Profile.
 *
 * Entitlement alone promotes to facilitator: someone who has just paid for
 * the Team plan but not yet created a team must be able to reach the team
 * area, or the purchase leads nowhere.
 */
export function resolveExperience(signals: ExperienceSignals): AppExperience {
  if (signals.isCoach) return "coach";
  if (signals.isTeamAdmin || signals.hasTeamEntitlement) return "facilitator";
  return "individual";
}

/**
 * Account menu contents. Platform Admin is surfaced here *as well as* in the
 * main nav so a super admin can always find it, and it is the only place the
 * link appears for experiences whose main nav is already long.
 */
export function accountMenuFor(
  experience: AppExperience,
  isSuperAdmin: boolean,
): NavItem[] {
  const items: NavItem[] = [
    { href: "/app/settings", label: "Account settings" },
  ];
  if (experience === "coach") {
    items.push({ href: "/app/coach/profile", label: "Coach profile" });
  }
  if (isSuperAdmin) items.push(PLATFORM_ADMIN_LINK);
  return items;
}

/** True when `pathname` should mark `item` as the current page. */
export function isActive(item: NavItem, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}
