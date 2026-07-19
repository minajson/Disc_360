# DISC360 — Production UI / UX / Accessibility / Visual / Behavioural Audit

Production-candidate audit across the entire platform: marketing, auth,
dashboards, all three assessment products, reports, presentations and admin.
Grounded in code inspection, the unit/e2e suites, and screenshot passes at
320 → 3440 px. Items marked **✅ fixed** were corrected in this pass (branch
`feat/visual-systems`); everything else is ranked in §10.

---

## 1 · Production UX audit (global journeys)

**Sound.** The four role experiences (individual / facilitator / coach /
super-admin) resolve server-side (`lib/navigation/app-nav.ts`) and every nav
href is proven against the filesystem by a unit test, so dead links cannot
ship. Join flow is QR-first with team-code fallback; assessments autosave per
answer and resume via `current_index`; the paywall is enforced in both team
creation paths.

Findings:
- **Floating "N" button** — that is Next.js's dev-tools indicator. It exists
  only under `npm run dev` and has never shipped in a production build; demos
  run against the dev server made it look like a product bug. **✅ fixed** —
  `devIndicators: false` in `next.config.ts`; it now never appears anywhere.
- Sign-in error surfacing, OAuth callback codes, and safe `?next=` redirects
  were verified in the earlier auth audit — no regressions found.
- `removeMember`'s last-admin guard still returns silently (button appears to
  do nothing). Ranked in §10.

## 2 · Visual design consistency audit

The Meridian system is applied consistently: tokens only in `app/globals.css`
`@theme`, Fraunces/Inter/Plex Mono, paper cards, hairlines, organic masks.
DISC colours stay confined to data/badges — no brand-chrome bleed found.

Findings:
- The straight-line visual language (radar polygons, straight connectors) has
  been replaced by the curved instrument family — Behaviour Compass, Focus
  Lens, Behaviour–Focus Fusion, Attention Ripple Map, Focus Cycle, Recovery
  Curve — all built on one geometry library (`lib/visuals/geometry.ts`,
  unit-tested polar/arc/blend/Catmull-Rom math). **✅ shipped for the three
  hero visuals + three deck visuals**; remaining family members ranked in §10.
- Slide typography previously scaled with the *viewport*, so an ultrawide
  letterboxed slide could oversize its text. **✅ fixed** — all slide type now
  reads `--pres-*` container-query variables resolved against the 16:9 canvas.

## 3 · Accessibility audit

Verified present: `lang="en"`; a global `:focus-visible` outline token; labels
on every form field; `aria-live` autosave/status regions in both assessment
runners and the deck player; every SVG visual carries `role="img"` plus a
data-bearing `aria-label` (scores and primary style readable by screen
readers); `useReducedMotion`/`prefers-reduced-motion` honoured in 21 files —
every animated component renders a complete static layout without JS motion.

Findings:
- **Password fields had no show/hide control.** **✅ fixed** — `PasswordField`
  (components/auth/fields.tsx): a real button inside the field, 44 px touch
  target, keyboard reachable, `aria-pressed` + state-specific label
  ("Show password"/"Hide password"), eye/eye-off icons. Only the input `type`
  flips — id/name/autocomplete untouched, so password managers are unaffected.
  Applied to sign-in, sign-up and both reset-password fields.
- **No skip-to-content link** in `app/layout.tsx` — keyboard users tab through
  the full nav on every page. Ranked in §10 (small, worthwhile).
- Presentation chrome buttons are 44 px (`size-11`); fullscreen chrome
  auto-hides but any key/pointer/touch restores it, so it never traps.

## 4 · Behavioural / interaction audit

- States: pending buttons disable and relabel ("Signing in…"); assessment
  interactions are immediate (no motion library in the answer path);
  micro-interactions ≤ 250 ms; section reveals ≤ 700 ms.
- Deck player: arrows/space/Escape/N/F/Q keyboard map, swipe on touch, exit
  always visible outside fullscreen, notes hidden by default so a shared
  screen never leaks facilitator prompts.
- Known gaps: silent last-admin guard (§1); `rotateInviteLink` revalidates
  only `/dashboard` so the settings-page QR can go stale until reload. §10.

## 5 · DISC product audit — including the calculation engine

**The engine is correct, deterministic and fully tested** (178 unit tests
green, scoring suite included). How a profile is produced:

1. **Raw tallies.** Each of the 24 scenarios adds one MOST pick and one LEAST
   pick to two different dimensions. Every scenario counts equally — there is
   **no per-question weighting and no lookup table** anywhere in scoring.
2. **Net** = MOST − LEAST per dimension (−24…+24).
3. **Normalized 0–100** per dimension, midpoint 50. These are *intensities*,
   scaled independently — they deliberately do not sum to 100 (the report's
   distribution bars, which do sum to 100, are computed separately by
   largest-remainder rounding).
4. **Profile selection** (`lib/scoring/archetype.ts`):
   spread ≤ 12 → **Balanced**; top lead ≥ 15 → **pure letter**; otherwise the
   top two pair — **except behavioural opposites** (D↔S, I↔C), which never
   pair: the third-ranked dimension substitutes when within 8 points, else the
   profile falls back to pure. Exact ties order D → I → S → A.
5. **Why "SA" and never "SD":** S and D are opposites (steadiness vs
   challenge). When S leads and D is second, D is suppressed and Analytical —
   if within the 8-point window — becomes the secondary. That is the designed
   psychometric reading, not a bug; the report now *shows* this reasoning.

**Transparency gap (the real issue): none of this was visible to users.**
**✅ fixed** — the report now has a **"Why this profile"** section
(`components/report/ProfileExplanation.tsx`) that recomputes the explanation
from the participant's stored raw tallies: a MOST/LEAST/net/score table per
dimension (strongest first, primary/secondary tagged), a sentence stating the
*exact rule* that fired with the user's own numbers (balanced spread, pure
gap, blend, or opposite-substitution — the SA-not-SD case is spelled out with
both scores), the published method, and an honesty note: equal weighting, no
lookup tables, and **no confidence metric is computed** — the report says so
rather than implying false precision.

Hero visual: **✅ Behaviour Compass** replaces the radar chart (see §7 for the
rendering fix).

## 6 · Focus Pulse product audit

Real product end-to-end: DB-backed sessions/answers/results, pure tested
scorer, individual + team modes, combined DISC×Focus view. Copy is
non-clinical by contract — a unit test rejects addiction/diagnosis language
and any claim of measuring dopamine.

- **✅ Focus Lens** hero on results; **✅ Attention Ripple Map** (slide 2),
  **✅ Focus Cycle** (autopilot loop, slide 3) and **✅ Recovery Curve**
  (interruption cost, slide 5) now render the focus deck's story as
  instruments instead of word lists/straight timelines.
- Remaining: Dopamine Pulse + Focus Reservoir result visuals (§10).

## 7 · Visual-system audit — the three hero instruments

- **Behaviour Compass rendering bug (reported): confirmed and ✅ fixed.** The
  hub stacked two free-floating text elements (44 px primary letter, then
  "BALANCED"/secondary beneath), so browser baseline metrics could collide
  them, and the composition looked off-centre. Redesigned: the hub carries
  exactly **one** baseline-positioned glyph; the secondary ("+ A") or
  BALANCED state is a **rect-backed pill badge** with explicit geometry —
  overlap is now geometrically impossible on any renderer. Ring radii were
  made concentric-consistent, and a `concept` variant (equal bands, no
  needle, 2×2 letter mark) serves the deck's instructional slides.
- Focus Lens and Behaviour–Focus Fusion verified at 320/390/768/1280/1920/
  3440 px with zero console errors (`e2e/visualisations.spec.ts`).

## 8 · Report experience audit

Strong: archetype narrative from `data/insight-maps.ts`, balance charts,
distribution bars, share tokens, print stylesheet for PDF export, and the new
compass hero + "Why this profile" section. Team reports respect
`results_named` with server-side anonymization. Remaining polish (§10):
result-page derived visuals (orbit/communication flow), and the combined
team-summary field.

## 9 · Presentation system audit

**✅ Rebuilt this pass** on a strict 16:9 letterboxed canvas
(`.pres-stage`/`.pres-canvas`, CSS container queries): slides scale by canvas
size, never clip, and portrait phones get a scrollable column with
viewport-based type. Fullscreen: chrome auto-hides after 3 s idle, safe-area
insets respected, any input restores it. QR overlay redesigned as a proper
dialog — "Scan to begin", 512-module QR in a white quiet zone sized
`min(74vw, 52dvh)` (scannable from the back of a room), team name, code
fallback, and a local-URL warning that names the fix. Curved timeline replaces
the straight three-dot row; compass/ripple/cycle/recovery-curve slides carry
the same instrument language as the reports.

## 10 · Prioritised improvement list (remaining)

| # | Impact | Item |
|---|--------|------|
| 1 | High | Second-device QR test on a physical phone (needs public URL) — the one step that cannot be verified from this machine |
| 2 | Medium | Remaining instrument family: BehaviourOrbit, BehaviourSpectrum, CommunicationFlow (DISC results); DopaminePulse, FocusReservoir (Focus results); WorkingRhythm, PressureField, DevelopmentPathway, TeamInteractionField (Combined) |
| 3 | Medium | Silent last-admin guard in `removeMember` — return a visible error |
| 4 | Medium | `team_code` entropy + rate limiting on join attempts |
| 5 | Small | Skip-to-content link in `app/layout.tsx` |
| 6 | Small | `rotateInviteLink` revalidate the settings path too |
| 7 | Small | Wire or remove the orphaned `revokeInvitation` action |
| 8 | Small | Landing-page media system (`public/images` + `lib/content/media.ts`) |

---

*Gate for this pass: `lint` · `tsc --noEmit` · 178/178 unit tests ·
presentation/visualisation/smoke Playwright suites against the local stack ·
screenshot verification at phone/laptop/ultrawide.*
