@AGENTS.md

# DISC360 — Personality Intelligence Platform (v2 "Meridian")

Production full-stack platform: premium **light editorial** interface, Supabase
auth + Postgres + RLS, organizations/teams/campaigns, two-stage DISC
assessment, individual reports, team intelligence, and presentation mode.

## Commands

```bash
npm run dev            # dev server (Turbopack)
npm run build          # production build — must pass before every phase commit
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm test               # node --test lib/scoring/*.test.ts (Node runs TS natively)
npx supabase start     # local Postgres + Auth + email capture (requires Docker)
npx supabase db reset  # re-apply migrations + seed
```

## DISC naming (mandatory)

| Code | UI label | Displayed letter |
|------|----------|------------------|
| D | **Dominant** | D |
| I | **Influence** | I |
| S | **Stable** | S |
| C | **Analytical** | **A** |

Never display "Dominance", "Steadiness" or "Conscientiousness". Internal
keys/ids always keep `C`; every user-facing letter or archetype code renders
via `dimensionMeta[dim].displayCode` / `displayArchetypeCode()`
(`lib/utils/display.ts`) — DC → DA, CS → AS. Never reveal D/I/S/C mappings
inside the assessment experience.

## Product architecture

```
app/(marketing)/   public site: /, how-it-works, individuals, teams, coaches,
                   organizations, about, pricing, resources, contact, privacy, terms
app/(auth)/        sign-in, sign-up, forgot-password, reset-password
app/auth/callback  OAuth/email confirmation handler
app/onboarding/    post-signup intent flows
app/join/          invitation link + team code acceptance
app/app/           authenticated product: dashboard, assessments, results,
                   history, reports, invitations, settings, teams/*
components/        marketing/ media/ ui/ charts/ motion/ (+ app/ feature dirs)
lib/               scoring/ (pure, tested) · assessment/ · actions/ (server actions)
                   db/ (supabase clients, queries) · auth/ (guards) · email/
                   motion/ · types/ · utils/
data/              disc-questions.ts · insight-maps.ts · dimension-meta.ts
supabase/          config.toml · migrations/ · seed.sql
```

- Server Components by default; client components only for interaction.
- **Mutations are Server Actions** in `lib/actions/*` — every one validates
  input with Zod and authorizes on the server. Route handlers only where the
  platform requires them (auth callback, exports).
- Pages compose; `lib/` computes. No business logic in `app/`.

## Database rules

- Supabase Postgres. Schema lives in `supabase/migrations/*.sql` — never edit
  applied migrations; add new ones.
- UUID PKs, `created_at`/`updated_at` (trigger-maintained), FKs, indexes on
  every FK and lookup path, `archived_at` for soft archival.
- Normalized DISC scores are **queryable columns** (`score_d/i/s/c`,
  `archetype_code`, `primary_dimension`) — JSONB only for supplementary
  report snapshots.
- Every table has RLS enabled with explicit policies. No table ships without
  policies. Individual `assessment_responses` are readable only by their owner
  — never by team admins or members.
- Generated types via `supabase gen types typescript` → `lib/db/types.ts`.

## Security rules

- Never trust client-sent role/org/team ids — resolve membership server-side
  via guards in `lib/auth/guards.ts` (`requireUser`, `requireTeamAdmin`, …).
- Secrets only in env; `SUPABASE_SERVICE_ROLE_KEY` is server-only and used
  exclusively where RLS bypass is explicitly justified in a comment.
- Invitations: random tokens (crypto), expiry, single-acceptance; rate-limit
  invitation/email sends.
- Sensitive admin actions write `audit_logs` rows.
- No diagnostic/medical/employment-selection claims anywhere in product copy.

## Roles

`individual` · `team_member` · `team_admin` · `coach` · `organization_admin` ·
`super_admin`. Roles are membership-scoped (org/team member rows), not global
flags — except `super_admin` on the profile. Team reports respect
`results_named` + member visibility; anonymized mode strips names in queries,
not in the client.

## Assessment state rules

- Sessions: `in_progress → completed | abandoned`; one active session per
  user per campaign context; `current_index` tracks resume position.
- Responses: unique per (session, question); MOST ≠ LEAST enforced in schema
  and Zod; autosaved per answer.
- Scoring: `lib/scoring/computeResult()` is the only entry point — pure,
  deterministic, tested. Thresholds: balanced spread ≤ 12, pure gap ≥ 15,
  diagonal window ≤ 8, tie-break D→I→S→C. Do not change without updating tests.
- Campaigns: `draft → scheduled → active → closed → archived` (reopen:
  closed → active).

## Design rules — "Meridian" light editorial

- Canvas ivory `#F7F4EE` / mineral `#FCFBF8` / paper `#FFFFFF`; ink `#17201D`;
  slate `#5F6965`; brand botanical `#174C3C`, teal `#4B8275`, sage `#BFD2C8`,
  sand `#E8DED0`. Tokens live in `app/globals.css` `@theme` only.
- DISC colors (D `#C24A2E`, I `#A97614`, S `#2F7A57`, C `#33648F` + `-soft`
  tints) are for **data, charts, badges and small identifiers only** — never
  brand chrome.
- Type: Fraunces (display serif) + Inter (UI) + IBM Plex Mono (data), fluid
  scale via `clamp()` tokens (`text-display`, `text-h1/h2/h3`, `text-lead`).
- Editorial idiom: generous whitespace, hairlines, numbered sections,
  `paper-card`, organic masks (`mask-organic`, `mask-arch`), single soft
  shadows. Dark surfaces only as small accents (`ink-band`, `botanical-band`).
- Forbidden: dark page backgrounds, neon, glassmorphism, gradient blobs,
  purple-blue AI styling, dense KPI grids, emoji UI.

## Motion-performance rules

- Framer Motion for component/route transitions; GSAP + ScrollTrigger only
  inside client components that dynamically `import("gsap")` (never in the
  assessment flow). CSS transforms for cheap depth.
- Every enhanced scene consults `lib/motion/preferences.ts`
  (`useMotionTier`): `reduced` renders static; `lite` (touch/small screens)
  gets cheap motion; `full` gets cursor/scroll enhancement.
- Base layouts must be complete and accessible without JS motion. No scroll
  hijacking; micro-interactions ≤ 250 ms; section reveals ≤ 700 ms; assessment
  interactions are immediate.
- Media: `components/media/` placeholders become real assets via `src`/`poster`
  props (specs in MEDIA_GUIDE.md). Scenes (`DiscSpectrumScene`,
  `AssessmentTransitionScene`, `TeamCultureMapScene`, `ResultsRevealScene`)
  are swap points for future rendered 3D — stable props, replaceable internals.

## Testing requirements

- Pure logic (scoring, normalization, blends, ties, validation, permissions,
  anonymization, campaign transitions) → `node --test` colocated `*.test.ts`
  with relative `.ts`-extension imports (the Node runner doesn't resolve `@/*`).
- Journeys (homepage, sign-up, assessment, team creation, invitation, team
  dashboard, presentation) → Playwright smoke tests against the local stack.
- Gate for every phase: `lint` · `typecheck` · `test` · `build` all green.

## What NOT to do

- No placeholder shortcuts: no lorem ipsum, TODO markers, stub pages or dead
  buttons. Media placeholders must look deliberate (use `components/media/`).
- No `any`, no unexplained lint suppressions, no `console.log` in committed
  code, no new client-state libraries, no chart libraries (charts are custom SVG).
- Don't hardcode DISC copy in components — archetype/dimension content comes
  from `data/insight-maps.ts` and `data/dimension-meta.ts`; team narratives are
  rule-generated in `lib/`.
- Don't fabricate credentials; keep `.env.example` authoritative.
