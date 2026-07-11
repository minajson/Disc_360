@AGENTS.md

# Disc360 — "Cognitive Atlas"

Premium DISC personality intelligence platform for individuals, teams, coaches, HR leaders, and organizations. Fullstack Next.js 16 App Router, strict TypeScript, Tailwind CSS v4, Framer Motion, Zod, custom SVG charts, Prisma-shaped JSON-file mock DB.

## Commands

```bash
npm run dev          # dev server (Turbopack)
npm run build        # production build — must pass before every phase commit
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # node --test lib/scoring/*.test.ts  (Node 25 runs TS natively)
```

## DISC naming (mandatory)

User-facing labels are **always**:

| Code | UI label |
|------|----------|
| D | **Dominant** |
| I | **Influence** |
| S | **Stable** |
| C | **Analytical** |

Never use "Dominance", "Steadiness", or "Conscientiousness" anywhere in the interface, insight copy, chart labels, or metadata. Internal type code stays `'D' | 'I' | 'S' | 'C'`.

**Display codes:** every user-facing single letter and archetype code renders Analytical as **A** — use `dimensionMeta[dim].displayCode` for letters and `displayArchetypeCode()` (`lib/utils/display.ts`) for archetype codes (DC → DA, CS → AS, C → A). Internal keys, ids, and stored data always keep `C`.

## Directory structure

```
app/                      # routes only — no business logic in pages
  page.tsx                # landing
  assessment/             # intro page + [sessionId] runner
  results/[resultId]/     # report page
  dashboard/              # overview + history/
  team/                   # team intelligence view
  api/                    # assessment | results | history | team route handlers
components/
  landing/ assessment/ results/ dashboard/ team/   # feature components
  charts/                 # custom SVG charts (no chart library)
  ui/                     # design-system primitives
  layout/                 # header, footer, shells
  motion/                 # Framer Motion wrappers — the 3D swap layer
lib/
  assessment/             # Zod schemas, question helpers
  scoring/                # pure scoring pipeline + *.test.ts
  insights/               # insight lookup helpers
  mock-db/                # Prisma-shaped JSON store (swap point for real DB)
  auth/                   # getCurrentUser() stub, NextAuth-shaped config
  types/                  # shared domain model
  utils/                  # cn(), formatters
data/
  disc-questions.ts       # 24 groups × 4 adjectives (one per dimension)
  insight-maps.ts         # 13 archetype insight entries + dimensionMeta
  team-demo-data.ts       # seeded demo team
```

## Type conventions

- `strict`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch` are on — no `any`, no non-null assertions to silence the compiler.
- Domain types live in `lib/types/index.ts` only; never redeclare them locally.
- IDs are prefixed strings: `usr_`, `ses_`, `ans_`, `res_`, `tem_`, `tmm_` (see `lib/mock-db/ids.ts`).
- Dates are ISO-8601 strings (Prisma-compatible serialization), never `Date` objects across API boundaries.
- API payloads are validated with Zod schemas from `lib/assessment/schemas.ts` — shared by client and server. Error envelope everywhere: `{ error: { code, message, issues? } }`.

## Naming rules

- Components: PascalCase file + named export (`HeroSection.tsx` exports `HeroSection`).
- lib/data files: kebab-case (`compute-result.ts`, `disc-questions.ts`).
- Client Components get `"use client"` only when they need interactivity — Server Components are the default everywhere.
- Route params in Next 16 are async: `const { sessionId } = await params`.
- Pages that read the mock DB declare `export const dynamic = "force-dynamic"` (mock DB is request-time data; never let the build prerender stale reads).

## DISC scoring rules (do not change without updating tests)

- 24 forced-choice groups; each group has exactly 4 adjectives, one per dimension. Per question the user picks one MOST and one LEAST; they can never be the same option.
- Raw: +1 `most[dim]`, +1 `least[dim]` per answer. Net = most − least (−24…+24). Normalized = `round(((net + 24) / 48) * 100)`, clamped 0–100.
- Archetype derivation (deterministic; dimension sort tie-break is **D → I → S → C**):
  1. **Balanced** if `max − min ≤ 12` → `BAL`.
  2. **Pure** if `top1 − top2 ≥ 15` → `D | I | S | C`.
  3. **Pair** otherwise: primary+secondary code. Valid pairs are adjacent combos only: `DI ID IS SI SC CS CD DC`.
  4. **Diagonal rule**: D↔S and I↔C are opposites, never a pair. If secondary is the primary's opposite, substitute the third-ranked dimension when `top2 − top3 ≤ 8`; otherwise fall back to the pure primary.
- 13 archetypes total: `D DI ID I IS SI S SC CS C CD DC BAL`.
- Intensity bands: 0–35 LOW, 36–55 MODERATE, 56–75 HIGH, 76–100 VERY_HIGH.
- Scoring functions in `lib/scoring/` are pure — no I/O, no Date.now(), no randomness. `computeResult()` is the only entry point the API layer calls.

## State management rules

- Server state lives in `lib/mock-db` — a `globalThis` singleton with Prisma-mimicking API (`db.result.create({ data })`, `.findUnique({ where })`, …) writing through to git-ignored `.mockdb/db.json`. Swapping to real Prisma later must only touch `lib/mock-db`.
- Assessment flow state lives in `AssessmentController`'s `useReducer` — optimistic UI, PATCH autosave per answer, resume from server session on mount.
- No global client store (no Redux/Zustand/Context-as-store). Server Components fetch via `lib/` directly — pages never `fetch()` their own API routes.
- API routes exist for the client-side assessment flow and future backend parity only.

## Design system — "Cognitive Atlas"

All tokens live in `app/globals.css` under Tailwind v4 `@theme` — no `tailwind.config.ts`. Dark-only in v1.

- Surfaces: midnight `#07090F` (page) / `#0D1117` (canvas) → graphite `#151A23` (panel) / `#1C2330` (raised). Hairline borders `rgba(255,255,255,0.08)`. Ink `#F4F6FB` / `#A8B0C0` / `#6B7485`.
- DISC series colors (CVD-validated on `#0D1117`, used for chart marks): D `#E8564A`, I `#C98500`, S `#199E70`, C `#3987E5`. Bright glow variants exist for gradients/luminous edges only — **never** as chart marks.
- Signature accent: ion teal `#4FE3C1` → ultraviolet `#8B7CFF`, 135° gradient, CTAs and focus rings only. Not the clichéd blue→purple.
- Fonts (`next/font/google`): Space Grotesk (display/headlines/stats), Inter (body/UI), IBM Plex Mono (scores, codes, axis labels).
- Glass panels via the `glass-panel` utility: white 6%→2% gradient, `backdrop-blur(20px) saturate(140%)`, hairline border, inset top highlight, layered depth shadow.
- Motion: 200ms micro-interactions, 450ms section reveals, easing `cubic-bezier(0.22, 1, 0.36, 1)`. Every `components/motion/` wrapper must respect `prefers-reduced-motion`.
- Chart text always wears ink tokens, never series colors. Direct labels over legends when ≤4 series.

## Future 3D / motion enhancement rules

Components marked motion-ready (`CognitiveOrbit`, `TraitConstellation`, `DimensionalHero`, `DimensionalLayer`, `MotionShell`, `ResultGlyph`, `DiscRadarChart`, `ResultPreviewPanel`, `QuestionTransition`, `CompletionInterstitial`, `TeamQuadrantMap`) are **swap points**: their prop contracts are stable and their internals may later be replaced with Fable-generated 3D/WebGL scenes. Never leak their internals to call sites; never add props that assume a specific rendering technology. New cinematic surfaces go in `components/motion/` behind the same pattern.

## What NOT to do

- No placeholder shortcuts: no lorem ipsum, no `TODO: add copy`, no stub pages, no fake buttons that go nowhere. Every shipped surface is finished.
- No generic SaaS/AI-template UI: no flat white cards on gray, no basic blue-purple gradients, no emoji-driven UI, no childish quiz styling.
- No chart libraries — charts are hand-built SVG in `components/charts/`.
- No `console.log` left in committed code; no `any`; no suppressed lint rules without a comment explaining why.
- No new client-side state libraries or CSS frameworks.
- Don't put business logic in `app/` routes — pages compose, `lib/` computes.
- Don't hardcode DISC copy in components — all archetype/dimension content comes from `data/insight-maps.ts` (per archetype: summary, strengths, blind spots, communication style + guide, leadership, conflict response, stress response, motivators/drainers, ideal environment, coaching, complementary types). Team-level narratives (culture summary, communication gaps, risk zones, actions) are rule-generated in `lib/insights/team.ts`.
- The results page must stay print-ready: `@media print` overrides live in `globals.css`; chrome that shouldn't print gets `print:hidden`.
