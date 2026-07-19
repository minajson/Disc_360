import assert from "node:assert/strict";
import { test } from "node:test";
import { discIntroductionDeck } from "../../data/presentations/disc-introduction.ts";
import { focusIntroductionDeck } from "../../data/presentations/focus-introduction.ts";
import { combinedIntroductionDeck } from "../../data/presentations/combined-introduction.ts";
import { deckDurationSeconds, type PresentationDeck } from "./types.ts";

/**
 * Content contract for the introduction decks. These enforce the rules a
 * reviewer would otherwise re-check by eye every time copy changes: slide
 * counts, ordering, short audience text, non-clinical framing, and the DISC
 * display letter (Analytical = "A", never "C").
 */

const DECKS: { deck: PresentationDeck; expected: number }[] = [
  { deck: discIntroductionDeck, expected: 10 },
  { deck: focusIntroductionDeck, expected: 10 },
  { deck: combinedIntroductionDeck, expected: 12 },
];

const VALID_VISUALS = new Set([
  "hero",
  "spectrum",
  "fourDimensions",
  "timeline",
  "comparison",
  "chart",
  "quote",
  "instructions",
  "closing",
  "compass",
  "ripple",
  "cycle",
  "recoveryCurve",
]);

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

test("each deck has the specified number of slides", () => {
  for (const { deck, expected } of DECKS) {
    assert.equal(deck.slides.length, expected, `${deck.type} deck has ${expected} slides`);
  }
});

test("slides are ordered 1..n with no gaps and match their deck type", () => {
  for (const { deck } of DECKS) {
    deck.slides.forEach((slide, index) => {
      assert.equal(slide.order, index + 1, `${slide.id} order`);
      assert.equal(slide.deckType, deck.type, `${slide.id} deckType`);
    });
  }
});

test("every slide id is unique across all decks", () => {
  const ids = DECKS.flatMap(({ deck }) => deck.slides.map((s) => s.id));
  assert.equal(new Set(ids).size, ids.length, "no duplicate slide ids");
});

test("every slide has a valid visualType and a non-empty title", () => {
  for (const { deck } of DECKS) {
    for (const slide of deck.slides) {
      assert.ok(VALID_VISUALS.has(slide.visualType), `${slide.id} visualType ${slide.visualType}`);
      assert.ok(slide.title.trim().length > 0, `${slide.id} has a title`);
    }
  }
});

test("every deck opens on a hero and closes on a closing slide", () => {
  for (const { deck } of DECKS) {
    assert.equal(deck.slides[0]?.visualType, "hero", `${deck.type} opens on hero`);
    assert.equal(
      deck.slides[deck.slides.length - 1]?.visualType,
      "closing",
      `${deck.type} closes on closing`,
    );
  }
});

test("audience text stays short — title + body under ~40 words (instructions exempt)", () => {
  for (const { deck } of DECKS) {
    for (const slide of deck.slides) {
      if (slide.visualType === "instructions") continue;
      const words = wordCount(slide.title) + (slide.body ? wordCount(slide.body) : 0);
      assert.ok(words <= 45, `${slide.id} main text is ${words} words (limit ~40)`);
    }
  }
});

test("dimension labels use the display letter A, never the internal C", () => {
  for (const { deck } of DECKS) {
    for (const slide of deck.slides) {
      for (const dim of slide.dimensions ?? []) {
        assert.ok(["D", "I", "S", "A"].includes(dim.code), `${slide.id} uses A not C: ${dim.code}`);
      }
    }
  }
});

test("the focus and combined decks avoid clinical / addiction framing", () => {
  // Non-diagnostic by contract: dopamine is never presented as measured, and
  // no medical/addiction language appears in audience-facing copy.
  const clinical = /\b(addiction|addicted|disorder|clinical|diagnos|withdrawal|dopamine hit)\b/i;
  const measuredDopamine = /measur\w*\s+(your\s+)?dopamine|dopamine\s+(is|level|score)/i;
  for (const deck of [focusIntroductionDeck, combinedIntroductionDeck]) {
    for (const slide of deck.slides) {
      const text = [slide.title, slide.body, ...(slide.points ?? []), ...(slide.instructions ?? [])]
        .filter(Boolean)
        .join(" ");
      assert.doesNotMatch(text, clinical, `${slide.id} avoids clinical language`);
      assert.doesNotMatch(text, measuredDopamine, `${slide.id} does not claim to measure dopamine`);
    }
  }
});

test("strength→shadow copy is phrased as possibility, never as a verdict", () => {
  // "may become" / "can become" — never "will" or "is".
  for (const { deck } of DECKS) {
    for (const slide of deck.slides) {
      for (const pair of slide.strengthShadows ?? []) {
        assert.match(
          pair.shadow,
          /\b(may|can)\b/i,
          `${slide.id}: "${pair.shadow}" should be tentative`,
        );
      }
    }
  }
});

test("the four-dimensions slides cover all four dimensions exactly once", () => {
  for (const { deck } of DECKS) {
    for (const slide of deck.slides) {
      if (slide.visualType !== "fourDimensions") continue;
      const codes = (slide.dimensions ?? []).map((d) => d.code).sort();
      assert.deepEqual(codes, ["A", "D", "I", "S"], `${slide.id} covers D/I/S/A`);
    }
  }
});

test("instructions and comparison slides carry the structured data they render", () => {
  for (const { deck } of DECKS) {
    for (const slide of deck.slides) {
      if (slide.visualType === "instructions") {
        assert.ok((slide.instructions?.length ?? 0) >= 1, `${slide.id} has instructions`);
      }
      if (["timeline", "cycle", "recoveryCurve"].includes(slide.visualType)) {
        assert.ok((slide.steps?.length ?? 0) >= 2, `${slide.id} has ordered steps`);
      }
      if (slide.visualType === "ripple") {
        assert.ok((slide.words?.length ?? 0) >= 3, `${slide.id} has interruption markers`);
      }
      if (slide.visualType === "comparison") {
        const hasData =
          (slide.columns?.length ?? 0) > 0 ||
          (slide.strengthShadows?.length ?? 0) > 0 ||
          (slide.points?.length ?? 0) > 0;
        assert.ok(hasData, `${slide.id} comparison has data`);
      }
    }
  }
});

test("facilitator notes are well-formed where present", () => {
  for (const { deck } of DECKS) {
    for (const slide of deck.slides) {
      if (slide.estimatedSeconds !== undefined) {
        assert.ok(slide.estimatedSeconds > 0, `${slide.id} estimatedSeconds positive`);
      }
      if (slide.facilitatorPrompt !== undefined) {
        assert.ok(slide.facilitatorPrompt.trim().length > 0, `${slide.id} prompt non-empty`);
      }
    }
  }
});

test("every slide has a facilitator prompt and an estimated time", () => {
  // The presenter console relies on both; a missing one leaves a blank panel.
  for (const { deck } of DECKS) {
    for (const slide of deck.slides) {
      assert.ok(slide.facilitatorPrompt, `${slide.id} has a facilitator prompt`);
      assert.ok(slide.estimatedSeconds, `${slide.id} has an estimated time`);
    }
  }
});

test("deck duration is the sum of slide estimates", () => {
  const total = deckDurationSeconds(discIntroductionDeck);
  const manual = discIntroductionDeck.slides.reduce((s, x) => s + (x.estimatedSeconds ?? 0), 0);
  assert.equal(total, manual);
  assert.ok(total > 0);
});

test("the combined deck tells one integrated story, not two decks concatenated", () => {
  // It must weave both lenses: at least one slide references behaviour AND at
  // least one references attention/focus, and it is not simply disc+focus ids.
  const text = combinedIntroductionDeck.slides.map((s) => `${s.title} ${s.body ?? ""}`).join(" ");
  assert.match(text, /behaviour|behavioural/i);
  assert.match(text, /attention|focus/i);
  // The integration slide explicitly connects the two.
  assert.ok(
    combinedIntroductionDeck.slides.some((s) => /same interruption|connect/i.test(s.title)),
    "combined deck has an integration slide",
  );
});
