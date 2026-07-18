import type { PresentationDeck, PresentationDeckType } from "./types";
// Relative .ts imports (like lib/scoring/*) so the Node test runner can load
// this module without the "@/*" path alias. Next resolves them the same way.
import { discIntroductionDeck } from "../../data/presentations/disc-introduction.ts";
import { focusIntroductionDeck } from "../../data/presentations/focus-introduction.ts";
import { combinedIntroductionDeck } from "../../data/presentations/combined-introduction.ts";

/**
 * The registry ties the three assessment products to their introduction decks
 * and to the start screen's choices. Everything the routes and start screens
 * need to know about a product lives here, so adding a product is a data edit.
 */

export type ProductId = "disc" | "focus" | "combined";

const DECKS: Record<PresentationDeckType, PresentationDeck> = {
  disc: discIntroductionDeck,
  focus: focusIntroductionDeck,
  combined: combinedIntroductionDeck,
};

export function getDeck(type: PresentationDeckType): PresentationDeck {
  return DECKS[type];
}

/**
 * A choice offered on a product's start screen. `deckType: null` means "go
 * straight to the assessment", skipping the presentation entirely.
 */
export interface StartChoice {
  id: string;
  label: string;
  description: string;
  deckType: PresentationDeckType | null;
}

export interface AssessmentProduct {
  id: ProductId;
  name: string;
  tagline: string;
  /** The introduction deck shown by "Start with presentation". */
  primaryDeck: PresentationDeckType;
  /** Start-screen choices, in display order. */
  startChoices: StartChoice[];
  /**
   * Whether a scored assessment exists for this product today. DISC is live;
   * the Focus Pulse instrument is not yet built, and Combined begins with the
   * DISC scenarios. The start screens read this to avoid promising scoring that
   * does not exist — see PRESENTATIONS.md.
   */
  assessmentLive: boolean;
}

const STRAIGHT_TO_ASSESSMENT: StartChoice = {
  id: "assessment",
  label: "Go straight to assessment",
  description: "Skip the introduction and begin answering now.",
  deckType: null,
};

export const PRODUCTS: Record<ProductId, AssessmentProduct> = {
  disc: {
    id: "disc",
    name: "DISC Behaviour Assessment",
    tagline: "How people lead, communicate and respond when it matters.",
    primaryDeck: "disc",
    startChoices: [
      {
        id: "presentation",
        label: "Start with presentation",
        description: "A short facilitator introduction to DISC, then the assessment.",
        deckType: "disc",
      },
      STRAIGHT_TO_ASSESSMENT,
    ],
    assessmentLive: true,
  },
  focus: {
    id: "focus",
    name: "Focus & Digital Dopamine Pulse",
    tagline: "What competes for your attention, and how you recover it.",
    primaryDeck: "focus",
    startChoices: [
      {
        id: "presentation",
        label: "Start with presentation",
        description: "A short facilitator introduction to attention and focus, then the pulse.",
        deckType: "focus",
      },
      STRAIGHT_TO_ASSESSMENT,
    ],
    assessmentLive: false,
  },
  combined: {
    id: "combined",
    name: "Combined DISC + Focus Assessment",
    tagline: "How behaviour and attention connect.",
    primaryDeck: "combined",
    // The combined product offers the integrated intro plus each single lens.
    startChoices: [
      {
        id: "combined",
        label: "Combined introduction",
        description: "One integrated story connecting behaviour and attention.",
        deckType: "combined",
      },
      {
        id: "disc",
        label: "DISC introduction only",
        description: "Just the behavioural lens.",
        deckType: "disc",
      },
      {
        id: "focus",
        label: "Focus introduction only",
        description: "Just the attention lens.",
        deckType: "focus",
      },
      STRAIGHT_TO_ASSESSMENT,
    ],
    assessmentLive: true,
  },
};

export function getProduct(id: ProductId): AssessmentProduct {
  return PRODUCTS[id];
}

export const PRODUCT_IDS: ProductId[] = ["disc", "focus", "combined"];

/** Type guard for a route param. */
export function isProductId(value: string): value is ProductId {
  return value === "disc" || value === "focus" || value === "combined";
}

export function isDeckType(value: string): value is PresentationDeckType {
  return value === "disc" || value === "focus" || value === "combined";
}
