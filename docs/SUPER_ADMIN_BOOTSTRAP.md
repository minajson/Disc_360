# Bootstrapping the platform super administrator

The initial super admin is **minajjumbo@gmail.com**.

There is no hard-coded password, no seeded credential and no unauthenticated
bypass anywhere in this design. The person signs up (or signs in with
Google/Microsoft) through the normal flow like any other user; the only thing
the platform does is flip `profiles.is_super_admin` on a profile that already
exists *because* they authenticated.

## How it works

`supabase/migrations/00012_super_admin_bootstrap.sql` installs three things:

1. **`super_admin_bootstrap`** — an allowlist table holding the target address.
   RLS is enabled with **zero policies and zero grants** to `anon`/`authenticated`,
   so it is reachable only by migrations and the service role. Anyone able to
   insert here could promote themselves.

2. **`apply_super_admin_bootstrap()`** — promotes every *confirmed* account whose
   normalized email is allowlisted, and writes an `audit_logs` row. The migration
   calls it once. It is a no-op when the account does not exist yet.

3. **`zz_bootstrap_super_admin`** — a trigger on `auth.users` that promotes the
   account the moment its email is confirmed. This is what makes the whole thing
   ordering-independent: migrations run long before anyone signs up, so a plain
   `update … where email = '…'` would silently promote nobody.

   The `zz_` prefix is load-bearing. Postgres fires triggers on the same table
   and event **in alphabetical order**, and `on_auth_user_created` is what
   inserts the profile row. A name sorting earlier would run first, find no
   profile, and quietly do nothing.

### Why email confirmation is the whole security model

An email address is just a string somebody types at signup. The only reason
promoting an address is safe is that promotion requires
`auth.users.email_confirmed_at` to be set — i.e. the person proved they control
the mailbox.

> ### ⚠️ Production must keep email confirmations enabled
>
> If your Supabase project has **Authentication → Providers → Email → "Confirm
> email"** turned **off**, every signup is confirmed instantly, and **anyone who
> signs up as `minajjumbo@gmail.com` is promoted to super admin**.
>
> `supabase/config.toml` sets `enable_confirmations = false` for **local
> development only**. Never mirror that in production.

Verified behaviour (see `e2e/super-admin.spec.ts` and the migration):

| Scenario | Result |
|---|---|
| Confirmed account, allowlisted address | promoted, audit row written |
| **Unconfirmed** account, same address | **not promoted** |
| `MinaJJumbo@Gmail.com ` (case + whitespace) | normalized and matched |
| Function re-run 3× | 0 promoted, no duplicate audit rows |
| Normal user visiting `/admin/*` | redirected to `/app` |
| Signed-out visitor visiting `/admin/*` | redirected to `/sign-in` |

A user can never promote themselves directly: `profiles_update_own`
(`00002_rls.sql`) carries `with check (id = auth.uid() and is_super_admin = false)`.

## Production procedure

### Step 1 — the person creates their account

Have **minajjumbo@gmail.com** go to `/sign-up` and register (email/password, or
Google/Microsoft once configured — see [OAUTH_SETUP.md](./OAUTH_SETUP.md)), then
**click the confirmation link** in their inbox.

### Step 2 — promote

If migration `00012` has been applied to the production database, **the trigger
has already promoted them at confirmation and there is nothing to do.** Skip to
step 3 and verify.

Otherwise, use exactly one of the following.

#### Option A — the one-time script (recommended)

Runs in a Node process you control. The service-role key stays in your shell and
never reaches a browser.

```bash
# Check first — makes no changes.
SUPABASE_SERVICE_ROLE_KEY='<service-role-key>' \
NEXT_PUBLIC_SUPABASE_URL='https://<project-ref>.supabase.co' \
node scripts/promote-super-admin.mjs minajjumbo@gmail.com --dry-run

# Then promote.
SUPABASE_SERVICE_ROLE_KEY='<service-role-key>' \
NEXT_PUBLIC_SUPABASE_URL='https://<project-ref>.supabase.co' \
node scripts/promote-super-admin.mjs minajjumbo@gmail.com
```

The script refuses to promote an unconfirmed address, is idempotent (a second
run reports "Already a super admin" and writes nothing), and logs the grant.

#### Option B — exact SQL

Run in the Supabase SQL editor (which already runs as a privileged role — do not
paste the service-role key anywhere).

```sql
-- Idempotent: promotes only a confirmed, not-yet-promoted account, and logs it.
with target as (
  select p.id, lower(trim(u.email)) as email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(trim(u.email)) = 'minajjumbo@gmail.com'
    and u.email_confirmed_at is not null   -- mailbox control proven
    and p.is_super_admin = false           -- makes re-runs a no-op
),
promoted as (
  update public.profiles p
  set is_super_admin = true
  from target t
  where p.id = t.id
  returning p.id, t.email
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select id, 'profile.super_admin_granted', 'profile', id::text,
       jsonb_build_object('source', 'manual_sql', 'email', email)
from promoted;
```

If migration `00012` is applied, this equivalent one-liner does the same thing:

```sql
select public.apply_super_admin_bootstrap();  -- returns the number promoted; 0 on re-run
```

### Step 3 — verify

```sql
select p.email, p.is_super_admin, u.email_confirmed_at is not null as confirmed
from public.profiles p
join auth.users u on u.id = p.id
where lower(trim(u.email)) = 'minajjumbo@gmail.com';

-- The grant is logged:
select actor_id, action, metadata, created_at
from public.audit_logs
where action = 'profile.super_admin_granted'
order by created_at desc;
```

Then have them **sign out and back in** — the app reads the flag per request, but
an open session's cached layout will not show the new nav until it re-renders.

They should now see a **Platform Admin** entry in the desktop nav, the mobile
nav and the account menu, and reach `/admin`, `/admin/users`, `/admin/teams`,
`/admin/submissions`, `/admin/payments`, `/admin/reports`, `/admin/roles` and
`/admin/settings`.

## Granting further admins

Do **not** add more addresses to `super_admin_bootstrap`; it exists for the
first admin, when no admin exists to grant the role. Once minajjumbo@gmail.com
is in place, promote others through **`/admin/users/<id>`**, which is
authenticated, authorised and audited.

## Removing the bootstrap

Once the first admin exists, the allowlist has served its purpose. It is
harmless (promotion requires a confirmed address, and RLS blocks all access to
the table), but it can be retired in a later migration:

```sql
drop trigger if exists zz_bootstrap_super_admin on auth.users;
drop function if exists public.bootstrap_super_admin_on_confirm();
delete from public.super_admin_bootstrap where email = 'minajjumbo@gmail.com';
```

Keep `apply_super_admin_bootstrap()` if you want the repair path; it is inert
with an empty allowlist.
