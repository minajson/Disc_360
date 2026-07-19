import { writeFileSync } from "node:fs";
import { buildMediaGuide } from "../lib/media/guide.ts";

/**
 * Regenerates MEDIA_GUIDE.md from data/media-registry.ts.
 * The drift test (data/media-registry.test.ts) fails when the committed
 * guide does not match the registry — run this after any registry change.
 */
writeFileSync("MEDIA_GUIDE.md", buildMediaGuide());
console.log("MEDIA_GUIDE.md regenerated from data/media-registry.ts");
