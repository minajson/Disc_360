# Disc360 — Personality Intelligence Platform

> Decode how people lead, communicate, decide, and respond under pressure.

Disc360 is a premium fullstack DISC assessment platform built with Next.js App Router. Individuals take a 24-question forced-choice assessment (~7 minutes) and receive an executive-grade behavioral profile; coaches, HR leaders, and teams get a quadrant map of their whole roster with composition and coverage insights.

The four dimensions, as they appear everywhere in the product:

| Code | Label |
|------|-------------|
| D | **Dominant** |
| I | **Influence** |
| S | **Stable** |
| C | **Analytical** |

## Features

- **Cinematic landing page** — "Cognitive Atlas" design system: midnight surfaces, glassmorphism panels, luminous accents, animated DISC orbit
- **Forced-choice assessment** — pick MOST and LEAST like you per scenario, with autosave, resume-on-refresh, and smooth question transitions
- **Deterministic scoring engine** — raw tallies → net → normalized 0–100 → one of 13 archetypes, fully unit-tested
- **Full archetype report** — radar and intensity charts, strengths, blind spots, communication do/don'ts, leadership style, stress response, ideal environment, complementary types
- **Dashboard** — latest profile, per-dimension trend sparklines, assessment history
- **Team intelligence** — members plotted across DISC quadrants, primary-style distribution, rule-based coverage insights

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind CSS v4 (CSS-first tokens) · Framer Motion · Zod · custom SVG charts (no chart library) · Prisma-shaped JSON-file mock DB (swap point for a real database) · Node native test runner

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Other commands:

```bash
npm test           # scoring unit tests (Node runs TypeScript natively)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # production build
```

Local data persists to the git-ignored `.mockdb/db.json`, so sessions and results survive dev-server restarts. Delete the folder to reset.

## Architecture

```
app/          routes + API handlers (assessment, results, history, team)
components/   landing, assessment, results, dashboard, team, charts, ui, layout, motion
lib/          scoring pipeline, insights, mock DB, auth stub, types, schemas
data/         question bank, archetype insight maps, demo team
```

Design and engineering conventions live in [CLAUDE.md](./CLAUDE.md) — including the scoring contract, design tokens, and the motion-ready component swap points reserved for future 3D enhancements.
