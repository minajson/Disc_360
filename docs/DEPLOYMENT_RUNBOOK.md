# DISC360 — production deployment runbook

Local → hosted Supabase + Netlify. This is the exact sequence for going live.

**Division of labour.** Every step here needs an account, a credential or a
physical action that an automated agent cannot perform (dashboard logins,
domain DNS, OAuth consent screens, a phone). The code, migrations, admin
bootstrap and test gate are already prepared and verified locally; what remains
is the credentialed execution below.

Times are rough. **Two items have long lead times — start them first:** Resend
domain verification (DNS propagation, minutes to hours) and Google/Microsoft
OAuth app setup (consent-screen review can be slow). Do not leave these to last.

---

## 0. Prerequisites

```bash
npm i -g netlify-cli          # Netlify CLI (not currently installed)
npx supabase --version        # Supabase CLI is available via npx
```

Accounts you must have: Supabase, Netlify, Resend, Google Cloud, Microsoft Entra.

> **Do not touch the ISIP project.** The only existing hosted Supabase project
> belongs to another application. DISC360 gets its **own new** project.

---

## Phase 1 — create the hosted Supabase project

1. https://supabase.com/dashboard → **New project**.
   - Organization: your org. **Name: `DISC360`.** Region: closest to the client.
   - Set a strong database password — **store it in your password manager**; it
     is shown once.
2. When it finishes, copy from **Project Settings → API**:
   - Project URL → `https://<ref>.supabase.co`
   - `anon` public key
   - `service_role` key (**secret — server only, never in the browser or git**)
3. From **Project Settings → General**: the **project ref** (`<ref>`).

Verify the URL is hosted, not local:
```bash
echo "$NEXT_PUBLIC_SUPABASE_URL"   # must be https://<ref>.supabase.co, not 127.0.0.1
```

---

## Phase 2 — apply migrations to the hosted project

```bash
export SUPABASE_ACCESS_TOKEN='<from supabase.com/dashboard/account/tokens>'
npx supabase login                      # or rely on the token above
npx supabase link --project-ref <ref>   # prompts for the DB password from Phase 1
npx supabase db push                    # applies supabase/migrations/* in order
```

`db push` applies **only migrations** — it does **not** run `supabase/seed.sql`,
so no demo/fake data reaches production. That is intentional and is what
satisfies "migrate reference data, never demo data": the question bank (v2),
assessment version, roles and RLS all live in migrations; the 30 demo accounts
live only in the seed.

**Verify (Supabase SQL editor):**
```sql
select table_name from information_schema.tables
where table_schema='public'
  and table_name in ('profiles','organizations','teams','team_members',
    'assessment_versions','questions','question_options','team_creation_drafts')
order by table_name;                    -- expect all 8

select name, version, is_active from public.assessment_versions;  -- v2 active
select count(*) from public.question_options;                      -- 96
select count(*) from pg_policies where schemaname='public';        -- > 0 (RLS present)
```
Every table must have RLS enabled — this repo ships no table without policies.
If any migration fails, **stop**, read the error, fix forward with a *new*
migration (never edit an applied one), re-push.

> Note `participants`: there is no table by that name. Participants are
> `team_members` rows (roster) that become `profiles` on join. Verify
> `team_members`, above.

---

## Phase 3 — reference data

Nothing extra to import. Migrations already carry the question bank, assessment
version, dimension/archetype enums and RLS. Do **not** copy any rows from the
local database — it contains only demo data.

---

## Phase 4 — the super administrator (minajjumbo@gmail.com)

Full detail: [SUPER_ADMIN_BOOTSTRAP.md](./SUPER_ADMIN_BOOTSTRAP.md). Short form:

1. Migration `00012` allowlists `minajjumbo@gmail.com` and installs a trigger
   that promotes the account **once its email is confirmed** — so promotion is
   impossible without mailbox control.
2. **Production must keep email confirmations ON**
   (Authentication → Providers → Email → *Confirm email*). With them off, anyone
   signing up as that address is auto-promoted. `config.toml` disables them for
   *local only*.
3. Have minajjumbo@gmail.com sign up and click the confirmation link. The
   trigger promotes them. If needed, run the idempotent repair:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY='<key>' NEXT_PUBLIC_SUPABASE_URL='https://<ref>.supabase.co' \
     node scripts/promote-super-admin.mjs minajjumbo@gmail.com
   ```
4. Verify: they sign out/in, then reach `/admin`, `/admin/users`, `/admin/roles`,
   `/admin/teams`, `/admin/settings` (all eight admin routes). A normal user
   hitting `/admin/*` is redirected to `/app`; a signed-out visitor to
   `/sign-in`. This is covered by `e2e/super-admin.spec.ts`.

---

## Phase 5 — authentication

Email/password, forgot/reset password, and logout work with only the Supabase
env vars set — no extra configuration. Session persistence is cookie-based via
`@supabase/ssr` and middleware refresh.

**Google & Microsoft require provider setup** — full steps in
[OAUTH_SETUP.md](./OAUTH_SETUP.md). Summary:
- Create the OAuth apps; set the redirect URI to
  `https://<ref>.supabase.co/auth/v1/callback`.
- Enable Google and Azure in Supabase → Authentication → Providers; paste
  credentials; set `AZURE_TENANT_URL` to match your account-type choice.
- Supabase → Authentication → URL Configuration: **Site URL** =
  `https://<netlify-domain>`; **Redirect URLs** include
  `https://<netlify-domain>/**` (wildcard preserves the `?intent=` that carries
  create-team through the round trip).
- Until credentials are set the app **disables** each button and says
  "Google/Microsoft sign-in requires provider configuration." — never a dead
  button, never a broken bounce.

**Do not report Google or Microsoft as working until a real login completes.**

---

## Phase 6 — email (Resend)

**Production is on Vercel** (`disc-360`, alias `https://disc-360.vercel.app`).
Set these in **Vercel → Project → Settings → Environment Variables →
Production** (and Preview, if preview deployments should send at all — they
should usually not).

### The three variables, exactly

| Variable | Required? | Format | Example |
|---|---|---|---|
| `RESEND_API_KEY` | **Yes — nothing sends without it** | Resend secret key, `re_` + token | `re_XXXXXXXX_XXXXXXXXXXXXXXXXXXXXXXXX` |
| `EMAIL_FROM` | **Yes** | RFC-5322 mailbox, `Name <address>` | `Wellbeing Pulse <notifications@yourdomain.com>` |
| `EMAIL_REPLY_TO` | Recommended | bare address | `wellbeing@yourdomain.com` |

Notes that matter:

- `EMAIL_FROM` **must be an address on a domain verified in Resend**, or Resend
  rejects the send and the participant is told (correctly) that it failed.
  Until a domain is verified, the only address that will deliver is Resend's
  shared `onboarding@resend.dev`, and that is test-mode only — it will not
  reach arbitrary recipients.
- Verifying a domain adds DKIM/SPF DNS records and is the slow step. Start it
  before you need it.
- `EMAIL_REPLY_TO` exists because a wellbeing participant who replies to their
  report notification must reach a human. Without it, replies go nowhere.
- **Nothing about email is secret except `RESEND_API_KEY`.** It must never
  appear in `netlify.toml`, `vercel.json`, the repo, or a client bundle.

### What the product does without them

`lib/email/send.ts` records every message in `notification_logs` with status
`logged` and returns `logged` rather than `sent`. The participant is told "We
could not send your report just now. Nothing was sent, and you can still
download it here." — the outcome shown is the outcome that happened.
`wellbeing_report_deliveries` records `not_delivered` with the reason.

`/admin/emails` now shows a banner naming exactly which variables are missing,
so this state is visible in the product rather than only in a log.

### Verifying once the key is set

Do **not** mark email as passing from logs alone.

1. `/admin/emails` — the "Email not fully configured" banner must be gone.
2. Complete a check-in and press **Email my report**. The state must read
   *"Report sent. We've sent a copy to n\*\*\*@example.com."* — a masked
   address, from the provider's own confirmation.
3. Receive the message in a real inbox and open the report link.
4. `notification_logs` must show `sent` with a `provider_id`, and
   `wellbeing_report_deliveries` must show `sent`.
5. Repeat for all four questionnaires — the report body differs per
   questionnaire and each is built from its own content.
6. Press the button twice quickly: the button is disabled while a send is in
   flight, so exactly one row must appear.
7. Confirm no questionnaire answer, score or item response appears anywhere in
   `notification_logs` or `wellbeing_report_deliveries` — the delivery record
   carries a masked recipient and a status, and nothing else.

## Phase 7 — Netlify

```bash
netlify login
netlify init            # or link an existing site to this repo
```

Set environment variables (Site settings → Environment variables). **Secrets go
here, never in netlify.toml or git:**

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** service-role key |
| `NEXT_PUBLIC_SITE_URL` | `https://<netlify-domain>` |
| `SITE_URL` | `https://<netlify-domain>` (runtime; must match) |
| `RESEND_API_KEY` | **secret** Resend key — see Phase 6 |
| `EMAIL_FROM` | `Name <address@verified-domain>` — see Phase 6 |
| `EMAIL_REPLY_TO` | bare address a human reads — see Phase 6 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | when configured |
| `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` / `AZURE_TENANT_URL` | when configured |

`netlify.toml` (committed) sets the build command, the Next.js plugin and the
secret-scanner allowlist for the public `NEXT_PUBLIC_*`/`SITE_URL` values.

```bash
netlify deploy --build --prod
```

After the first deploy, set the Supabase **Site URL** and **Redirect URLs** to
the real Netlify domain (Phase 5), and redeploy if you changed
`NEXT_PUBLIC_SITE_URL`.

**Verify:** open `https://<netlify-domain>/`, sign in, and confirm the page is
served (not a build error), then check no secret leaked into the client bundle:
```bash
# From the deployed site, the service-role key must never appear:
curl -s https://<netlify-domain>/ | grep -c "service_role"   # expect 0
```

---

## Phases 8–9 — team creation & QR (post-deploy)

1. As an entitled user, create a team through the single wizard
   (`/app/teams/new`) — one form, three steps, no duplicate entry.
2. On the team dashboard, the join QR encodes
   `https://<netlify-domain>/join/<invite_token>` because `SITE_URL` is the
   Netlify domain. Confirm with:
   ```bash
   SITE_URL='https://<netlify-domain>' node scripts/print-join-qr.mjs
   #   Local URL detected: false   ← required
   ```
   The payload must **not** contain localhost, 127.0.0.1 or a Cloudflare tunnel.
3. Scan from a phone on cellular data, register, and complete an assessment.
   **QR is not PASS until a real phone finishes an assessment and it appears on
   the dashboard.**

---

## Phase 10 — the gate (already green locally)

```bash
npm run lint && npx tsc --noEmit && npm test && npx playwright test && npm run build
```

Playwright runs against **local** Supabase; it is a pre-deploy gate, not a
production test. Production verification is Phase 11.

---

## Phase 11 — production smoke test

On the live Netlify URL, with real accounts:
admin login · participant join · assessment completes · dashboard updates ·
email received · password reset · Google · Microsoft. Record each as
PASS / FAIL / NOT CONFIGURED — no guessing.

---

## Rollback

Netlify keeps every deploy; **Deploys → an earlier one → Publish** reverts the
frontend instantly. Database migrations are forward-only — never edit an applied
migration; ship a new one. Take a Supabase backup before the session
(Database → Backups).
