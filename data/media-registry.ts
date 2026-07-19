/**
 * Central registry of every replaceable visual asset in DISC360 — the single
 * source of truth. /media-guide renders from it live, MEDIA_GUIDE.md is
 * GENERATED from it (npm run media:guide, drift-tested), and MediaPlaceholder
 * shows these specs in development. Adding a visual slot = adding an entry.
 */

export type MediaType = "image" | "video" | "logo" | "icon" | "avatar";
export type MediaStatus = "placeholder" | "ready" | "missing";

export type MediaGroup = "marketing" | "product" | "brand";

export interface MediaEntry {
  id: string;
  type: MediaType;
  /** Which part of the platform the slot belongs to (drives guide grouping). */
  group: MediaGroup;
  /** Route(s) where the asset appears. */
  route: string;
  section: string;
  purpose: string;
  dimensions: string;
  ratio: string;
  /** Accepted file formats for the final asset. */
  formats: string;
  /** File-size budget for the final asset. */
  sizeTarget: string;
  suggestedContent: string;
  /** Where the final file goes (or which component to pass src into). */
  replacementPath: string;
  status: MediaStatus;
  /** Image-only: transparent background required. */
  transparent?: boolean;
  video?: {
    duration: string;
    autoplay: boolean;
    audio: boolean;
  };
}

export const mediaRegistry: MediaEntry[] = [
  /* ── marketing ─────────────────────────────────────────────────── */
  {
    id: "MEDIA-HOME-HERO-01",
    type: "video",
    group: "marketing",
    route: "/",
    section: "Hero",
    purpose: "Homepage hero film",
    dimensions: "1920×1280 (desktop) · 1080×1350 (mobile)",
    ratio: "3:2 / 4:5",
    formats: "WebM (VP9) + MP4 (H.264) + JPEG poster",
    sizeTarget: "≤ 4 MB per file · poster ≤ 200 KB",
    suggestedContent:
      "Diverse professional leadership team in conversation, warm natural light, subtle camera drift, no visible brand logos",
    replacementPath: "public/media/hero.webm + hero-poster.jpg → <HeroFilmPlaceholder src poster>",
    status: "placeholder",
    video: { duration: "10–20 s loop", autoplay: true, audio: false },
  },
  {
    id: "MEDIA-HOW-IT-WORKS-VIDEO-01",
    type: "video",
    group: "marketing",
    route: "/how-it-works",
    section: "Product demo",
    purpose: "Assessment walkthrough demo",
    dimensions: "1920×1080",
    ratio: "16:9",
    formats: "WebM (VP9) + MP4 (H.264) + JPEG poster",
    sizeTarget: "≤ 6 MB per file · poster ≤ 200 KB",
    suggestedContent:
      "15–30 second screen capture of the two-stage MOST/LEAST assessment flow, calm pacing",
    replacementPath: "public/media/demo.webm + demo-poster.jpg → how-it-works page DemoVideo slot",
    status: "placeholder",
    video: { duration: "15–30 s", autoplay: false, audio: false },
  },
  {
    id: "MEDIA-COACH-PORTRAIT-01",
    type: "image",
    group: "marketing",
    route: "/coaches · /about",
    section: "Editorial portrait",
    purpose: "Coach/about anchor portrait",
    dimensions: "1200×1500",
    ratio: "4:5",
    formats: "WebP or JPEG",
    sizeTarget: "≤ 250 KB",
    suggestedContent: "Professional coach portrait, warm natural light, uncluttered background",
    replacementPath: "public/media/coach-01.webp → <LeadershipPortraitPlaceholder src>",
    status: "placeholder",
  },
  {
    id: "MEDIA-CASESTUDY-FILM-01",
    type: "video",
    group: "marketing",
    route: "/ (testimonials)",
    section: "Case studies",
    purpose: "Documentary-style proof film",
    dimensions: "1600×900",
    ratio: "16:9",
    formats: "WebM (VP9) + MP4 (H.264) + JPEG poster",
    sizeTarget: "≤ 3 MB per file · poster ≤ 200 KB",
    suggestedContent: "Team retrospective conversation, candid workplace documentary style",
    replacementPath: "public/media/case-01.webm + case-01.jpg → <CaseStudyFilmPlaceholder src poster>",
    status: "placeholder",
    video: { duration: "20–40 s", autoplay: false, audio: false },
  },
  {
    id: "MEDIA-TEAMS-COLLAB-01",
    type: "image",
    group: "marketing",
    route: "/teams",
    section: "Administrators",
    purpose: "Team collaboration photo",
    dimensions: "1600×1067",
    ratio: "3:2",
    formats: "WebP or JPEG",
    sizeTarget: "≤ 300 KB",
    suggestedContent: "Team working at a table or whiteboard, warm light",
    replacementPath: "public/media/teams-collab.webp → MediaPlaceholder src on /teams",
    status: "placeholder",
  },
  {
    id: "MEDIA-ORGS-WORKSHOP-01",
    type: "image",
    group: "marketing",
    route: "/organizations",
    section: "Responsible instrument",
    purpose: "Leadership workshop photo",
    dimensions: "1600×1067",
    ratio: "3:2",
    formats: "WebP or JPEG",
    sizeTarget: "≤ 300 KB",
    suggestedContent: "Leadership workshop in a bright conference room",
    replacementPath: "public/media/org-workshop.webp → MediaPlaceholder src on /organizations",
    status: "placeholder",
  },
  {
    id: "MEDIA-TESTIMONIAL-PORTRAIT-01",
    type: "avatar",
    group: "marketing",
    route: "/ (testimonials)",
    section: "Quotes",
    purpose: "Testimonial portrait",
    dimensions: "400×400",
    ratio: "1:1",
    formats: "WebP or JPEG",
    sizeTarget: "≤ 80 KB",
    suggestedContent: "Professional headshot of quoted customer (with permission)",
    replacementPath: "public/media/testimonial-01.webp → CaseStudiesSection quote figure",
    status: "placeholder",
  },

  /* ── product ───────────────────────────────────────────────────── */
  {
    id: "MEDIA-TEAM-COVER-01",
    type: "image",
    group: "product",
    route: "/join/[token] · team settings",
    section: "Team join page cover",
    purpose: "Optional organisation/team event cover",
    dimensions: "1600×900",
    ratio: "16:9",
    formats: "JPEG, PNG or WebP (upload)",
    sizeTarget: "≤ 400 KB",
    suggestedContent: "Organisation offsite/event photo or brand banner for the session",
    replacementPath: "Uploaded per team via Team settings → media/team-cover/<uid>/…",
    status: "placeholder",
  },
  {
    id: "MEDIA-COACH-PHOTO-01",
    type: "avatar",
    group: "product",
    route: "/app/coach/profile",
    section: "Coach profile photo",
    purpose: "Coach headshot shown on join page, presentation and reports",
    dimensions: "800×800",
    ratio: "1:1",
    formats: "JPEG, PNG or WebP (upload)",
    sizeTarget: "≤ 150 KB",
    suggestedContent: "Professional coach headshot, neutral background",
    replacementPath: "Uploaded per coach via Coach profile → media/coach-photo/<uid>/…",
    status: "placeholder",
  },
  {
    id: "MEDIA-COACH-BANNER-01",
    type: "image",
    group: "product",
    route: "/app/coach/profile",
    section: "Coach banner",
    purpose: "Optional coach/workspace cover banner",
    dimensions: "1600×900",
    ratio: "16:9",
    formats: "JPEG, PNG or WebP (upload)",
    sizeTarget: "≤ 400 KB",
    suggestedContent: "Coaching practice brand banner or workspace photo",
    replacementPath: "Uploaded per coach via Coach profile → media/coach-banner/<uid>/…",
    status: "placeholder",
  },
  {
    id: "MEDIA-COACH-LOGO-01",
    type: "logo",
    group: "product",
    route: "/app/coach/profile",
    section: "Coach brand logo",
    purpose: "Coach/company logo for reports and presentation credit",
    dimensions: "600×240 (or square)",
    ratio: "flexible",
    formats: "PNG or WebP (upload, transparent)",
    sizeTarget: "≤ 100 KB",
    suggestedContent: "Coach practice or company logo",
    replacementPath: "Uploaded per coach via Coach profile → media/coach-logo/<uid>/…",
    status: "placeholder",
    transparent: true,
  },
  {
    id: "MEDIA-REPORT-PREVIEW-01",
    type: "image",
    group: "product",
    route: "/ (report preview)",
    section: "Report preview",
    purpose: "Marketing screenshot of a finished report",
    dimensions: "1400×1000",
    ratio: "7:5",
    formats: "WebP or PNG",
    sizeTarget: "≤ 300 KB",
    suggestedContent: "Polished screenshot of the individual report (live components render today)",
    replacementPath: "public/media/report-preview.webp (optional swap for the live preview)",
    status: "ready",
  },

  /* ── brand identity (all TEMPORARY) ────────────────────────────── */
  {
    id: "MEDIA-BRAND-LOGO-01",
    type: "logo",
    group: "brand",
    route: "global",
    section: "Primary horizontal logo",
    purpose: "Header/footer wordmark",
    dimensions: "480×120",
    ratio: "4:1",
    formats: "SVG (inline component)",
    sizeTarget: "≤ 20 KB",
    suggestedContent: "Final DISC360 horizontal wordmark",
    replacementPath: "components/brand/BrandLogo.tsx (swap SVG internals once)",
    status: "placeholder",
    transparent: true,
  },
  {
    id: "MEDIA-BRAND-ICON-01",
    type: "icon",
    group: "brand",
    route: "global",
    section: "Standalone square icon",
    purpose: "Compact identity mark",
    dimensions: "512×512",
    ratio: "1:1",
    formats: "SVG (inline component)",
    sizeTarget: "≤ 15 KB",
    suggestedContent: "Final DISC360 icon",
    replacementPath: "components/brand/BrandIcon.tsx (swap SVG internals once)",
    status: "placeholder",
    transparent: true,
  },
  {
    id: "MEDIA-BRAND-LOGO-LIGHT-01",
    type: "logo",
    group: "brand",
    route: "botanical/ink bands",
    section: "Light-background variant",
    purpose: "Logo on dark/botanical surfaces",
    dimensions: "480×120",
    ratio: "4:1",
    formats: "SVG (inline component)",
    sizeTarget: "≤ 20 KB",
    suggestedContent: "Light (mineral) wordmark variant",
    replacementPath: "BrandLogo tone=\"light\"",
    status: "placeholder",
    transparent: true,
  },
  {
    id: "MEDIA-BRAND-LOGO-DARK-01",
    type: "logo",
    group: "brand",
    route: "print/exports",
    section: "Dark-on-light variant",
    purpose: "High-contrast print variant",
    dimensions: "480×120",
    ratio: "4:1",
    formats: "SVG (inline component)",
    sizeTarget: "≤ 20 KB",
    suggestedContent: "Deep botanical wordmark variant",
    replacementPath: "BrandLogo tone=\"dark\"",
    status: "placeholder",
    transparent: true,
  },
  {
    id: "MEDIA-BRAND-LOGO-MONO-01",
    type: "logo",
    group: "brand",
    route: "embossing/partners",
    section: "Monochrome variant",
    purpose: "Single-color contexts",
    dimensions: "480×120",
    ratio: "4:1",
    formats: "SVG (inline component)",
    sizeTarget: "≤ 20 KB",
    suggestedContent: "Monochrome wordmark (currentColor)",
    replacementPath: "BrandLogo tone=\"mono\"",
    status: "placeholder",
    transparent: true,
  },
  {
    id: "MEDIA-BRAND-FAVICON-01",
    type: "icon",
    group: "brand",
    route: "global (browser tab)",
    section: "Favicon",
    purpose: "Browser tab icon",
    dimensions: "48×48 (SVG preferred)",
    ratio: "1:1",
    formats: "SVG",
    sizeTarget: "≤ 10 KB",
    suggestedContent: "Final icon reduced for favicon",
    replacementPath: "public/brand/favicon.svg (+ app/icon route)",
    status: "placeholder",
    transparent: true,
  },
  {
    id: "MEDIA-BRAND-APPICON-01",
    type: "icon",
    group: "brand",
    route: "PWA/mobile",
    section: "App icon",
    purpose: "Home-screen/app icon",
    dimensions: "1024×1024",
    ratio: "1:1",
    formats: "PNG",
    sizeTarget: "≤ 150 KB",
    suggestedContent: "Final icon on solid ivory or botanical background",
    replacementPath: "public/brand/app-icon.png",
    status: "placeholder",
  },
  {
    id: "MEDIA-BRAND-SOCIAL-01",
    type: "image",
    group: "brand",
    route: "global (link sharing)",
    section: "Social sharing image",
    purpose: "Open Graph / Twitter card",
    dimensions: "1200×630",
    ratio: "1.91:1",
    formats: "PNG or JPEG",
    sizeTarget: "≤ 300 KB",
    suggestedContent: "Brand card: wordmark + tagline on ivory with DISC spectrum accent",
    replacementPath: "public/brand/og-image.png (wired in app/layout metadata)",
    status: "placeholder",
  },
];

export function getMediaEntry(id: string): MediaEntry | undefined {
  return mediaRegistry.find((entry) => entry.id === id);
}
