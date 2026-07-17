-- Bootstrap the initial platform super administrator.
--
-- What this is NOT: there is no hard-coded password, no seeded credential and
-- no unauthenticated bypass. The person signs up or signs in through the
-- normal flow like anyone else; this only flips a flag on a profile that
-- already exists *because* they authenticated.
--
-- Ordering-independent by design. A plain `update ... where email = '...'` in a
-- migration is a no-op when the account does not exist yet, and migrations run
-- before anyone has signed up. So the target lives in an allowlist, and
-- promotion happens either now (if the account exists) or the moment the
-- account confirms its email.
--
-- ─────────────────────────────────────────────────────────────────────
-- SECURITY — read before deploying to production.
--
-- Promotion requires auth.users.email_confirmed_at to be set: the person must
-- have proved control of the mailbox. That guard is the only thing standing
-- between this allowlist and an account takeover, because an email address is
-- just a string typed at signup.
--
-- If your Supabase project has email confirmations DISABLED, every signup is
-- confirmed instantly and ANYONE who signs up as the bootstrap address is
-- promoted to super admin. supabase/config.toml sets
-- `enable_confirmations = false` for local development only.
--
--   → Production MUST keep Authentication → Providers → Email →
--     "Confirm email" enabled.
--
-- Related protection already in place: profiles_update_own (00002_rls.sql)
-- carries `with check (id = auth.uid() and is_super_admin = false)`, so a user
-- can never promote themselves directly.
-- ─────────────────────────────────────────────────────────────────────

create table public.super_admin_bootstrap (
  -- Stored already normalized; the lookup normalizes the incoming address too.
  email text primary key,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- RLS on, and deliberately zero policies plus zero grants to anon/authenticated:
-- this table is reachable only by migrations and the service role. Anyone able
-- to insert here could promote themselves, so nobody but the platform can.
alter table public.super_admin_bootstrap enable row level security;

insert into public.super_admin_bootstrap (email, note)
values ('minajjumbo@gmail.com', 'Initial platform super administrator')
on conflict (email) do nothing;

-- ── promotion ────────────────────────────────────────────────────────

/*
 * Promotes every confirmed account whose normalized email is allowlisted.
 *
 * Idempotent in both senses that matter: `is_super_admin = false` in the
 * predicate means an already-promoted account is skipped entirely, so
 * re-running promotes nobody twice and writes no duplicate audit row. Returns
 * the number of accounts actually promoted — 0 is the expected result on a
 * second run.
 *
 * security definer: reads auth.users and writes profiles/audit_logs, neither of
 * which the caller can necessarily touch. It takes no arguments, so there is no
 * caller-supplied value to smuggle in — the allowlist is the only input.
 */
create or replace function public.apply_super_admin_bootstrap()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promoted int := 0;
  v_row record;
begin
  for v_row in
    select p.id, u.email
    from public.profiles p
    join auth.users u on u.id = p.id
    join public.super_admin_bootstrap b on b.email = lower(trim(u.email))
    where u.email_confirmed_at is not null
      and p.is_super_admin = false
  loop
    update public.profiles set is_super_admin = true where id = v_row.id;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      v_row.id,
      'profile.super_admin_granted',
      'profile',
      v_row.id::text,
      jsonb_build_object('source', 'bootstrap_migration', 'email', v_row.email)
    );

    v_promoted := v_promoted + 1;
  end loop;

  return v_promoted;
end;
$$;

revoke all on function public.apply_super_admin_bootstrap() from public, anon, authenticated;

-- Promote now if the account already exists. A no-op otherwise — the trigger
-- below covers the "signs up later" case.
select public.apply_super_admin_bootstrap();

-- ── promote on confirmation ──────────────────────────────────────────

create or replace function public.bootstrap_super_admin_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  if not exists (
    select 1 from public.super_admin_bootstrap b
    where b.email = lower(trim(new.email))
  ) then
    return new;
  end if;

  update public.profiles
  set is_super_admin = true
  where id = new.id and is_super_admin = false;

  get diagnostics v_updated = row_count;

  -- Only log a grant that actually changed something: this trigger also fires
  -- on later updates to a confirmed account, and a re-confirmation is not a
  -- new grant.
  if v_updated > 0 then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      new.id,
      'profile.super_admin_granted',
      'profile',
      new.id::text,
      jsonb_build_object('source', 'bootstrap_trigger', 'email', lower(trim(new.email)))
    );
  end if;

  return new;
end;
$$;

/*
 * Name matters. Postgres fires triggers on the same table and event in
 * alphabetical order, and `on_auth_user_created` (00001_schema.sql) is what
 * inserts the profile row. A name sorting before it would run first, find no
 * profile to update, and silently promote nobody. `zz_` keeps this last.
 */
create trigger zz_bootstrap_super_admin
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.bootstrap_super_admin_on_confirm();
