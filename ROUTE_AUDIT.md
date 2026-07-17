# DISC360 — Route audit

Every route the app serves, who reaches it, how they reach it, and whether it
leads anywhere. Generated during the v2.3 navigation rebuild.

**Roles:** `pub` public · `ind` individual · `fac` team facilitator / team admin ·
`coach` coach · `sa` super admin.

**Status:** ✅ working · 🔧 fixed in this pass · ⚠️ known gap · 🗑 removed.

A machine-enforced version of the "entry point exists" column lives in
`lib/navigation/app-nav.test.ts` — it walks the `app/` directory and fails the
build if any navigation item points at a route without a `page.tsx`.

---

## Marketing (public)

| Route | Role | Purpose | Entry point | Status | Issue | Resolution |
|---|---|---|---|---|---|---|
| `/` | pub | Home | Direct / logo | ✅ | — | — |
| `/how-it-works` | pub | Method explainer | Nav, 404 page | ✅ | — | — |
| `/individuals` | pub | Individual pitch | Nav | ✅ | — | — |
| `/teams` | pub | Team pitch | Nav | ✅ | — | — |
| `/coaches` | pub | Coach pitch | Nav | ✅ | — | — |
| `/organizations` | pub | Org pitch | Nav | ✅ | — | — |
| `/pricing` | pub | Plans + $8 team checkout | Nav, `?intent=create-team` redirect | ✅ | Checkout is simulated (`DevCheckoutProvider`) | Labelled in UI; see Known gaps |
| `/about` `/resources` `/contact` `/privacy` `/terms` | pub | Content | Nav / footer | ✅ | — | — |

## Auth & entry

| Route | Role | Purpose | Entry point | Status | Issue | Resolution |
|---|---|---|---|---|---|---|
| `/sign-in` | pub | Sign in | Nav, guard redirects | ✅ | `?next=` unvalidated (open redirect) | ⚠️ Known gap |
| `/sign-up` | pub | Register | Nav, pricing CTAs | ✅ | — | — |
| `/forgot-password` `/reset-password` | pub | Recovery | Sign-in link, email | ✅ | — | — |
| `/auth/callback` | pub | OAuth / email confirm | Provider redirect | ✅ | — | — |
| `/onboarding` | ind | Intent + profile | Post sign-up | 🔧 | **Team creation bypassed the $8 paywall entirely** | Entitlement gate + consume added to `completeTeamCreatorOnboarding` |
| `/join/[token]` | pub | Participant join (QR / link) | Team QR, join link, invite email | ✅ | — | — |
| `/r/[token]` | pub | Shared name-free report | Share button | 🔧 | Link built from `window.location.origin`, ignoring `SITE_URL` | Now `buildSharedReportUrl(getPublicBaseUrl(), …)` server-side |

## Individual

| Route | Role | Purpose | Entry point | Status | Issue | Resolution |
|---|---|---|---|---|---|---|
| `/app` | ind | Home — start/continue, latest result | Nav "Home" | ✅ | — | — |
| `/app/assessments` | ind | Start / resume / history | Nav "Take Assessment" | ✅ | — | — |
| `/app/assessments/[sessionId]` | ind | The 24-scenario runner | Start/resume CTA | ✅ | — | Now serves the v2 bank |
| `/app/history` | ind | Past results + trend | Nav "My Results" | ✅ | — | — |
| `/app/results/[resultId]` | ind | Full report + PDF/email/share | Result cards | 🔧 | Share link ignored `SITE_URL` | `shareUrl` now resolved server-side |
| `/app/invitations` | ind | Pending invites + join by code | Nav "Team Invitations" | ✅ | — | — |
| `/app/settings` | ind | Account, privacy, notifications | Nav "Account", account menu | ✅ | — | — |
| `/app/settings/export` | ind | GDPR data export | Settings button | ✅ | — | — |

## Facilitator / team admin

| Route | Role | Purpose | Entry point | Status | Issue | Resolution |
|---|---|---|---|---|---|---|
| `/app` | fac | Dashboard | Nav "Dashboard" | ⚠️ | Still renders the individual dashboard | See Known gaps |
| `/app/teams` | fac | Team list | Nav "My Teams" | ✅ | — | — |
| `/app/teams/new` | fac | Create team | "Create a team" | ✅ | Entitlement-gated | — |
| `/app/teams/[teamId]` | fac | Team overview | Team card | ✅ | — | — |
| `/app/teams/[teamId]/dashboard` | fac | Roster, invite, QR, join link | Team tabs | ✅ | — | — |
| `/app/teams/[teamId]/results` | fac | Team intelligence | Team tabs | ✅ | — | — |
| `/app/teams/[teamId]/settings` | fac | Edit team, rotate link | Team tabs | ✅ | Rotate revalidates `/dashboard` only → stale QR here | ⚠️ Known gap |
| `/app/teams/[teamId]/presentation` | fac | Full-screen deck | Nav "Present", team tabs | 🔧 | Report QR ignored the local-URL warning | Warning now shown on both QRs |
| `/app/teams/[teamId]/presentation/stats` | fac | Live counter (JSON) | Polled by deck | ✅ | — | — |
| **`/app/participants`** | fac | Cross-team completion | Nav "Participants" | 🔧 | **Nav item had no route** | Route created |
| **`/app/present`** | fac | Presentation picker | Nav "Present" | 🔧 | **Deck needed a teamId; unreachable from nav** | Route created |
| `/app/reports` | fac | Report downloads | Nav "Reports" | ✅ | — | — |

## Coach

| Route | Role | Purpose | Entry point | Status | Issue | Resolution |
|---|---|---|---|---|---|---|
| `/app/coach` | coach | Workspace | Nav "Workspace" | ✅ | — | — |
| **`/app/coach/clients`** | coach | Engagements by client org | Nav "Clients" | 🔧 | **Nav item had no route** | Route created |
| `/app/coach/profile` | coach | Coach identity + photo | Nav "Coach Profile", account menu | ✅ | — | — |
| `/app/coach/profile/preview` | coach | Participant-facing preview | Workspace "Preview" | ✅ | — | — |

## Platform admin

| Route | Role | Purpose | Entry point | Status | Issue | Resolution |
|---|---|---|---|---|---|---|
| `/admin` | sa | Overview | Nav, account menu, header button | ✅ | — | — |
| `/admin/users` | sa | Accounts | Admin nav | ✅ | — | — |
| `/admin/users/[userId]` | sa | Account detail, roles, entitlements | Users table, Roles table | ✅ | — | — |
| `/admin/teams` | sa | All teams | Admin nav | ✅ | — | — |
| `/admin/submissions` | sa | All results | Admin nav | ✅ | — | — |
| `/admin/submissions/[resultId]` | sa | Result detail | Submissions table | ✅ | — | — |
| `/admin/payments` | sa | Entitlements | Admin nav | ✅ | — | — |
| `/admin/emails` | sa | Notification log | Admin nav | ✅ | — | — |
| `/admin/reports` | sa | Export log | Admin nav | ✅ | — | — |
| **`/admin/roles`** | sa | Who holds elevated access | Admin nav "Roles" | 🔧 | **Required nav item had no route** | Route created (read-only; mutations stay on user detail) |
| `/admin/settings` | sa | Platform config (read-only) | Admin nav | ✅ | Read-only by design, states so | — |
| *(exit)* | sa | Return to DISC360 | Admin header | ✅ | Already existed in the header (my first audit pass missed it and briefly added a duplicate in the sidebar) | Single link, now sourced from `RETURN_TO_APP` in the nav module |
| `/media-guide` | sa | Media registry inventory | None — URL only | ⚠️ | Gated + `noindex`, but undiscoverable | ⚠️ Known gap |

---

## Removed

| Item | Why |
|---|---|
| 🗑 `components/layout/nav-links.ts` | Exported `navLinks` → `/assessment`, `/dashboard`, `/team` — **all three 404**. Zero importers. |
| 🗑 `lib/assessment/questions.ts` | Zero importers. Runtime questions come from Postgres. |
| 🗑 `lib/assessment/schemas.ts` | Zero importers; superseded by the stricter `z.uuid()` schemas in `lib/actions/assessment.ts`. |
| 🗑 `.mockdb/db.json` | 32 KB of fabricated users/sessions/results, **tracked in git**, zero code references. Untracked + gitignored. |

---

## Known gaps (not fixed in this pass)

Recorded deliberately rather than hidden.

| # | Gap | Location | Severity |
|---|---|---|---|
| 1 | **Facilitator dashboard not built.** `/app` still renders the individual dashboard for facilitators. The nav says "Dashboard" and the data layer (`getFacilitatorSummary`) exists, but the page does not consume it. | `app/app/(shell)/page.tsx` | High — spec item |
| 2 | **Per-team action row incomplete.** "Show QR / copy join link / download team report / edit team" exist but are spread across tabs rather than immediately visible per team. | `app/app/(shell)/teams/page.tsx` | Medium — spec item |
| 3 | **`team_code` is a guessable join credential.** `acceptTeamCode` resolves a code straight to `invite_token`. ~9k values per name stem, from non-crypto `Math.random()`, no rate limit. Also collision-prone at scale. | `lib/actions/teams.ts:49`, `lib/actions/invitations.ts:102` | High — security |
| 4 | **`join_enabled` bypassed by the code path.** `acceptTeamLink` checks only `archived_at`, so a team code still joins a team with joining disabled. The `/join/[token]` page is safe (checks `blocked` first). | `lib/actions/invitations.ts:130` | Medium — security |
| 5 | **Open redirect.** `?next=` is pushed unvalidated. | `components/auth/SignInForm.tsx:35` | Medium — security |
| 6 | **Payments are simulated unconditionally.** `paymentProvider = DevCheckoutProvider` is a hard assignment with no env switch and ships to production. Honestly labelled in the UI. | `lib/payments/provider.ts:45` | High before launch |
| 7 | **`revokeInvitation` has no UI.** Orphaned action; makes `invitation_status='revoked'` unreachable, so two user-facing error strings can never fire. | `lib/actions/teams.ts:576` | Low |
| 8 | **`removeMember` fails silently.** Returns without feedback on the last-admin guard — the button appears to do nothing. | `lib/actions/teams.ts:427` | Low |
| 9 | **Stale QR after rotation.** `rotateInviteLink` revalidates `/dashboard` only; the settings QR (where the button lives) and the deck can serve a dead token. | `lib/actions/teams.ts:268` | Low |
| 10 | **Presentation error card is a dead end** — no nav, no exit link. Effectively unreachable (guarded upstream). | `app/app/(present)/teams/[teamId]/presentation/page.tsx:24` | Low |
| 11 | **`share_token` cannot be revoked.** Once shared, `/r/{token}` is live forever. | `00007_entitlements_admin.sql:38` | Low |
| 12 | **`/media-guide` is undiscoverable** — super-admin gated but linked from nowhere. | `app/media-guide/page.tsx` | Low |
