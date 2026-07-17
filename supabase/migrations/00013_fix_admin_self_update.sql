-- Fix: a super admin could not update their own profile at all.
--
-- profiles_update_own carried `with check (id = auth.uid() and is_super_admin
-- = false)`. The intent was to stop a user promoting themselves. But WITH CHECK
-- validates the RESULTING row, so once an account is a super admin, EVERY
-- self-update fails the `is_super_admin = false` clause — completing onboarding,
-- changing name/timezone, editing notification settings, requesting a data
-- export. Reproduced: an authenticated update by the owner errors with
-- "new row violates row-level security policy".
--
-- This blocked the bootstrap admin (minajjumbo@gmail.com) from finishing
-- onboarding, because the promotion trigger flips is_super_admin true during
-- signup, before onboarding runs.
--
-- Correct model: a user may update their own profile, but may NOT change their
-- own is_super_admin. RLS WITH CHECK cannot compare OLD to NEW, so the
-- privilege-escalation guard moves to a BEFORE UPDATE trigger; the policy is
-- relaxed to ownership only.

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

/*
 * Blocks a change to is_super_admin only when the profile's own owner is the
 * one making it (auth.uid() = the row id). Legitimate promotion paths run
 * without a user JWT — the bootstrap SECURITY DEFINER function/trigger and the
 * admin `toggleSuperAdmin` service-role client both have auth.uid() = null — so
 * they pass. A user editing anything else on their profile passes too, because
 * the guard fires only when is_super_admin actually changes.
 */
create or replace function public.prevent_self_super_admin_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.is_super_admin is distinct from old.is_super_admin
     and auth.uid() is not null
     and auth.uid() = old.id then
    raise exception 'is_super_admin cannot be changed by the profile owner';
  end if;
  return new;
end;
$$;

create trigger prevent_self_super_admin_change
  before update on public.profiles
  for each row execute function public.prevent_self_super_admin_change();
