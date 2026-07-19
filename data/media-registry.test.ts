import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { mediaRegistry } from "./media-registry.ts";
import { buildMediaGuide } from "../lib/media/guide.ts";

test("every media entry has a unique, well-formed ID", () => {
  const ids = mediaRegistry.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate media IDs");
  for (const id of ids) {
    assert.match(id, /^MEDIA-[A-Z0-9-]+-\d{2}$/, `malformed id: ${id}`);
  }
});

test("every entry carries the required spec fields", () => {
  for (const entry of mediaRegistry) {
    assert.ok(entry.type, `${entry.id}: type`);
    assert.ok(entry.route.length > 0, `${entry.id}: route`);
    assert.ok(entry.section.length > 0, `${entry.id}: section`);
    assert.ok(entry.purpose.length > 0, `${entry.id}: purpose`);
    assert.ok(entry.dimensions.length > 0, `${entry.id}: dimensions`);
    assert.ok(entry.ratio.length > 0, `${entry.id}: ratio`);
    assert.ok(entry.suggestedContent.length > 0, `${entry.id}: suggested content`);
    assert.ok(entry.replacementPath.length > 0, `${entry.id}: replacement path`);
    assert.ok(entry.formats.length > 0, `${entry.id}: formats`);
    assert.ok(entry.sizeTarget.length > 0, `${entry.id}: size target`);
    assert.ok(["marketing", "product", "brand"].includes(entry.group), `${entry.id}: group`);
    assert.ok(
      ["placeholder", "ready", "missing"].includes(entry.status),
      `${entry.id}: status`,
    );
  }
});

test("video entries always declare duration, autoplay and audio", () => {
  for (const entry of mediaRegistry.filter((e) => e.type === "video")) {
    assert.ok(entry.video, `${entry.id}: video spec missing`);
    assert.ok(entry.video.duration.length > 0, `${entry.id}: duration`);
    assert.equal(typeof entry.video.autoplay, "boolean", `${entry.id}: autoplay`);
    assert.equal(typeof entry.video.audio, "boolean", `${entry.id}: audio`);
  }
});

test("the eight brand assets are registered", () => {
  const brand = mediaRegistry.filter((entry) => entry.id.startsWith("MEDIA-BRAND-"));
  assert.equal(brand.length, 8);
});

test("MEDIA_GUIDE.md is generated from the registry and lists every entry", () => {
  // The guide is generated — never hand-maintained. Exact equality means a
  // registry change without `npm run media:guide` fails here, and a
  // hand-edit to the guide fails here too.
  const guide = readFileSync(join(import.meta.dirname, "..", "MEDIA_GUIDE.md"), "utf8");
  for (const entry of mediaRegistry) {
    assert.ok(guide.includes(entry.id), `${entry.id} missing from MEDIA_GUIDE.md`);
  }
  assert.equal(guide, buildMediaGuide(mediaRegistry), "MEDIA_GUIDE.md is stale — run npm run media:guide");
});
