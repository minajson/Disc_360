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

1. Resend → **API Keys** → create → set `RESEND_API_KEY` in Netlify.
2. `EMAIL_FROM`: until a verified DISC360 domain exists, use Resend's shared
   `onboarding@resend.dev` sender (test-mode delivery is limited) **and set a
   Reply-To of `minajjumbo@gmail.com`** so replies reach you. Wire this in
   `lib/email/send.ts` (see below).
3. To send from a branded address, verify a domain in Resend (adds DKIM/SPF DNS
   records — **this is the slow, start-early step**), then set
   `EMAIL_FROM="DISC360 <notifications@yourdomain>"`.
4. Templates already implemented: invitation, password reset (Supabase Auth),
   verification (Supabase Auth), assessment completed / report ready, team
   reminder. Product emails send only when `RESEND_API_KEY` is set; otherwise
   they are logged to `notification_logs`.

**Verify by receiving a real email** — trigger a report-ready or an invitation
and confirm it lands in an inbox. Do not mark email PASS from logs alone.

---

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
| `RESEND_API_KEY` | **secret** Resend key |
| `EMAIL_FROM` | branded sender or `onboarding@resend.dev` |
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
