# DISC360 Media Audit

> Generated from data/media-registry.ts — keep the registry as the source of
> truth and re-generate this file when it changes. The live version renders
> at /media-guide (development, or production for super admins).

| Media ID | Type | Route | Section | Purpose | Dimensions | Ratio | Suggested content | Replacement path | Status |
|---|---|---|---|---|---|---|---|---|---|
| MEDIA-HOME-HERO-01 | video | / | Hero | Homepage hero film | 1920×1280 (desktop) · 1080×1350 (mobile) (video: 10–20 s loop, autoplay yes, audio no) | 3:2 / 4:5 | Diverse professional leadership team in conversation, warm natural light, subtle camera drift, no visible brand logos | public/media/hero.webm + hero-poster.jpg → <HeroFilmPlaceholder src poster> | placeholder |
| MEDIA-HOW-IT-WORKS-VIDEO-01 | video | /how-it-works | Product demo | Assessment walkthrough demo | 1920×1080 (video: 15–30 s, autoplay no, audio no) | 16:9 | 15–30 second screen capture of the two-stage MOST/LEAST assessment flow, calm pacing | public/media/demo.webm + demo-poster.jpg → how-it-works page DemoVideo slot | placeholder |
| MEDIA-COACH-PORTRAIT-01 | image | /coaches · /about | Editorial portrait | Coach/about anchor portrait | 1200×1500 | 4:5 | Professional coach portrait, warm natural light, uncluttered background | public/media/coach-01.webp → <LeadershipPortraitPlaceholder src> | placeholder |
| MEDIA-CASESTUDY-FILM-01 | video | / (testimonials) | Case studies | Documentary-style proof film | 1600×900 (video: 20–40 s, autoplay no, audio no) | 16:9 | Team retrospective conversation, candid workplace documentary style | public/media/case-01.webm + case-01.jpg → <CaseStudyFilmPlaceholder src poster> | placeholder |
| MEDIA-TEAMS-COLLAB-01 | image | /teams | Administrators | Team collaboration photo | 1600×1067 | 3:2 | Team working at a table or whiteboard, warm light | public/media/teams-collab.webp → MediaPlaceholder src on /teams | placeholder |
| MEDIA-ORGS-WORKSHOP-01 | image | /organizations | Responsible instrument | Leadership workshop photo | 1600×1067 | 3:2 | Leadership workshop in a bright conference room | public/media/org-workshop.webp → MediaPlaceholder src on /organizations | placeholder |
| MEDIA-TESTIMONIAL-PORTRAIT-01 | avatar | / (testimonials) | Quotes | Testimonial portrait | 400×400 | 1:1 | Professional headshot of quoted customer (with permission) | public/media/testimonial-01.webp → CaseStudiesSection quote figure | placeholder |
| MEDIA-TEAM-COVER-01 | image | /join/[token] · team settings | Team join page cover | Optional organisation/team event cover | 1600×900 | 16:9 | Organisation offsite/event photo or brand banner for the session | Uploaded per team via Team settings → media/team-cover/<uid>/… | placeholder |
| MEDIA-COACH-PHOTO-01 | avatar | /app/coach/profile | Coach profile photo | Coach headshot shown on join page, presentation and reports | 800×800 | 1:1 | Professional coach headshot, neutral background | Uploaded per coach via Coach profile → media/coach-photo/<uid>/… | placeholder |
| MEDIA-COACH-BANNER-01 | image | /app/coach/profile | Coach banner | Optional coach/workspace cover banner | 1600×900 | 16:9 | Coaching practice brand banner or workspace photo | Uploaded per coach via Coach profile → media/coach-banner/<uid>/… | placeholder |
| MEDIA-COACH-LOGO-01 | logo | /app/coach/profile | Coach brand logo | Coach/company logo for reports and presentation credit | 600×240 (or square) (transparent bg) | flexible | Coach practice or company logo | Uploaded per coach via Coach profile → media/coach-logo/<uid>/… | placeholder |
| MEDIA-REPORT-PREVIEW-01 | image | / (report preview) | Report preview | Marketing screenshot of a finished report | 1400×1000 | 7:5 | Polished screenshot of the individual report (live components render today) | public/media/report-preview.webp (optional swap for the live preview) | ready |
| MEDIA-BRAND-LOGO-01 | logo | global | Primary horizontal logo | Header/footer wordmark | 480×120 (transparent bg) | 4:1 | Final DISC360 horizontal wordmark | components/brand/BrandLogo.tsx (swap SVG internals once) | placeholder |
| MEDIA-BRAND-ICON-01 | icon | global | Standalone square icon | Compact identity mark | 512×512 (transparent bg) | 1:1 | Final DISC360 icon | components/brand/BrandIcon.tsx (swap SVG internals once) | placeholder |
| MEDIA-BRAND-LOGO-LIGHT-01 | logo | botanical/ink bands | Light-background variant | Logo on dark/botanical surfaces | 480×120 (transparent bg) | 4:1 | Light (mineral) wordmark variant | BrandLogo tone="light" | placeholder |
| MEDIA-BRAND-LOGO-DARK-01 | logo | print/exports | Dark-on-light variant | High-contrast print variant | 480×120 (transparent bg) | 4:1 | Deep botanical wordmark variant | BrandLogo tone="dark" | placeholder |
| MEDIA-BRAND-LOGO-MONO-01 | logo | embossing/partners | Monochrome variant | Single-color contexts | 480×120 (transparent bg) | 4:1 | Monochrome wordmark (currentColor) | BrandLogo tone="mono" | placeholder |
| MEDIA-BRAND-FAVICON-01 | icon | global (browser tab) | Favicon | Browser tab icon | 48×48 (SVG preferred) (transparent bg) | 1:1 | Final icon reduced for favicon | public/brand/favicon.svg (+ app/icon route) | placeholder |
| MEDIA-BRAND-APPICON-01 | icon | PWA/mobile | App icon | Home-screen/app icon | 1024×1024 | 1:1 | Final icon on solid ivory or botanical background | public/brand/app-icon.png | placeholder |
| MEDIA-BRAND-SOCIAL-01 | image | global (link sharing) | Social sharing image | Open Graph / Twitter card | 1200×630 | 1.91:1 | Brand card: wordmark + tagline on ivory with DISC spectrum accent | public/brand/og-image.png (wired in app/layout metadata) | placeholder |

## Scenes (code-rendered, swappable with rendered 3D)

DiscSpectrumScene · AssessmentTransitionScene · TeamCultureMapScene ·
ResultsRevealScene — see MEDIA_GUIDE.md for their stable prop contracts.
