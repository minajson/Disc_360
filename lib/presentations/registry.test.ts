import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRODUCTS,
  PRODUCT_IDS,
  getDeck,
  getProduct,
  isDeckType,
  isProductId,
} from "./registry.ts";

test("there are exactly three products", () => {
  assert.deepEqual(PRODUCT_IDS, ["disc", "focus", "combined"]);
});

test("every product offers a straight-to-assessment choice (no forced presentation)", () => {
  for (const id of PRODUCT_IDS) {
    const product = getProduct(id);
    const straight = product.startChoices.filter((c) => c.deckType === null);
    assert.equal(straight.length, 1, `${id} has exactly one straight-to-assessment choice`);
    assert.match(straight[0]!.label, /straight to assessment/i);
  }
});

test("DISC and Focus offer presentation-or-assessment (two choices)", () => {
  for (const id of ["disc", "focus"] as const) {
    const choices = getProduct(id).startChoices;
    assert.equal(choices.length, 2, `${id} has two choices`);
    assert.ok(choices.some((c) => c.deckType === id), `${id} presentation choice uses its deck`);
  }
});

test("Combined offers all four choices: combined, disc, focus, straight", () => {
  const choices = PRODUCTS.combined.startChoices;
  assert.equal(choices.length, 4);
  const deckTypes = choices.map((c) => c.deckType);
  assert.ok(deckTypes.includes("combined"));
  assert.ok(deckTypes.includes("disc"));
  assert.ok(deckTypes.includes("focus"));
  assert.ok(deckTypes.includes(null), "includes go-straight-to-assessment");
});

test("each product's primary deck resolves to a real deck of that type", () => {
  for (const id of PRODUCT_IDS) {
    const product = getProduct(id);
    const deck = getDeck(product.primaryDeck);
    assert.equal(deck.type, product.primaryDeck, `${id} primary deck type`);
    assert.ok(deck.slides.length >= 8, `${id} deck has enough slides`);
  }
});

test("route param type guards accept only the three known ids", () => {
  for (const id of ["disc", "focus", "combined"]) {
    assert.ok(isProductId(id));
    assert.ok(isDeckType(id));
  }
  for (const bad of ["", "DISC", "team", "../etc", "d"]) {
    assert.ok(!isProductId(bad), `${bad} is not a product`);
    assert.ok(!isDeckType(bad), `${bad} is not a deck`);
  }
});

test("every product now has a live scored assessment", () => {
  assert.equal(PRODUCTS.disc.assessmentLive, true);
  assert.equal(PRODUCTS.focus.assessmentLive, true);
  assert.equal(PRODUCTS.combined.assessmentLive, true);
});
