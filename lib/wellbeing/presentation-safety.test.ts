import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const code = (path: string) =>
  read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * Presentation mode is projected onto a wall in a room of people.
 *
 * Everything else in this product is read by one person on one screen; this is
 * the one surface where a mistake is seen by everybody at once, including
 * people whose own answers are in the figures. So the guarantees are asserted
 * structurally — what the deck model can HOLD — rather than by checking what a
 * particular render happened to print.
 */

/* ── what the deck cannot carry ─────────────────────────────────────── */

test("no slide type has a field that could hold a person", () => {
  const model = code("lib/wellbeing/presentation.ts");
  const union = model.slice(
    model.indexOf("export type DeckSlide"),
    model.indexOf("export interface WellbeingDeck"),
  );
  assert.ok(union.length > 0, "the slide union must be found for this test to mean anything");

  for (const forbidden of [
    "email",
    "displayName",
    "display_name",
    "fullName",
    "full_name",
    "profileId",
    "profile_id",
    "participantName",
    "roster",
    "itemPositions",
    "item_positions",
  ]) {
    assert.ok(
      !union.includes(forbidden),
      `a deck slide can carry "${forbidden}" — presentation mode must hold no individual`,
    );
  }

  // "participants" appears, and must only ever be a COUNT. A field of that
  // name typed as anything else would be a roster on a projector.
  for (const match of union.matchAll(/participants\s*:\s*([A-Za-z<>\[\]| ]+)/g)) {
    assert.match(
      match[1]!.trim(),
      /^number$/,
      `"participants" is typed "${match[1]!.trim()}" — on this surface it may only be a count`,
    );
  }
});

test("the deck reads no participant table of its own", () => {
  const model = code("lib/wellbeing/presentation.ts");
  for (const table of [
    "wellbeing_results",
    "wellbeing_responses",
    "wellbeing_sessions",
    "team_members",
    "profiles",
  ]) {
    assert.ok(
      !model.includes(`"${table}"`),
      `the deck queries ${table} directly; it must compose already-suppressed reads`,
    );
  }
  // It composes the same authorised, suppressed readers the screen uses.
  assert.match(model, /getWellbeingWorkspace/);
  assert.match(model, /getWellbeingCoverage/);
});

test("the projected surface offers no route into the rest of the platform", () => {
  // A control on a screen a room is watching is a control somebody clicks by
  // accident, and every crossing out of this shell leads somewhere with names
  // in it.
  for (const path of [
    "components/wellbeing/present/DeckSlides.tsx",
    "components/wellbeing/present/DeckLiveParticipation.tsx",
  ]) {
    const source = code(path);
    assert.ok(!source.includes('href="/app'), `${path} links into the platform`);
  }
});

/* ── the room slide ─────────────────────────────────────────────────── */

test("the QR slide exists, and carries the campaign's own join URL", () => {
  const model = code("lib/wellbeing/presentation.ts");
  assert.match(model, /kind: "join"/, "presentation mode must be able to show the code");
  assert.match(model, /joinUrl/);
  // Built from what the caller passes, never re-derived from a team invite.
  assert.ok(!model.includes("invite_token"));
});

test("a campaign that will not admit anybody projects no QR", () => {
  /*
   * Projecting a code for a paused or closed campaign invites a room full of
   * people to scan something that refuses them — and they will conclude the
   * product is broken rather than that the campaign is shut.
   */
  const page = code("app/(wellbeing-present)/wellbeing/present/[teamId]/page.tsx");
  assert.match(
    page,
    /joinUrl:\s*admitsParticipants\(identity\.lifecycle\)\s*\?\s*identity\.joinUrl\s*:\s*null/,
    "the QR must be gated on the campaign actually admitting participants",
  );

  // And the builder only emits the slide when it has a URL to put on it.
  const model = code("lib/wellbeing/presentation.ts");
  assert.match(model, /if \(joinUrl && teamId\) \{/);
});

test("the live panel on the deck carries only counts", () => {
  const panel = code("components/wellbeing/present/DeckLiveParticipation.tsx");
  for (const forbidden of ["name", "email", "score", "median", "result"]) {
    assert.ok(
      !new RegExp(`\\b${forbidden}\\b`, "i").test(panel.replace(/CampaignTally/g, "")),
      `the deck's live panel references "${forbidden}"`,
    );
  }
  // It is the same authorised aggregate stream the facilitator panel uses.
  assert.match(panel, /\/api\/wellbeing\/campaigns\/\$\{teamId\}\/participation/);
});

/* ── it is readable from the back of a room ─────────────────────────── */

test("deck figures are sized in viewport units, not fixed pixels", () => {
  const slides = read("components/wellbeing/present/DeckSlides.tsx");
  const panel = read("components/wellbeing/present/DeckLiveParticipation.tsx");
  // `clamp(min, vw, max)` is what makes a figure legible on a laptop and on a
  // meeting-room screen without a second layout.
  assert.match(slides, /clamp\([^)]*vw/);
  assert.match(panel, /clamp\([^)]*vw/);
});
