-- The admission and provenance triggers must read the campaign as the RULE,
-- not as the participant.
--
-- ─────────────────────────────────────────────────────────────────────
-- THE DEFECT.
--
-- 00047's `enforce_wellbeing_campaign_admission()` opens with:
--
--   select c.status, c.expires_at, ... into ...
--     from public.wellbeing_campaigns c
--    where c.id = new.campaign_id
--      for update;
--
-- and raises CAMPAIGN_NOT_FOUND when that finds nothing. It was written as a
-- plain (SECURITY INVOKER) function, so the read runs with the INSERTING
-- participant's privileges and row-level security applies to it.
--
-- Two rules then combine to make the row invisible:
--
--   1 · A locking read is not an ordinary read. PostgreSQL applies the UPDATE
--       policies' USING clauses to `SELECT ... FOR UPDATE`, in addition to the
--       SELECT policies — the row must be lockable, not merely readable.
--   2 · `wellbeing_campaigns_governance_updates` is
--       `has_wellbeing_role(organization_id, 'wellbeing_governance')`.
--
-- An ordinary participant holds no wellbeing role, so the row failed the
-- UPDATE policy, the lookup returned no rows, and the trigger raised
-- CAMPAIGN_NOT_FOUND. Every campaign-backed attempt by a real participant was
-- refused, with a message saying the campaign did not exist.
--
-- 00048 granted participants SELECT on their own campaign, which was necessary
-- and not sufficient: it does not make the row lockable.
--
-- WHY THIS HID.
--
-- The wellbeing suites' participants happen to hold analyst or governance
-- grants in the demo organisation, so they passed the UPDATE policy by
-- accident of fixture data. It appeared only for a participant in an
-- organisation where they hold nothing — which is every real participant.
--
-- THE FIX, AND WHY IT IS NOT "LOOSEN THE POLICY".
--
-- Widening the UPDATE policy so participants can lock campaign rows would give
-- them a write-shaped privilege on a governance table to satisfy a read.
--
-- These functions are ENFORCEMENT. They decide whether an insert is allowed
-- and expose nothing: every value they read is used in a comparison, and the
-- only things that leave them are `new` and an exception. That is exactly what
-- SECURITY DEFINER is for. `search_path` is pinned so the definer's rights
-- cannot be redirected to another schema's tables.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.enforce_wellbeing_campaign_admission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.wellbeing_campaign_status;
  v_expires timestamptz;
  v_capacity int;
  v_instrument text;
  v_version uuid;
  v_joined int;
begin
  if new.campaign_id is null then
    return new;
  end if;

  -- FOR UPDATE: serialise concurrent admissions to the same campaign. Read as
  -- the definer, so an ordinary participant's lack of governance rights cannot
  -- make their own campaign invisible to the rule governing them.
  select c.status, c.expires_at, c.participant_capacity, c.instrument_key, c.version_id
    into v_status, v_expires, v_capacity, v_instrument, v_version
    from public.wellbeing_campaigns c
   where c.id = new.campaign_id
     for update;

  if not found then
    raise exception using
      errcode = 'foreign_key_violation',
      message = 'Unknown campaign.',
      hint = 'CAMPAIGN_NOT_FOUND';
  end if;

  -- PROVENANCE. A session may not claim a campaign while answering another
  -- campaign's instrument or a version the campaign did not pin.
  if new.instrument_key is distinct from v_instrument then
    raise exception using
      errcode = 'check_violation',
      message = format('Session instrument %s does not match campaign instrument %s.',
                       new.instrument_key, v_instrument),
      hint = 'CAMPAIGN_INSTRUMENT_MISMATCH';
  end if;

  if new.version_id is distinct from v_version then
    raise exception using
      errcode = 'check_violation',
      message = 'Session version does not match the version pinned by the campaign.',
      hint = 'CAMPAIGN_VERSION_MISMATCH';
  end if;

  -- LIFECYCLE.
  if v_status <> 'active' then
    raise exception using
      errcode = 'check_violation',
      message = format('Campaign is %s and admits nobody.', v_status),
      hint = 'CAMPAIGN_NOT_OPEN';
  end if;

  if v_expires is not null and v_expires <= now() then
    raise exception using
      errcode = 'check_violation',
      message = 'Campaign has expired.',
      hint = 'CAMPAIGN_EXPIRED';
  end if;

  -- CAPACITY, in DISTINCT participants. Somebody who already holds a place
  -- keeps it, so a retake or a resume never consumes a second one.
  if v_capacity is null then
    return new;
  end if;

  if exists (
    select 1 from public.wellbeing_sessions s
     where s.campaign_id = new.campaign_id and s.profile_id = new.profile_id
  ) then
    return new;
  end if;

  select count(distinct s.profile_id) into v_joined
    from public.wellbeing_sessions s
   where s.campaign_id = new.campaign_id;

  if v_joined >= v_capacity then
    raise exception using
      errcode = 'check_violation',
      message = format('Campaign capacity reached: %s of %s places are taken.',
                       v_joined, v_capacity),
      hint = 'CAMPAIGN_CAPACITY_REACHED';
  end if;

  return new;
end;
$$;

-- The same reasoning for the result trigger: it counts sessions and campaigns
-- belonging to the participant and to their campaign, compares them, and
-- returns `new` or raises. It reads `wellbeing_campaigns` too, so under
-- SECURITY INVOKER a participant's own result would be refused for the same
-- reason — the campaign it names would be invisible to the check.
create or replace function public.enforce_wellbeing_result_provenance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_campaign uuid;
  v_session_instrument text;
  v_session_version uuid;
  v_campaign_instrument text;
begin
  select s.campaign_id, s.instrument_key, s.version_id
    into v_session_campaign, v_session_instrument, v_session_version
    from public.wellbeing_sessions s
   where s.id = new.session_id;

  if not found then
    return new; -- the foreign key already refuses an unknown session
  end if;

  if new.campaign_id is distinct from v_session_campaign then
    raise exception using
      errcode = 'check_violation',
      message = 'Result campaign does not match its session''s campaign.',
      hint = 'RESULT_CAMPAIGN_MISMATCH';
  end if;

  if new.instrument_key is distinct from v_session_instrument
     or new.version_id is distinct from v_session_version then
    raise exception using
      errcode = 'check_violation',
      message = 'Result instrument/version does not match its session.',
      hint = 'RESULT_PROVENANCE_MISMATCH';
  end if;

  if new.campaign_id is not null then
    select c.instrument_key into v_campaign_instrument
      from public.wellbeing_campaigns c where c.id = new.campaign_id;
    if v_campaign_instrument is distinct from new.instrument_key then
      raise exception using
        errcode = 'check_violation',
        message = 'Result instrument does not match its campaign.',
        hint = 'RESULT_CAMPAIGN_INSTRUMENT_MISMATCH';
    end if;
  end if;

  return new;
end;
$$;

-- A definer function's rights are only as narrow as who may call it. These are
-- trigger functions: they are invoked by the trigger, never directly, and a
-- direct call would fail for want of a trigger context. Revoking EXECUTE from
-- the public role says so explicitly rather than relying on that.
revoke all on function public.enforce_wellbeing_campaign_admission() from public;
revoke all on function public.enforce_wellbeing_result_provenance() from public;

do $$ begin
  raise notice 'admission and provenance triggers now read the campaign as the rule, not as the participant';
end $$;
