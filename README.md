# DISC360 — Personality Intelligence Platform

> Understand how people lead, communicate and respond when it matters.

A production-grade, full-stack DISC platform: a premium light editorial
public site, Supabase auth + Postgres with row-level security, a calm
two-stage assessment, individual reports, organizations/teams/campaigns,
a team intelligence dashboard, and a conference-room presentation mode.

DISC labels used throughout: **Dominant · Influence · Stable · Analytical**
(the Analytical letter displays as **A**; internal keys keep `C`).

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS v4 · Supabase
(Postgres, Auth, RLS) · Framer Motion + GSAP ScrollTrigger · Zod · Resend +
react-email · custom SVG charts · Node test runner + Playwright.

## Local development

Prereqs: Node ≥ 20, Docker running.

```bash
npm install
npx supabase start        # local Postgres + Auth (first run downloads images)
npx supabase db reset     # apply migrations + seed
cp .env.example .env.local  # fill values printed by `supabase start`
npm run dev               # http://localhost:3000
```

Seeded logins (password `disc360-demo`) — one clean account per navigation
experience, so all four are demonstrable without one affecting another:

| Account | Experience |
|---|---|
| `solo@disc360.dev` | **Individual** — result history + in-progress session |
| `demo@disc360.dev` | **Facilitator** — org + team admin, 3 teams, campaigns, invitations |
| `coach@disc360.dev` | **Coach** — coach profile + one client engagement |
| `admin@disc360.dev` | **Super admin** — platform administration |

A coach profile outranks `team_admin` in `resolveExperience()`, so `demo@`
deliberately has no coach profile — giving it one hides the facilitator nav.

Local email: Supabase's mailbox UI at http://127.0.0.1:54324 captures auth
emails; product emails are logged to `notification_logs` unless
`RESEND_API_KEY` is set (and in non-production they only ever deliver to dev
domains).

## Commands

```bash
npm run dev / build / start
npm run lint / typecheck
npm test              # unit tests: scoring, campaign state, CSV import
npm run test:e2e      # Playwright smoke (needs supabase start + npm run build)
npx supabase db reset # rebuild the local database
```

## Architecture

```
app/(marketing)   12 public pages (Meridian editorial design)
app/(auth) + auth/callback + onboarding + join/[token]
app/app/(shell)   dashboard · assessments · results · history · reports ·
                  invitations · settings · teams/[teamId]/(overview|results|
                  members|campaigns|settings)
app/app/(present) teams/[teamId]/presentation (full-screen deck)
lib/              scoring (pure, tested) · actions (server actions, Zod) ·
                  db (supabase clients + generated types) · auth/guards ·
                  insights (team intelligence + anonymization) · email ·
                  campaigns (state machine) · motion
supabase/         config, 6 migrations (schema, RLS, question bank, grants,
                  invitation policies), seed
emails/           react-email templates    e2e/  Playwright smoke suite
```

Security model: RLS on every table; assessment responses and results are
own-row only — cross-member team reporting happens exclusively in
`lib/insights/team.ts` behind explicit authorization with anonymization
applied server-side. Server actions never trust client-sent ids.

## Production deployment

1. **Supabase**: create a project → `npx supabase link --project-ref <ref>`
   → `npx supabase db push` (applies migrations; do *not* run the dev seed).
   Enable Google/Azure providers in Auth settings with your OAuth credentials.
   Set the Site URL to your domain and add `/auth/callback` to redirect URLs.
2. **Vercel (or any Node host)**: set env vars from `.env.example` —
   `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only),
   `RESEND_API_KEY`, `EMAIL_FROM`. Build command `npm run build`.
3. **Resend**: verify your sending domain; production sends are gated by
   per-user notification preferences automatically.
4. Smoke-check `/`, sign-up → onboarding → assessment → report, and a team
   presentation at 1920×1080 before inviting real users.

## Responsible use

DISC360 supports self-awareness and team development. It is not a medical,
clinical or employment-selection instrument — the terms of service bind
customers to the same boundary.
