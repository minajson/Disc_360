# Facilitator presentations

Every assessment product includes an **optional** responsive introduction deck
that a facilitator can present before the assessment begins. The presentation
is never required, and it never starts the assessment automatically — the
facilitator decides when.

## Products and decks

| Product | Intro deck | Slides |
|---|---|---|
| DISC Behaviour Assessment | `data/presentations/disc-introduction.ts` | 10 |
| Focus & Digital Dopamine Pulse | `data/presentations/focus-introduction.ts` | 10 |
| Combined DISC + Focus | `data/presentations/combined-introduction.ts` | 12 |

Decks are **data, not JSX** — edit the files above to change copy without
touching the player. Each slide is a typed `PresentationSlide`
(`lib/presentations/types.ts`): a `visualType` chooses the renderer, and
optional structured fields carry the content it draws.

## Architecture

```
lib/presentations/types.ts       typed slide/deck model
lib/presentations/motion.ts      reusable motion presets (reduced-motion aware)
lib/presentations/registry.ts    products → decks + start-screen choices
data/presentations/*.ts          the three decks (authoritative content)
components/presentations/
  SlideVisual.tsx                one renderer per visualType
  PresentationPlayer.tsx         chrome: controls, notes, QR, presenter console
  ProductStartScreen.tsx         presentation-vs-assessment choice
```

### Motion presets

`fadeUp`, `softScale`, `lineDraw`, `chartReveal`, `maskReveal`, `crossfade`,
plus `staggerContainer` and `slideTransition`. Durations follow the house
scale (standard 350–600ms, section 600–900ms, ambient very slow). Under
`prefers-reduced-motion` every preset collapses to an instant fade with no
travel, scale or path-draw — content is always immediately readable. This is
enforced by `lib/presentations/motion.test.ts`.

### Visual types

`hero` · `spectrum` · `fourDimensions` · `timeline` · `comparison` · `chart` ·
`quote` · `instructions` · `closing`. The `comparison` visual renders three
shapes — labelled columns, strength→shadow pairs, or a flat point list.

## Routes

Standalone (public — a facilitator or individual can view without signing in;
the assessment CTA self-guards):

```
/present                              hub — the three products
/present/[product]                    start screen (presentation vs assessment)
/present/disc/introduction            DISC deck
/present/focus/introduction           Focus deck
/present/combined/introduction        Combined deck   (?deck= presents one lens)
```

Team session (team admin only):

```
/app/teams/[teamId]/presentation/introduction   intro deck + join QR
/app/teams/[teamId]/presentation                 live results deck (existing)
/app/teams/[teamId]/presentation/introduction?deck=focus   present a chosen lens
```

## Controls

Previous / next (buttons, `←`/`→`, `PageUp`/`PageDown`, space) · restart ·
progress dots (click to jump) · slide counter · fullscreen (`F`) · exit
(`Esc`) · touch swipe · show/hide facilitator notes (`N`) · show/hide join QR
(`Q`, team sessions) · jump to assessment · and on the final slide, **Start
assessment** plus (team) **Return to facilitator dashboard**.

### Facilitator notes / presenter console

Notes are **off by default** so a shared screen never leaks them. Toggle them
on your own device to reveal a dark panel showing, per slide: the speaking
prompt, one audience question, the estimated time, a **next-slide preview**,
and the **total deck time**. This is the single-screen presenter console; hide
it before sharing or projecting.

## How a facilitator runs a session

**Individual / self-service**
1. Open the product — e.g. `/present/disc`.
2. Choose **Start with presentation** (or **Go straight to assessment**).
3. Present the deck; on the last slide press **Start DISC assessment**.

**Team session**
1. From the team dashboard, click **Present introduction**.
2. Present the deck full-screen (`F`). Turn notes on only on your laptop.
3. When ready, press **Show QR** (or `Q`) so participants scan and join — they
   never start automatically; you control the timing.
4. On the last slide, **Open live dashboard** to watch completion come in, or
   **Return to facilitator dashboard**.
5. Later, **Present results** opens the live results deck.

## Known limitations

- **Focus Pulse and Combined scoring are not yet built.** Only the DISC
  assessment is a live scored instrument. The Focus and Combined presentations
  are complete, but their "Start assessment" currently opens the available DISC
  assessment (Combined legitimately begins with DISC). The registry's
  `assessmentLive` flag drives the honest on-screen note; wiring a real Focus
  instrument is a one-line change in `lib/presentations/registry.ts` once it
  exists.
- **Team assessment-type selection** (choosing which product a team runs) is
  not modelled on the team yet; team intros default to DISC and accept a
  `?deck=` override. Adding an assessment-type column to teams is future work.
- **Dual-window presenter mode** (a separate audience window) is not
  implemented; the hideable single-screen presenter console is the first-
  release equivalent, per the brief.
