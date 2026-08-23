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
 * the organisation's lookup holds, so a customer can add "Deepwater" without a
 * deployment — which is the whole reason the lookup exists.
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

export const DEFAULT_WELLBEING_DEPARTMENTS: readonly string[] = [
  "Business and Government Relations",
  "Commercial",
  "Contract and Procurement",
  "Country Chair Organization",
  "Development",
  "Engineering and Major Project",
  "Exploration",
  "External Relations",
  "Finance",
  "Geo Solutions",
  "Human Resources",
  "Information Technology",
  "Integrated Gas",
  "Legal",
  "Logistics",
  "Nigeria Real Estate",
  "Ogoni Restoration Team",
  "Pipelines",
  "Production",
  "PT Development Nigeria",
  "Renaissance Health",
  "Safety Environment",
  "Security",
  "Shell Nigeria Gas",
  "Transformation Team",
  "Wells",
];

export const DEFAULT_WELLBEING_OFFICE_LOCATIONS: readonly string[] = [
  "Abuja",
  "Lagos",
  "Port Harcourt",
  "Warri",
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
