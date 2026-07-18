/**
 * Typed content model for facilitator presentation decks.
 *
 * Slides are data, never JSX. A deck is an ordered array of `PresentationSlide`
 * authored in data/presentations/*, so content can be edited — or later moved
 * to the database — without touching the player or the visual components. Each
 * slide names a `visualType`; the player maps that to a renderer, and the
 * optional structured fields below carry whatever that renderer needs.
 *
 * Audience-facing text is kept short by contract (see the deck tests): one
 * strong message per screen, never a wall of bullets.
 */

export type PresentationDeckType = "disc" | "focus" | "combined";

/** How a slide is rendered. The player switches on this. */
export type SlideVisualType =
  | "hero" // opening: oversized headline over an ambient field
  | "spectrum" // the four-point behavioural field / calm word reveal
  | "fourDimensions" // D/I/S/A as four regions
  | "timeline" // an ordered sequence (autopilot loop, interruption cost)
  | "comparison" // two or more columns side by side (two lenses, strength→shadow)
  | "chart" // an elegant data visual (energy rhythm curve)
  | "quote" // a single high-contrast statement
  | "instructions" // how-to-answer (the one screen allowed more text)
  | "closing"; // final screen with the start CTA

/** One of the four dimensions, in display letters (Analytical = "A"). */
export type DisplayDimension = "D" | "I" | "S" | "A";

export interface DimensionPoint {
  code: DisplayDimension;
  label: string;
  /** One-line contribution or descriptor, e.g. "brings momentum". */
  note?: string;
}

/** A strength that, overused, becomes a pressure point. Phrased as possibility. */
export interface StrengthShadow {
  strength: string;
  shadow: string;
}

export interface ComparisonColumn {
  heading: string;
  points: string[];
  /** Optional accent, e.g. a DISC dimension colour, chosen by the renderer. */
  accent?: DisplayDimension | "botanical" | "teal";
}

export interface TimelineStep {
  label: string;
  /** Optional sub-label shown under the step. */
  note?: string;
}

export interface PresentationSlide {
  id: string;
  deckType: PresentationDeckType;
  order: number;
  section: string;
  eyebrow?: string;
  title: string;
  /** Short supporting line. Kept under ~40 words except on `instructions`. */
  body?: string;
  visualType: SlideVisualType;

  /* ── optional structured payloads, consumed by specific visuals ── */

  /** Calm word reveal (spectrum): "Pace", "Priorities", … */
  words?: string[];
  /** Four regions (fourDimensions) or a blended profile. */
  dimensions?: DimensionPoint[];
  /** strength→shadow pairs (comparison). */
  strengthShadows?: StrengthShadow[];
  /** Side-by-side columns (comparison / two-lens). */
  columns?: ComparisonColumn[];
  /** Ordered steps (timeline). */
  steps?: TimelineStep[];
  /** A flat list rendered as calm rows (supports, results, roadmap). */
  points?: string[];
  /** How-to-answer lines (instructions). */
  instructions?: string[];

  /* ── facilitator notes (facilitator device only) ── */

  facilitatorPrompt?: string;
  audienceQuestion?: string;
  /** Estimated speaking time for this screen, in seconds. */
  estimatedSeconds?: number;
}

export interface PresentationDeck {
  type: PresentationDeckType;
  title: string;
  slides: PresentationSlide[];
}

/**
 * Total estimated run time of a deck, in seconds — summed from per-slide
 * estimates (0 when a slide has none). Used by the presenter timer.
 */
export function deckDurationSeconds(deck: PresentationDeck): number {
  return deck.slides.reduce((total, slide) => total + (slide.estimatedSeconds ?? 0), 0);
}
