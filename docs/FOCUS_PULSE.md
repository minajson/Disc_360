# Focus & Digital Dopamine Pulse

A second, first-class assessment product alongside DISC — not a
presentation-only feature. It has its own database tables, server-side scoring,
stored results, an individual result page, a combined DISC + Focus flow, team
mode, and team summaries.

**Non-clinical by contract.** Nothing measures or names dopamine, addiction, or
any diagnosis — in copy, column names, or values. The language is attention
pattern, stimulation habit, distraction loop, mental load, focus recovery.
Enforced by `data/focus-content.test.ts`.

## The assessment

Six questions, one per screen, target under 90 seconds, autosave + resume
(`components/focus/FocusRunner.tsx`). Five single-select plus one 1–10 scale.
Content: `data/focus-questions.ts` (Postgres is the runtime source; seeded by
migration `00014`).

## Scoring (`lib/scoring/focus.ts`, pure + tested)

Four non-clinical 0–100 dimensions: **Automaticity**, **Distraction
susceptibility**, **Mental load**, **Recovery readiness**. Plus derived
descriptors — primary distraction loop, notification response pattern, energy
decline pattern, preferred focus reset — and one of six pattern labels:
Intentional Focuser · Responsive Multitasker · Socially Stimulated Worker ·
Deadline Activator · Quiet Deep Worker · Overloaded Switcher. Scoring runs
server-side (`lib/actions/focus.ts`) and is stored in `focus_results`.

## Combined (`/combined`)

Runs the **full** DISC assessment then the **full** Focus Pulse — never DISC
only. A `combined_sessions` row links the two; the controller
(`app/(present)/combined/assessment`) advances DISC → Focus → result, and the
DISC/Focus submit actions return to it when their session is part of a combined
session. The result (`lib/insights/combined.ts`) shows both profiles plus
behaviour × attention interactions, strengths, blind spots, and recommendations
— all phrased as possibilities.

## Routes

```
/focus  /combined  /disc                    public product pages (cards on / and dashboard)
/focus/assessment[/:sessionId]              runner (auth-gated; launcher redirects)
/focus/results/:resultId[/present]          result + presentation mode
/combined/assessment                        DISC → Focus controller
/combined/results/:combinedId[/present]     combined result + presentation mode
/app/teams/:teamId/focus                    Focus team summary
/app/teams/:teamId/combined                 Combined team summary
/app/teams/:teamId/present/{focus,combined} team summary presentation mode
```

## Team mode

The team wizard (`components/teams/TeamWizard.tsx`, step 1) chooses **DISC
only / Focus Pulse only / Combined**. The choice is stored on
`teams.assessment_type` and controls the join flow: `joinAndStart`
(`lib/actions/join.ts`) starts the matching assessment for a participant, and
the team dashboard's summary link routes to the right summary. Team summaries
(`lib/insights/focus-team.ts`, `lib/insights/combined-team.ts`) are aggregate
only — no individual answers; names appear only when `results_named` allows.

### Focus team summary shows
participant count · completion rate · average mental load · automatic-checking
distribution · top distraction loop · notification-response distribution ·
energy-crash timeline · focus-recovery preferences · recommended team
agreements · facilitator discussion prompts.

### Combined team summary shows
DISC distribution · Focus distribution · behaviour × distraction patterns ·
team strengths · vulnerabilities · recommended agreements (with the full Focus
detail available inline).

## Database (migration `00014_focus_pulse.sql`)

`focus_versions`, `focus_questions`, `focus_options`, `focus_sessions`,
`focus_responses`, `focus_results`, `combined_sessions`, plus
`teams.assessment_type` / `team_creation_drafts.assessment_type`. RLS: content
readable by any authenticated user; sessions/responses/results strictly
own-row (mirrors DISC). Generated types refreshed in `lib/db/types.ts`.

## Tests

- Unit: `lib/scoring/focus.test.ts` (15 — dimensions, patterns, determinism,
  validation), `data/focus-content.test.ts` (5 — structure + non-clinical
  language).
- Playwright: `e2e/focus.spec.ts` (6) — homepage cards, independent
  complete+store+presentation, autosave, Focus/Combined team creation, QR join
  opening the correct assessment + team summary update, and Combined running
  DISC then Focus with both in the result.

## Known limitations

- The Focus team dashboard's roster/status table (`getTeamRoster`) is still
  DISC-oriented; the dedicated Focus/Combined **summary** pages show the real
  Focus completion. Extending the roster to report Focus completion inline is a
  follow-up.
- Focus/Combined don't have a campaign state machine yet (DISC's campaigns are
  separate); team completion is tracked by presence of a result per member.
