/**
 * Wellbeing Pulse — default operational taxonomy.
 *
 * This is a CATALOGUE, not a hard-coded form. The runtime source for
 * Department / Function and Office Location is the governed lookup in
 * Postgres (`wellbeing_departments`, `wellbeing_office_locations`), which a
 * wellbeing-governance role owns per organisation. What lives here is the
 * default list that governance can install into a new organisation, and the
 * one enumeration that genuinely is fixed by the form specification.
 *
 * No component imports the department list directly. A form renders whatever
 * the organisation's lookup holds, so a customer can add whatever its own
 * structure needs without a deployment — which is the whole reason the lookup
 * exists.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THESE DEFAULTS ARE DELIBERATELY GENERIC.
 *
 * DISC360 is multi-organisation. An organisation's department structure is its
 * own information, and a list shipped in this repository is offered to EVERY
 * organisation — as the platform-level catalogue and behind the "Install
 * defaults" button alike. So nothing customer-specific may live here: no
 * customer's business units, operating units, asset names or site structure.
 *
 * What is here instead is a neutral floor — the widely-recognised business
 * functions almost any employer has — so that an organisation which has not
 * configured its catalogue yet still presents a usable form. It is a starting
 * point to be replaced, not a description of anyone.
 *
 * An organisation's real structure is created against ITS OWN organization_id,
 * where RLS scopes it to that organisation and no other tenant can read it.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Department / Function.
 *
 * Deliberately NOT the same field as the existing `teams.department` column,
 * which this product calls "Sub Team" in every surface it appears. They ask
 * different questions of different populations, so they are stored, labelled
 * and reported separately. Wellbeing Pulse never renames this to Sub Team.
 */
export const WELLBEING_DEPARTMENT_LABEL = "Department / Function";

/**
 * Sub-unit / Team — the organisational unit, never the assessment team.
 *
 * Named "Sub-unit / Team" rather than "Team" on purpose. This platform already
 * uses "team" for the thing a facilitator runs a session with, and a
 * participant asked for their "team" inside a campaign reasonably answers with
 * the campaign. The compound label is slightly clumsy and entirely unambiguous.
 *
 * There is deliberately NO default catalogue here, unlike departments and
 * office locations. A department name is generic enough to ship; a sub-unit
 * name is always somebody's own org chart, and a shipped list of them would
 * describe a real customer.
 */
export const WELLBEING_SUB_UNIT_LABEL = "Sub-unit / Team";

export const WELLBEING_SUB_UNIT_HELP =
  "The working unit you belong to. Used only to group answers — your own result is never shown against it.";

export const DEFAULT_WELLBEING_DEPARTMENTS: readonly string[] = [
  "Commercial",
  "Customer Operations",
  "Engineering",
  "Finance",
  "Health, Safety and Environment",
  "Human Resources",
  "Information Technology",
  "Legal",
  "Operations",
  "Procurement",
  "Sales and Marketing",
  // Last by position, and an honest answer rather than a forced mis-selection
  // while an organisation is still building its own catalogue.
  "Other",
];

/**
 * Office Location defaults.
 *
 * An office list is geography, and geography is the most organisation-specific
 * part of a taxonomy — there is no neutral set of cities. These are facility
 * ROLES rather than places, which unblocks the form for an office-based
 * respondent without asserting where anybody works.
 */
export const DEFAULT_WELLBEING_OFFICE_LOCATIONS: readonly string[] = [
  "Head Office",
  "Regional Office",
  "Other",
];

/**
 * Work Location is a fixed two-value enumeration in the database, so it is the
 * one part of the taxonomy that is not a lookup: adding a third value would be
 * a schema change and a reporting change, not a configuration change.
 */
export type WorkLocation = "field_based" | "office_based";

export const WORK_LOCATIONS: readonly { value: WorkLocation; label: string }[] = [
  { value: "field_based", label: "Field Based" },
  { value: "office_based", label: "Office Based" },
];

export const WORK_LOCATION_LABEL: Record<WorkLocation, string> = {
  field_based: "Field Based",
  office_based: "Office Based",
};

/** Office Location is asked only of office-based respondents. */
export function requiresOfficeLocation(work: WorkLocation | null): boolean {
  return work === "office_based";
}
