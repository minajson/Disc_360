<!-- GENERATED FILE — do not edit.
     Source of truth: data/media-registry.ts
     Regenerate: npm run media:guide -->

# DISC360 Media Guide

Every replaceable visual asset in DISC360, generated from
`data/media-registry.ts` (20 slots). Each slot ships as a
finished-looking editorial placeholder that becomes the real asset when its
sources are passed — no call-site restructuring. Live inventory with the same
data: `/media-guide` (dev, or super-admin in production).

General direction for all photography and film: warm natural light, diverse
professional people, candid working moments, no visible brand logos, no staged
stock poses, muted wardrobe tones that sit well on the ivory canvas.

Film contract (all video slots): WebM source + MP4 fallback + poster image,
always muted and playsInline, autoplay only where the slot specifies it,
poster-only under reduced motion, and the editorial placeholder returns if a
source fails to load. The homepage hero takes distinct desktop (3:2) and
mobile (4:5) sources. Images and film accept a `focal` position for safe
cropping.

## Marketing site (7)

### MEDIA-HOME-HERO-01 — Homepage hero film

| | |
|---|---|
| Type | video |
| Status | ready |
| Route | / |
| Section | Hero |
| Ratio | 3:2 / 4:5 |
| Dimensions | 1920×1280 (desktop) · 1080×1350 (mobile) |
| Formats | WebM (VP9) + MP4 (H.264) + JPEG poster |
| Size target | ≤ 4 MB per file · poster ≤ 200 KB |
| Video | 10–20 s loop · autoplay yes · audio no · muted playback, playsInline, WebM + MP4 fallback, poster, static under reduced motion |
| Direction | Diverse professional leadership team in conversation, warm natural light, subtle camera drift, no visible brand logos |
| Replace | public/media/hero.webm + hero-poster.jpg → <HeroFilmPlaceholder src poster> |

### MEDIA-HOW-IT-WORKS-VIDEO-01 — Assessment walkthrough demo

| | |
|---|---|
| Type | video |
| Status | placeholder |
| Route | /how-it-works |
| Section | Product demo |
| Ratio | 16:9 |
| Dimensions | 1920×1080 |
| Formats | WebM (VP9) + MP4 (H.264) + JPEG poster |
| Size target | ≤ 6 MB per file · poster ≤ 200 KB |
| Video | 15–30 s · autoplay no · audio no · muted playback, playsInline, WebM + MP4 fallback, poster, static under reduced motion |
| Direction | 15–30 second screen capture of the two-stage MOST/LEAST assessment flow, calm pacing |
| Replace | public/media/demo.webm + demo-poster.jpg → how-it-works page DemoVideo slot |

### MEDIA-COACH-PORTRAIT-01 — Coach/about anchor portrait

| | |
|---|---|
| Type | image |
| Status | placeholder |
| Route | /coaches · /about |
| Section | Editorial portrait |
| Ratio | 4:5 |
| Dimensions | 1200×1500 |
| Formats | WebP or JPEG |
| Size target | ≤ 250 KB |
| Direction | Professional coach portrait, warm natural light, uncluttered background |
| Replace | public/media/coach-01.webp → <LeadershipPortraitPlaceholder src> |

### MEDIA-CASESTUDY-FILM-01 — Documentary-style proof film

| | |
|---|---|
| Type | video |
| Status | ready |
| Route | / (testimonials) |
| Section | Case studies |
| Ratio | 16:9 |
| Dimensions | 1600×900 |
| Formats | WebM (VP9) + MP4 (H.264) + JPEG poster |
| Size target | ≤ 3 MB per file · poster ≤ 200 KB |
| Video | 20–40 s · autoplay no · audio no · muted playback, playsInline, WebM + MP4 fallback, poster, static under reduced motion |
| Direction | Team retrospective conversation, candid workplace documentary style |
| Replace | public/media/case-01.webm + case-01.jpg → <CaseStudyFilmPlaceholder src poster> |

### MEDIA-TEAMS-COLLAB-01 — Team collaboration photo

| | |
|---|---|
| Type | image |
| Status | placeholder |
| Route | /teams |
| Section | Administrators |
| Ratio | 3:2 |
| Dimensions | 1600×1067 |
| Formats | WebP or JPEG |
| Size target | ≤ 300 KB |
| Direction | Team working at a table or whiteboard, warm light |
| Replace | public/media/teams-collab.webp → MediaPlaceholder src on /teams |

### MEDIA-ORGS-WORKSHOP-01 — Leadership workshop photo

| | |
|---|---|
| Type | image |
| Status | placeholder |
| Route | /organizations |
| Section | Responsible instrument |
| Ratio | 3:2 |
| Dimensions | 1600×1067 |
| Formats | WebP or JPEG |
| Size target | ≤ 300 KB |
| Direction | Leadership workshop in a bright conference room |
| Replace | public/media/org-workshop.webp → MediaPlaceholder src on /organizations |

### MEDIA-TESTIMONIAL-PORTRAIT-01 — Testimonial portrait

| | |
|---|---|
| Type | avatar |
| Status | ready |
| Route | / (testimonials) |
| Section | Quotes |
| Ratio | 1:1 |
| Dimensions | 400×400 |
| Formats | WebP or JPEG |
| Size target | ≤ 80 KB |
| Direction | Professional headshot of quoted customer (with permission) |
| Replace | public/media/testimonial-01.webp → CaseStudiesSection quote figure |

## Product (per-account uploads & previews) (5)

### MEDIA-TEAM-COVER-01 — Optional organisation/team event cover

| | |
|---|---|
| Type | image |
| Status | placeholder |
| Route | /join/[token] · team settings |
| Section | Team join page cover |
| Ratio | 16:9 |
| Dimensions | 1600×900 |
| Formats | JPEG, PNG or WebP (upload) |
| Size target | ≤ 400 KB |
| Direction | Organisation offsite/event photo or brand banner for the session |
| Replace | Uploaded per team via Team settings → media/team-cover/<uid>/… |

### MEDIA-COACH-PHOTO-01 — Coach headshot shown on join page, presentation and reports

| | |
|---|---|
| Type | avatar |
| Status | placeholder |
| Route | /app/coach/profile |
| Section | Coach profile photo |
| Ratio | 1:1 |
| Dimensions | 800×800 |
| Formats | JPEG, PNG or WebP (upload) |
| Size target | ≤ 150 KB |
| Direction | Professional coach headshot, neutral background |
| Replace | Uploaded per coach via Coach profile → media/coach-photo/<uid>/… |

### MEDIA-COACH-BANNER-01 — Optional coach/workspace cover banner

| | |
|---|---|
| Type | image |
| Status | placeholder |
| Route | /app/coach/profile |
| Section | Coach banner |
| Ratio | 16:9 |
| Dimensions | 1600×900 |
| Formats | JPEG, PNG or WebP (upload) |
| Size target | ≤ 400 KB |
| Direction | Coaching practice brand banner or workspace photo |
| Replace | Uploaded per coach via Coach profile → media/coach-banner/<uid>/… |

### MEDIA-COACH-LOGO-01 — Coach/company logo for reports and presentation credit

| | |
|---|---|
| Type | logo |
| Status | placeholder |
| Route | /app/coach/profile |
| Section | Coach brand logo |
| Ratio | flexible |
| Dimensions | 600×240 (or square) |
| Formats | PNG or WebP (upload, transparent) |
| Size target | ≤ 100 KB |
| Background | transparent required |
| Direction | Coach practice or company logo |
| Replace | Uploaded per coach via Coach profile → media/coach-logo/<uid>/… |

### MEDIA-REPORT-PREVIEW-01 — Marketing screenshot of a finished report

| | |
|---|---|
| Type | image |
| Status | ready |
| Route | / (report preview) |
| Section | Report preview |
| Ratio | 7:5 |
| Dimensions | 1400×1000 |
| Formats | WebP or PNG |
| Size target | ≤ 300 KB |
| Direction | Polished screenshot of the individual report (live components render today) |
| Replace | public/media/report-preview.webp (optional swap for the live preview) |

## Brand identity (production mark + generated derivatives) (8)

### MEDIA-BRAND-LOGO-01 — Header/footer wordmark

| | |
|---|---|
| Type | logo |
| Status | ready |
| Route | global |
| Section | Primary horizontal logo |
| Ratio | 4:1 |
| Dimensions | 480×120 |
| Formats | SVG (inline component) |
| Size target | ≤ 20 KB |
| Background | transparent required |
| Direction | Final DISC360 horizontal wordmark |
| Replace | components/brand/BrandLogo.tsx (swap SVG internals once) |

### MEDIA-BRAND-ICON-01 — Compact identity mark

| | |
|---|---|
| Type | icon |
| Status | ready |
| Route | global |
| Section | Standalone square icon |
| Ratio | 1:1 |
| Dimensions | 512×512 |
| Formats | SVG (inline component) |
| Size target | ≤ 60 KB (raster-embedded SVG) |
| Background | transparent required |
| Direction | Final DISC360 icon |
| Replace | components/brand/BrandIcon.tsx (swap SVG internals once) |

### MEDIA-BRAND-LOGO-LIGHT-01 — Logo on dark/botanical surfaces

| | |
|---|---|
| Type | logo |
| Status | ready |
| Route | botanical/ink bands |
| Section | Light-background variant |
| Ratio | 4:1 |
| Dimensions | 480×120 |
| Formats | SVG (inline component) |
| Size target | ≤ 20 KB |
| Background | transparent required |
| Direction | Light (mineral) wordmark variant |
| Replace | BrandLogo tone="light" |

### MEDIA-BRAND-LOGO-DARK-01 — High-contrast print variant

| | |
|---|---|
| Type | logo |
| Status | ready |
| Route | print/exports |
| Section | Dark-on-light variant |
| Ratio | 4:1 |
| Dimensions | 480×120 |
| Formats | SVG (inline component) |
| Size target | ≤ 20 KB |
| Background | transparent required |
| Direction | Deep botanical wordmark variant |
| Replace | BrandLogo tone="dark" |

### MEDIA-BRAND-LOGO-MONO-01 — Single-color contexts

| | |
|---|---|
| Type | logo |
| Status | ready |
| Route | embossing/partners |
| Section | Monochrome variant |
| Ratio | 4:1 |
| Dimensions | 480×120 |
| Formats | SVG (inline component) |
| Size target | ≤ 20 KB |
| Background | transparent required |
| Direction | Monochrome wordmark (currentColor) |
| Replace | BrandLogo tone="mono" |

### MEDIA-BRAND-FAVICON-01 — Browser tab icon

| | |
|---|---|
| Type | icon |
| Status | ready |
| Route | global (browser tab) |
| Section | Favicon |
| Ratio | 1:1 |
| Dimensions | 48×48 (SVG preferred) |
| Formats | SVG |
| Size target | ≤ 10 KB |
| Background | transparent required |
| Direction | Final icon reduced for favicon |
| Replace | public/brand/favicon.svg (+ app/icon route) |

### MEDIA-BRAND-APPICON-01 — Home-screen/app icon

| | |
|---|---|
| Type | icon |
| Status | ready |
| Route | PWA/mobile |
| Section | App icon |
| Ratio | 1:1 |
| Dimensions | 1024×1024 |
| Formats | PNG |
| Size target | ≤ 250 KB |
| Direction | Final icon on solid ivory or botanical background |
| Replace | public/brand/app-icon.png |

### MEDIA-BRAND-SOCIAL-01 — Open Graph / Twitter card

| | |
|---|---|
| Type | image |
| Status | ready |
| Route | global (link sharing) |
| Section | Social sharing image |
| Ratio | 1.91:1 |
| Dimensions | 1200×630 |
| Formats | PNG or JPEG |
| Size target | ≤ 300 KB |
| Direction | Brand card: wordmark + tagline on ivory with DISC spectrum accent |
| Replace | public/brand/og-image.png (wired in app/layout metadata) |

---

# Scenes (animated now, replaceable with rendered 3D later)

Scenes are interactive SVG/CSS compositions with stable prop contracts. A
future rendered 3D asset replaces a scene's internals only — never its props
or call sites.

## DiscSpectrumScene
/ hero + /how-it-works. The original dimensional DISC spectrum: four behavioral fields on one continuous line, cursor-responsive on fine pointers, static under reduced motion. Contract: `{ className? }, self-sizing`.

## AssessmentTransitionScene
Assessment interstitials. Calm breathing backdrop, two soft radial fields. Contract: `{ className? }, absolute full-bleed, aria-hidden`.

## TeamCultureMapScene
/ team preview + /teams. Abstract roster across the four quadrants with gentle drift. Contract: `{ className? }, self-sizing`.

## ResultsRevealScene
Results reveal + / report preview. Four proportional arcs sweep in around a center glyph. Contract: `{ scores: DiscScores, className? }`.

---

# Asset drop location

Marketing assets go in `public/media/` under the names in each Replace row
(`hero.webm`, `hero-poster.jpg`, `coach-01.webp`, `case-01.webm`, …), then
pass the sources at the listed call sites. Product slots are uploaded inside
the app (team settings, coach profile). Brand assets replace the inline SVG
internals of `components/brand/` once, everywhere.
