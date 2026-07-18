import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DURATION,
  preset,
  presetsForMotion,
  slideTransition,
  staggerContainer,
  type PresetName,
} from "./motion.ts";

const NAMES: PresetName[] = [
  "fadeUp",
  "softScale",
  "lineDraw",
  "chartReveal",
  "maskReveal",
  "crossfade",
];

test("all six named presets exist for both motion preferences", () => {
  for (const reduced of [false, true]) {
    const presets = presetsForMotion(reduced);
    for (const name of NAMES) {
      assert.ok(presets[name], `${name} exists (reduced=${reduced})`);
      assert.ok(presets[name].variants.hidden, `${name} has hidden`);
      assert.ok(presets[name].variants.visible, `${name} has visible`);
    }
  }
});

test("durations follow the house scale", () => {
  // standard 350–600ms, section 600–900ms, ambient very slow.
  assert.ok(DURATION.standard >= 0.35 && DURATION.standard <= 0.6);
  assert.ok(DURATION.section >= 0.6 && DURATION.section <= 0.9);
  assert.ok(DURATION.ambient >= 10);
});

test("reduced motion strips travel, scale and draw — content stays put", () => {
  // fadeUp: no y offset when reduced.
  const fade = preset("fadeUp", true);
  assert.equal((fade.variants.hidden as { y?: number }).y, undefined);
  // softScale: no scale change when reduced.
  const scale = preset("softScale", true);
  assert.equal((scale.variants.hidden as { scale?: number }).scale, undefined);
  // lineDraw: end-state geometry present immediately (pathLength 1, not 0).
  const line = preset("lineDraw", true);
  assert.equal((line.variants.hidden as { pathLength?: number }).pathLength, 1);
  // maskReveal: fully revealed immediately.
  const mask = preset("maskReveal", true);
  assert.equal((mask.variants.hidden as { clipPath?: string }).clipPath, "inset(0 0% 0 0)");
});

test("full motion actually moves — fadeUp travels, softScale scales", () => {
  assert.equal((preset("fadeUp", false).variants.hidden as { y?: number }).y, 24);
  assert.equal((preset("softScale", false).variants.hidden as { scale?: number }).scale, 0.96);
  assert.equal((preset("lineDraw", false).variants.hidden as { pathLength?: number }).pathLength, 0);
});

test("reduced-motion transitions are effectively instant", () => {
  for (const name of NAMES) {
    const duration = (preset(name, true).transition as { duration?: number }).duration ?? 0;
    assert.ok(duration <= 0.01, `${name} reduced transition is instant`);
  }
});

test("stagger is disabled under reduced motion", () => {
  const reduced = staggerContainer(true);
  const full = staggerContainer(false);
  const rStagger = (reduced.visible as { transition?: { staggerChildren?: number } }).transition
    ?.staggerChildren;
  const fStagger = (full.visible as { transition?: { staggerChildren?: number } }).transition
    ?.staggerChildren;
  assert.equal(rStagger, 0);
  assert.ok((fStagger ?? 0) > 0);
});

test("slide transition is a plain crossfade when reduced, has travel when full", () => {
  assert.equal((slideTransition(true).variants.hidden as { y?: number }).y, undefined);
  assert.equal((slideTransition(false).variants.hidden as { y?: number }).y, 12);
});
