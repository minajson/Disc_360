import { mediaRegistry, type MediaEntry, type MediaGroup } from "../../data/media-registry.ts";

/**
 * MEDIA_GUIDE.md builder — the guide is GENERATED from data/media-registry.ts
 * (the single source of truth) and must never be edited by hand. The
 * registry drift test asserts the committed file equals this builder's
 * output, so adding a registry entry without regenerating fails CI.
 *
 * Regenerate with: npm run media:guide
 */

const GROUP_TITLES: Record<MediaGroup, string> = {
  marketing: "Marketing site",
  product: "Product (per-account uploads & previews)",
  brand: "Brand identity (production mark + generated derivatives)",
};

/** The four scene contracts — animated now, replaceable with rendered 3D later. */
const SCENES = [
  {
    name: "DiscSpectrumScene",
    where: "/ hero + /how-it-works",
    contract: "{ className? }, self-sizing",
    notes:
      "The original dimensional DISC spectrum: four behavioral fields on one continuous line, cursor-responsive on fine pointers, static under reduced motion.",
  },
  {
    name: "AssessmentTransitionScene",
    where: "Assessment interstitials",
    contract: "{ className? }, absolute full-bleed, aria-hidden",
    notes: "Calm breathing backdrop, two soft radial fields.",
  },
  {
    name: "TeamCultureMapScene",
    where: "/ team preview + /teams",
    contract: "{ className? }, self-sizing",
    notes: "Abstract roster across the four quadrants with gentle drift.",
  },
  {
    name: "ResultsRevealScene",
    where: "Results reveal + / report preview",
    contract: "{ scores: DiscScores, className? }",
    notes: "Four proportional arcs sweep in around a center glyph.",
  },
];

function entryBlock(entry: MediaEntry): string {
  const rows: [string, string][] = [
    ["Type", entry.type],
    ["Status", entry.status],
    ["Route", entry.route],
    ["Section", entry.section],
    ["Ratio", entry.ratio],
    ["Dimensions", entry.dimensions],
    ["Formats", entry.formats],
    ["Size target", entry.sizeTarget],
  ];
  if (entry.video) {
    rows.push([
      "Video",
      `${entry.video.duration} · autoplay ${entry.video.autoplay ? "yes" : "no"} · audio ${entry.video.audio ? "yes" : "no"} · muted playback, playsInline, WebM + MP4 fallback, poster, static under reduced motion`,
    ]);
  }
  if (entry.transparent) rows.push(["Background", "transparent required"]);
  rows.push(["Direction", entry.suggestedContent]);
  rows.push(["Replace", entry.replacementPath]);

  return [
    `### ${entry.id} — ${entry.purpose}`,
    "",
    "| | |",
    "|---|---|",
    ...rows.map(([k, v]) => `| ${k} | ${v.replace(/\|/g, "·")} |`),
    "",
  ].join("\n");
}

export function buildMediaGuide(registry: MediaEntry[] = mediaRegistry): string {
  const groups: MediaGroup[] = ["marketing", "product", "brand"];
  const sections = groups
    .map((group) => {
      const entries = registry.filter((entry) => entry.group === group);
      return [`## ${GROUP_TITLES[group]} (${entries.length})`, "", ...entries.map(entryBlock)].join(
        "\n",
      );
    })
    .join("\n");

  return `<!-- GENERATED FILE — do not edit.
     Source of truth: data/media-registry.ts
     Regenerate: npm run media:guide -->

# DISC360 Media Guide

Every replaceable visual asset in DISC360, generated from
\`data/media-registry.ts\` (${registry.length} slots). Each slot ships as a
finished-looking editorial placeholder that becomes the real asset when its
sources are passed — no call-site restructuring. Live inventory with the same
data: \`/media-guide\` (dev, or super-admin in production).

General direction for all photography and film: warm natural light, diverse
professional people, candid working moments, no visible brand logos, no staged
stock poses, muted wardrobe tones that sit well on the ivory canvas.

Film contract (all video slots): WebM source + MP4 fallback + poster image,
always muted and playsInline, autoplay only where the slot specifies it,
poster-only under reduced motion, and the editorial placeholder returns if a
source fails to load. The homepage hero takes distinct desktop (3:2) and
mobile (4:5) sources. Images and film accept a \`focal\` position for safe
cropping.

${sections}
---

# Scenes (animated now, replaceable with rendered 3D later)

Scenes are interactive SVG/CSS compositions with stable prop contracts. A
future rendered 3D asset replaces a scene's internals only — never its props
or call sites.

${SCENES.map((s) => `## ${s.name}\n${s.where}. ${s.notes} Contract: \`${s.contract}\`.`).join("\n\n")}

---

# Asset drop location

Marketing assets go in \`public/media/\` under the names in each Replace row
(\`hero.webm\`, \`hero-poster.jpg\`, \`coach-01.webp\`, \`case-01.webm\`, …), then
pass the sources at the listed call sites. Product slots are uploaded inside
the app (team settings, coach profile). Brand assets replace the inline SVG
internals of \`components/brand/\` once, everywhere.
`;
}
