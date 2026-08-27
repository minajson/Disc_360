/**
 * Normalisation for participant-entered organisational context.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS.
 *
 * Sub-unit / Team is typed by the participant rather than chosen from a
 * catalogue, because a working unit's name changes far more often than a
 * governed lookup can be maintained — and a participant who cannot find their
 * unit in a dropdown either abandons the pulse or picks something untrue.
 *
 * Free text buys that flexibility with a cost: the same unit arrives spelled
 * several ways. " Environmental  Health ", "environmental health" and
 * "Environmental Health" are one group of three people, not three groups of
 * one. Left alone they fragment into singletons, and a singleton cohort is
 * precisely what the confidentiality rules exist to prevent — so normalisation
 * here is a privacy control, not a tidiness preference.
 *
 * Two functions, deliberately separate:
 *
 *   · `normalizeOrgFreeText` produces what is STORED and DISPLAYED. It keeps
 *     the participant's own capitalisation, because a result reads back the
 *     words the person wrote.
 *   · `orgFreeTextCohortKey` produces what is GROUPED ON. It case-folds, so
 *     the three spellings above land in one cohort and are counted once
 *     against the suppression floor.
 *
 * Pure and dependency-free, so both are unit-tested directly.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Matches the `max(120)` the context schema and the database columns allow. */
export const ORG_FREE_TEXT_MAX = 120;

/**
 * Characters that are invisible but not whitespace to `trim()`.
 *
 * A pasted value from a spreadsheet or a messaging app routinely carries a
 * zero-width space or a BOM. Without this they survive normalisation, compare
 * unequal to the identical-looking value typed by hand, and split one cohort
 * into two — the exact failure this module exists to prevent.
 */
const INVISIBLE = /[\x00-\x1f\x7f\xad​-‍⁠﻿]/g;

/**
 * The stored, displayed form of a participant-typed organisational value.
 *
 * Returns `null` for anything that carries no information — empty, whitespace
 * only, or invisible characters only. Null rather than an empty string because
 * the column is nullable and "not answered" is a real, reportable state; an
 * empty string would be a third value meaning the same thing, and would group
 * as its own cohort.
 *
 * Capitalisation is left exactly as typed. Title-casing "R&D" into "R&d" would
 * be a correction nobody asked for, applied to somebody's own words.
 */
export function normalizeOrgFreeText(input: string | null | undefined): string | null {
  if (input == null) return null;
  const collapsed = input.replace(INVISIBLE, " ").replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return null;
  return collapsed.slice(0, ORG_FREE_TEXT_MAX);
}

/**
 * The grouping key for a participant-typed value.
 *
 * Case-folded so that spelling variants of one unit count as one cohort.
 * `toLowerCase` rather than `toLocaleLowerCase`: the key must be stable across
 * whatever locale the server happens to run in, since a cohort computed in one
 * request is compared against a cohort computed in another.
 *
 * Never displayed. Labels come from `normalizeOrgFreeText`, so the reader sees
 * the participant's own capitalisation while the counter sees one group.
 */
export function orgFreeTextCohortKey(input: string | null | undefined): string | null {
  const normalized = normalizeOrgFreeText(input);
  return normalized === null ? null : normalized.toLowerCase();
}
