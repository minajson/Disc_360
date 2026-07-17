# OAuth setup — Google and Microsoft

DISC360 supports Google and Microsoft (Azure / Entra ID) sign-in through
Supabase Auth. Neither works until the provider is configured on **both**
sides: the identity provider, and Supabase.

Until then the app deliberately disables the button and says
*"Google sign-in requires provider configuration."* rather than starting a
flow it knows cannot finish. That check is
[`lib/auth/oauth-providers.ts`](../lib/auth/oauth-providers.ts) and it reads
the variables below.

> **Why the app checks for itself.** Supabase's `/auth/v1/settings` reports a
> provider as enabled whenever its config block is enabled — regardless of
> whether real credentials exist. Worse, when an `env(...)` substitution finds
> no variable, the CLI forwards the literal string `env(GOOGLE_CLIENT_ID)` to
> Google as the client id, and the user lands on a Google error page. So the
> app decides from its own environment.

---

## 1. Google

1. **Create an OAuth client.** Google Cloud Console → *APIs & Services* →
   *Credentials* → *Create credentials* → *OAuth client ID* →
   **Application type: Web application**.

2. **Authorised JavaScript origins** — the origin the app is served from:
   ```
   http://localhost:3000
   https://<your-production-domain>
   ```

3. **Authorised redirect URI** — this is **Supabase's** callback, not the
   app's. Exactly one entry:
   ```
   https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
   ```
   Find `<SUPABASE_PROJECT_REF>` in Supabase → *Project Settings* → *General*.
   For local development the equivalent is
   `http://127.0.0.1:54321/auth/v1/callback`.

4. **Enable the provider.** Supabase Dashboard →
   *Authentication* → *Providers* → **Google** → toggle on.

5. **Paste the client ID and client secret** from step 1 into that panel.

6. **Configure URL settings** (see [§3](#3-supabase-redirect-urls)).

Local development uses `supabase/config.toml`, which reads:

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

`skip_nonce_check = true` is set for local Google only — the local Auth server
cannot verify the nonce against Google's issued `id_token`. Do not carry that
setting into production.

---

## 2. Microsoft (Azure / Entra ID)

1. **Register an application.** Microsoft Entra admin centre →
   *Identity* → *Applications* → *App registrations* → *New registration*.

2. **Supported account types** — this choice *is* the tenant policy, and it
   must match `AZURE_TENANT_URL` in step 6:

   | Choice | `AZURE_TENANT_URL` |
   |---|---|
   | Accounts in any organizational directory **and** personal Microsoft accounts | `https://login.microsoftonline.com/common` |
   | Any organizational directory (multitenant) | `https://login.microsoftonline.com/organizations` |
   | This organizational directory only (single tenant) | `https://login.microsoftonline.com/<tenant-id>` |
   | Personal Microsoft accounts only | `https://login.microsoftonline.com/consumers` |

   Choosing *single tenant* while sending `common` (or the reverse) is the most
   common cause of `AADSTS50194` / `AADSTS700016` at sign-in.

3. **Redirect URI** — platform **Web**, pointing at Supabase:
   ```
   https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
   ```

4. **Create a client secret.** *Certificates & secrets* → *New client secret*.
   Copy the **Value** (not the Secret ID) immediately — it is shown once.
   Note the expiry and diarise the rotation.

5. **Enable the provider.** Supabase Dashboard →
   *Authentication* → *Providers* → **Azure** → toggle on.

6. **Fill in** Application (client) ID, the client secret **Value**, and the
   **Azure Tenant URL** from the table in step 2.

7. **Email scope.** Supabase's Azure provider requires `email`; without it the
   returned identity carries no address and the profile row cannot be created.
   The app requests `openid profile email offline_access` — see
   [`components/auth/OAuthButtons.tsx`](../components/auth/OAuthButtons.tsx).
   In Entra, add **Microsoft Graph → delegated → `email`, `openid`, `profile`,
   `offline_access`** under *API permissions*.

   If your directory blocks personal accounts without an email claim, tick
   *email optional* in Supabase only if you have a fallback — DISC360 keys
   profiles on email address.

Local development reads:

```bash
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_URL=
```

---

## 3. Supabase redirect URLs

Supabase → *Authentication* → *URL Configuration*.

**Site URL** — the canonical production origin:
```
https://<your-production-domain>
```

**Redirect URLs** — every origin allowed to receive the user back. The app
returns to `/auth/callback` carrying a `?intent=` parameter that preserves what
the user was trying to do, so **use path wildcards**; an exact-match entry
rejects the query and silently drops the intent:

```
http://localhost:3000/**
http://localhost:3200/**
https://<vercel-preview-domain>/**
https://<production-domain>/**
```

Concrete callback URLs these cover:

```
http://localhost:3000/auth/callback
http://localhost:3200/auth/callback
https://<vercel-preview-domain>/auth/callback
https://<production-domain>/auth/callback
```

Vercel preview domains change per deployment. Either add a wildcard
(`https://*-<your-team>.vercel.app/**`) or add previews as needed.

> **Never register a temporary Cloudflare quick-tunnel URL
> (`*.trycloudflare.com`) as a production callback.** Those hostnames are
> ephemeral and are reassigned to other people — a stale entry becomes an open
> redirect into someone else's tunnel. Use one only for a short-lived
> second-device test, and remove it afterwards.

---

## 4. Verifying

```bash
# Which providers does the app consider configured?
grep -E '^(GOOGLE|AZURE)_' .env.local | sed -E 's/=.+/=<set>/'

# What does the local Auth server report?
curl -s http://127.0.0.1:54321/auth/v1/settings -H "apikey: <anon-key>" \
  | python3 -m json.tool | grep -E '"(google|azure)"'
```

Remember `/auth/v1/settings` reports the *config block*, not credential
validity. The honest signal is whether the button is enabled in the app.

**End-to-end check** — only a real round trip proves this works:

1. Open `/sign-in`. The provider button should be enabled.
2. Click it. You should reach the provider's own consent screen — if you land
   on a provider *error* page, the client id or redirect URI is wrong.
3. Approve. You should return to `/auth/callback?code=…` and then land on
   onboarding (new account) or your dashboard (existing).
4. Start from `/sign-up?intent=team` and confirm you arrive at the team wizard,
   not a generic dashboard — that proves intent survived the round trip.

## 5. Troubleshooting

| Symptom | Cause |
|---|---|
| Button says "requires provider configuration" | The variables above are missing from the app's environment. |
| Google: `Error 400: invalid_request`, client_id looks like `env(...)` | The Supabase CLI could not substitute; the variable is not exported where `supabase start` can see it. |
| `redirect_uri_mismatch` | The provider's redirect URI must be **Supabase's** `/auth/v1/callback`, not the app's `/auth/callback`. |
| Returns to sign-in saying the provider could not complete | Supabase rejected the exchange — check the secret, and that the provider is toggled on. |
| Signed in, but landed on `/app` instead of the team wizard | The `intent` was dropped: check the redirect URL allowlist uses `/**` wildcards. |
| `AADSTS50194` / `AADSTS700016` | `AZURE_TENANT_URL` does not match the app's supported account types. |
