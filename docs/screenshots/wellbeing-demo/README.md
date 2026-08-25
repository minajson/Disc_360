# Wellbeing Pulse — management-review screenshot matrix

Status: **4 of 22 captured.** This matrix is **incomplete**. The four images in
this directory are safe to circulate; the remaining eighteen have not been
taken yet and must be captured before the management presentation.

## How to capture

The demo surfaces are gated by `requireManagementDemo()` — non-production
**and** `WELLBEING_DEMO_MODE=true` **and** platform-admin or a wellbeing role.
A production build closes them, so capture against the dev server:

```bash
npx supabase start
npx supabase db reset
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -f scripts/seed-wellbeing-demo.sql        # synthetic aggregate data only
WELLBEING_DEMO_MODE=true npm run dev
```

Sign in as a platform admin. Capture at **1440×900** unless the row says
otherwise, and name files `NN-slug-WIDTH.png` to match the existing four.

## Safety rules for every capture

- Synthetic/demo data only — never a hosted database, never a real participant.
- No participant name, email, address or id may appear in an analytics frame.
  (Names are expected on the campaign roster, and are seed fixtures there.)
- Every restricted-instrument preview must show its
  `STRUCTURE PREVIEW — NOT AN ACTIVE QUESTIONNAIRE` badge, and every synthetic
  figure its `ILLUSTRATIVE DEMO DATA` badge. If a badge is missing from the
  frame, recapture rather than crop.

## The matrix

| # | Surface | Route | Status |
|---|---|---|---|
| 01 | Campaign instrument picker, none selected | `/wellbeing/admin/campaigns/[teamId]` | ✅ captured |
| 02 | Campaign picker, instrument selected pre-launch | `/wellbeing/admin/campaigns/[teamId]` | ☐ |
| 03 | Campaign picker **locked** after first attempt | `/wellbeing/admin/campaigns/[teamId]` | ☐ |
| 04 | Instrument comparison table | `/wellbeing/admin/instruments` | ☐ |
| 05 | GHQ-28 structure preview + result preview | `/wellbeing/admin/demo/ghq28` | ✅ captured |
| 06 | GHQ-12 structure preview + result preview | `/wellbeing/admin/demo/ghq12` | ☐ |
| 07 | WHO-5 structure preview + result preview | `/wellbeing/admin/demo/who5` | ☐ |
| 08 | DISC360 Wellbeing V1 preview (runnable) | `/wellbeing/admin/demo/disc360_wellbeing_v1` | ☐ |
| 09 | Participant home — consent gate | `/wellbeing` | ☐ |
| 10 | Participant context form (Department / Office) | `/wellbeing` | ☐ |
| 11 | Live questionnaire item, DISC360 V1 | `/wellbeing/assessment/[sessionId]` | ☐ |
| 12 | Participant result — index + dimension profile | `/wellbeing/result/[resultId]` | ☐ |
| 13 | Participant history — trend across four waves | `/wellbeing/history` | ☐ |
| 14 | Analytics — Overview | `/wellbeing/analytics` | ☐ |
| 15 | Analytics — Compare, with suppressed cohorts | `/wellbeing/analytics?tab=compare` | ✅ captured |
| 16 | Analytics — Trends | `/wellbeing/analytics?tab=trends` | ☐ |
| 17 | Analytics — Signals | `/wellbeing/analytics?tab=signals` | ☐ |
| 18 | Analytics — Teams | `/wellbeing/analytics?tab=teams` | ☐ |
| 19 | Analytics — Locations | `/wellbeing/analytics?tab=locations` | ☐ |
| 20 | Management demo home | `/wellbeing/admin/demo` | ✅ captured |
| 21 | Participant report PDF, first page | `/wellbeing/result/[resultId]` → export | ☐ |
| 22 | Participant surfaces at 390px (mobile) | `/wellbeing` | ☐ |

## Notes on the captured four

- **01** shows the seed roster (Amara Okafor, Dana Whitfield, Keiko Tanaka,
  Lena Fischer, Nia Thompson) — all committed fixtures in `supabase/seed.sql`,
  not real people. Completion state only; no scores are shown on that surface.
- **15** demonstrates the confidentiality engine: Legal (4 people) falls below
  the floor of 7 and is withheld, and Security is withheld alongside it so the
  hidden group cannot be recovered by subtraction.
- **05** is the strongest licensing evidence: every item reads
  `[Question content available after licensing]`.
