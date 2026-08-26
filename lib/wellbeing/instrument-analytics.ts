import type { InstrumentKey, InstrumentMetadata } from "../../data/wellbeing-instruments.ts";
import { INSTRUMENTS } from "../../data/wellbeing-instruments.ts";
import { WELLBEING_ITEM_STRUCTURE } from "../../data/wellbeing-items.ts";

/**
 * Instrument adapters for MANAGEMENT ANALYTICS.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE REFUSES TO DO.
 *
 * The tempting way to build a four-instrument analytics workspace is to define
 * one set of charts and make every instrument fill them in. That produces a
 * consistent-looking product and a dishonest one: WHO-5 grows a subscale
 * profile it does not have, GHQ-12 grows domains it does not have, and the
 * four end up looking like variants of one measure rather than four different
 * measures of four different things.
 *
 * So the direction is reversed. Each instrument declares what its own
 * structure legitimately supports, and the analytics surfaces render what they
 * are given. Where an instrument supports nothing for a section, the section
 * does not appear — no placeholder, no "not available", and above all no
 * invented construct in its place.
 *
 * THE FOUR, AND WHY THEY DIFFER.
 *
 *  · GHQ-12 — one score, no subscales. Distribution, median, the configured
 *    threshold and the proportion at or above it. Per-item response patterns
 *    are twelve independent proportions and are never combined into anything.
 *  · GHQ-28 — one score plus four PUBLISHED subscales. The subscales are
 *    profile dimensions, carry no threshold of their own, and are reported
 *    only as suppressed aggregates.
 *  · WHO-5 — five items, one transformed 0–100 score, and no cut-off
 *    configured in this deployment. It gets a distribution and a level, and no
 *    threshold language anywhere, because inventing one would be a product
 *    rule masquerading as methodology.
 *  · DISC360 Wellbeing — six dimensions of equal standing on one shared 0–100
 *    scale, which is the one structure a radar reads well.
 * ─────────────────────────────────────────────────────────────────────
 */

/** How a set of sub-scores should be drawn, or that there are none. */
export type DimensionForm = "radar" | "bars" | null;

export interface InstrumentAnalyticsPlan {
  key: InstrumentKey;
  instrument: InstrumentMetadata;

  /** Every instrument has a primary score, so every instrument has these. */
  distribution: true;
  /** Median and mean of the primary score. */
  centralTendency: true;

  /** Threshold rate — only where the instrument carries a governed threshold. */
  thresholdRate: boolean;

  /** Sub-scores, and the form their structure supports. */
  dimensionForm: DimensionForm;
  /** The heading those sub-scores are given. Null where there are none. */
  dimensionHeading: string | null;
  /** The ceiling each sub-score is drawn against. */
  dimensionMax: number;

  /** Per-item aggregate response patterns. */
  itemPatterns: boolean;

  /** Whether "aggregate wellbeing level" is a legitimate reading. */
  wellbeingLevel: boolean;

  /** Anything the surface must say alongside this instrument's figures. */
  notes: readonly string[];
}

const THRESHOLD_NOTE =
  "The threshold is a configured screening cut-off, not a clinical boundary. A score at or above it indicates that a fuller conversation may be warranted — never a diagnosis of a person or of a group.";

const NO_THRESHOLD_NOTE =
  "No cut-off is configured for this instrument in this deployment, so no part of its range means more than the number it shows. Threshold language would be a product rule, not methodology.";

const SUBSCALE_NOTE =
  "Subscales are profile dimensions. None carries a threshold of its own and none is separately interpretable as a condition.";

const ITEM_NOTE =
  "Item patterns are independent proportions. They are never summed, weighted or combined into a subscale the instrument does not define.";

export function analyticsPlanFor(key: InstrumentKey): InstrumentAnalyticsPlan {
  const instrument = INSTRUMENTS[key];

  const base = {
    key,
    instrument,
    distribution: true as const,
    centralTendency: true as const,
    thresholdRate: instrument.hasThreshold,
    itemPatterns: true,
  };

  switch (key) {
    case "ghq12":
      return {
        ...base,
        dimensionForm: null,
        dimensionHeading: null,
        dimensionMax: instrument.primaryScoreMax,
        wellbeingLevel: false,
        notes: [THRESHOLD_NOTE, ITEM_NOTE, "GHQ-12 defines no subscales, so none is reported."],
      };

    case "ghq28":
      return {
        ...base,
        // Four subscales, on a distress direction and a 0–7 range. Drawn as
        // bars: on a radar a LARGER shape would read as a better result, which
        // is the opposite of what this scale means.
        dimensionForm: "bars",
        dimensionHeading: "Subscale profile",
        dimensionMax: instrument.subscales[0]?.itemCount ?? instrument.primaryScoreMax,
        wellbeingLevel: false,
        notes: [THRESHOLD_NOTE, SUBSCALE_NOTE, ITEM_NOTE],
      };

    case "who5":
      return {
        ...base,
        dimensionForm: null,
        dimensionHeading: null,
        dimensionMax: instrument.primaryScoreMax,
        // A 0–100 transformed score is a level by construction, and saying so
        // is not the same as asserting a cut-off.
        wellbeingLevel: true,
        notes: [
          NO_THRESHOLD_NOTE,
          ITEM_NOTE,
          "WHO-5 has five items and one transformed score. It defines no subscales, so none is reported.",
        ],
      };

    case "disc360_wellbeing_v1":
      return {
        ...base,
        // Six dimensions, equal standing, one shared 0–100 scale, no rank
        // order — the one structure on this platform a radar reads well.
        dimensionForm: "radar",
        dimensionHeading: "Dimension profile",
        dimensionMax: 100,
        wellbeingLevel: true,
        notes: [
          NO_THRESHOLD_NOTE,
          ITEM_NOTE,
          "The six dimensions describe different aspects of the same reflection. They are not ranked against each other and they do not sum to the index.",
        ],
      };
  }
}

/**
 * The aggregate level a 0–100 wellbeing score sits at.
 *
 * Descriptive language only — where in the range the median falls — and
 * deliberately not evaluative. "Lower" is a position on a scale; "poor",
 * "unhealthy" and "at risk" are judgements this product does not make about
 * a workforce, and would be indefensible about a group in any case.
 *
 * Returns null for instruments that do not report on a 0–100 scale, so a
 * distress count can never be described as a wellbeing level.
 */
export function aggregateWellbeingLevel(
  plan: InstrumentAnalyticsPlan,
  median: number,
): { label: string; detail: string } | null {
  if (!plan.wellbeingLevel || plan.instrument.primaryScoreMax !== 100) return null;

  if (median >= 70) {
    return {
      label: "Upper part of the range",
      detail:
        "Half of the responses received sit at or above this point, in the upper part of the scale.",
    };
  }
  if (median >= 50) {
    return {
      label: "Middle of the range",
      detail: "The median sits around the centre of the scale, with responses spread either side.",
    };
  }
  return {
    label: "Lower part of the range",
    detail:
      "The median sits in the lower part of the scale. That describes what was reported; it does not explain why, and it is not a judgement about this workforce.",
  };
}

/**
 * Item identifiers for one instrument.
 *
 * The length comes from the instrument's own declared item count. Fixing it to
 * GHQ-12's twelve throws the moment a twenty-eight-item instrument is read —
 * the item engine requires every stored row to be the full length of its own
 * questionnaire, and treats a short row as a fault rather than as missing data.
 */
export function itemIdsFor(instrumentKey: InstrumentKey): string[] {
  if (instrumentKey === "ghq12") {
    return WELLBEING_ITEM_STRUCTURE.map((item) => item.externalId);
  }
  return Array.from(
    { length: INSTRUMENTS[instrumentKey].itemCount },
    (_, index) => `${instrumentKey}_item_${String(index + 1).padStart(2, "0")}`,
  );
}
