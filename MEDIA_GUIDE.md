# DISC360 Media Guide

Every media slot in the product ships as a finished-looking editorial
placeholder that becomes the real asset when `src` (and `poster` for film) is
passed — no call-site restructuring. All placeholders live in
`components/media/`. Respect reduced motion: film never autoplays sound, and
scenes render statically when the user prefers reduced motion.

General direction for all photography and film: warm natural light, diverse
professional people, candid working moments, no visible brand logos, no staged
stock poses, muted wardrobe tones that sit well on the ivory canvas.

---

## hero-film

| | |
|---|---|
| Component | `HeroFilmPlaceholder` |
| Route | `/` (hero) |
| Purpose | Establishes leadership warmth in the opening composition |
| Ratio | 3:2 desktop · 4:5 mobile (`variant` prop) |
| Dimensions | 1920×1280 desktop · 1080×1350 mobile |
| Format | WebM (VP9) + MP4 (H.264) fallback + JPEG poster |
| Size target | ≤ 4 MB per file, ≤ 200 KB poster |
| Direction | Diverse leadership team in conversation, subtle camera drift, warm window light |
| Replace | `<HeroFilmPlaceholder src="/media/hero.webm" poster="/media/hero-poster.jpg" />` |

## leadership-portrait

| | |
|---|---|
| Component | `LeadershipPortraitPlaceholder` |
| Route | `/coaches`, `/about` |
| Purpose | Human anchor for coach and about narratives |
| Ratio | 4:5 |
| Dimensions | 1200×1500 |
| Format | JPEG/WebP photo |
| Size target | ≤ 250 KB |
| Direction | Single subject, honest expression, shallow depth, uncluttered warm background |
| Replace | `<LeadershipPortraitPlaceholder src="/media/coach-01.webp" label="…" />` |

## case-study-film

| | |
|---|---|
| Component | `CaseStudyFilmPlaceholder` |
| Route | `/` (testimonials), `/organizations`, `/resources` |
| Purpose | Documentary-style proof moments; supports quote overlays via children |
| Ratio | 16:9 |
| Dimensions | 1600×900 |
| Format | WebM + MP4 + poster |
| Size target | ≤ 3 MB per file |
| Direction | Team retrospective or workshop, candid, warm, real workplace |
| Replace | `<CaseStudyFilmPlaceholder src="/media/case-01.webm" poster="/media/case-01.jpg" />` |

## team-collaboration (generic slot)

Use `MediaPlaceholder` directly: ratio `3/2`, kind `photo`, 1600×1067,
≤ 300 KB, teams working at a table or whiteboard, warm light. Used on
`/teams` and `/organizations`.

---

# Scenes (animated now, replaceable with rendered 3D later)

Scenes are interactive SVG/CSS compositions with stable prop contracts. A
future Fable-generated 3D asset replaces a scene's internals only — never its
props or call sites.

## DiscSpectrumScene
`/` hero + `/how-it-works`. The original dimensional DISC spectrum: four
behavioral fields on one continuous line, cursor-responsive on fine pointers,
static under reduced motion. Contract: `{ className? }`, self-sizing.

## AssessmentTransitionScene
Assessment interstitials. Calm breathing backdrop, two soft radial fields.
Contract: `{ className? }`, absolute full-bleed, `aria-hidden`.

## TeamCultureMapScene
`/` team preview + `/teams`. Abstract roster across the four quadrants with
gentle drift. Contract: `{ className? }`, self-sizing.

## ResultsRevealScene
Results reveal + `/` report preview. Four proportional arcs sweep in around a
center glyph. Contract: `{ scores: DiscScores, className? }`.

---

# Asset drop location

Place final assets in `public/media/` using the slot names above
(`hero.webm`, `hero-poster.jpg`, `coach-01.webp`, `case-01.webm`, …), then
pass `src`/`poster` at the call sites listed per slot.
