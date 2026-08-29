-- Wellbeing campaigns become the thing the application actually runs on.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHY THIS MIGRATION EXISTS.
--
-- 00044 created `wellbeing_campaigns` to own campaign identity, the join
-- token, the organisation, the instrument, the PINNED questionnaire version,
-- capacity and lifecycle. It shipped complete, with its own harness passing
-- 15/15 — and no application code ever read or wrote it. The participant
-- journey went on running through `teams.invite_token` → `resolve_join_token`
-- → `getActiveQuestionnaire()`.
--
-- That left the invariant 00044 was built for UNENFORCED. A participant's
-- questionnaire was resolved as "whichever version is active right now", not
-- "the version this campaign pinned". It looked correct only because a unique
-- index permits exactly one active version per instrument, so "the active one"
-- happened to be deterministic. Seed a second version of any instrument and
-- two people in the same campaign answer different content and are compared as
-- though they had not.
--
-- This migration closes that, and does the three things the application layer
-- cannot do for itself.
--
-- WHY A `team_id` ON THE CAMPAIGN, RATHER THAN DROPPING `teams`.
--
-- A wellbeing campaign needs a ROSTER — who was invited, who is a member — and
-- `team_members` already is that roster. Every aggregate, cohort, suppression
-- floor, wave and readiness check in `lib/wellbeing/` reads it through
-- `team_id`. Rewriting all of that in the same change as the token, version
-- and lifecycle refactor would put the analytics layer and the participant
-- journey at risk in one step, for no gain to either.
--
-- So the campaign OWNS the campaign — identity, token, instrument, version,
-- capacity, lifecycle — and points at the `teams` row that carries its roster.
-- There is exactly one campaign system; `teams` is the membership container
-- underneath it, as it already was. DISC is untouched.
--
-- WHY THE CONVERSION ADOPTS THE OLD TOKEN.
--
-- Existing wellbeing teams have printed and forwarded join links. Rather than
-- keep a second resolver alive to honour them — the dual-read ambiguity this
-- work exists to remove — each converted campaign takes its team's existing
-- `invite_token` AS its `join_token`. A UUID satisfies the column's
-- `^[A-Za-z0-9_-]{24,64}$` check, so an old link keeps working through the ONE
-- new resolver, and nothing needs a fallback path.
-- ─────────────────────────────────────────────────────────────────────

/* ── 1 · the roster link ─────────────────────────────────────────────── */

alter table public.wellbeing_campaigns
  add column team_id uuid unique references public.teams (id) on delete restrict;

comment on column public.wellbeing_campaigns.team_id is
  'The teams row carrying this campaign''s participant roster. The campaign owns '
  'identity, token, instrument, pinned version, capacity and lifecycle; the team '
  'owns membership only.';

/* ── 2 · convert every existing wellbeing team into a campaign ───────── */
--
-- Provenance-preserving and idempotent. Each converted campaign keeps the
-- team's name, organisation, creator, capacity and join token, and pins the
-- version its instrument is serving AT CONVERSION TIME — which is the same
-- version its participants have been answering, because the old path resolved
-- by `is_active` and exactly one version per instrument may be active.
--
-- A team whose instrument has no active version is SKIPPED rather than pinned
-- to nothing: `version_id` is not nullable, and inventing a version for a
-- campaign nobody can serve would be worse than leaving it unconverted.
insert into public.wellbeing_campaigns
  (organization_id, instrument_key, version_id, created_by, name, status,
   participant_capacity, join_token, team_id, created_at)
select
  t.organization_id,
  t.wellbeing_instrument_key,
  v.id,
  t.created_by,
  coalesce(nullif(btrim(t.session_name), ''), t.name),
  case
    when t.archived_at is not null then 'archived'::public.wellbeing_campaign_status
    when t.join_enabled is false then 'closed'::public.wellbeing_campaign_status
    else 'active'::public.wellbeing_campaign_status
  end,
  t.wellbeing_pilot_capacity,
  t.invite_token::text,
  t.id,
  t.created_at
from public.teams t
join public.wellbeing_versions v
  on v.instrument_key = t.wellbeing_instrument_key and v.is_active
where t.assessment_type = 'wellbeing'
  and t.wellbeing_instrument_key is not null
  and not exists (select 1 from public.wellbeing_campaigns c where c.team_id = t.id);

-- `closed` requires a timestamp; the conversion above may have produced some.
update public.wellbeing_campaigns
   set closed_at = coalesce(closed_at, now())
 where status = 'closed' and closed_at is null;

/* ── 3 · attach existing history to its campaign ─────────────────────── */
--
-- A session or result that already belonged to a converted team now names the
-- campaign too. Nothing is rewritten: `instrument_key` and `version_id` on
-- those rows are left exactly as recorded, so a historical result keeps
-- reporting what it actually measured even if it disagrees with the pin.
update public.wellbeing_sessions s
   set campaign_id = c.id
  from public.wellbeing_campaigns c
 where c.team_id = s.team_id and s.campaign_id is null;

update public.wellbeing_results r
   set campaign_id = s.campaign_id
  from public.wellbeing_sessions s
 where s.id = r.session_id and r.campaign_id is null and s.campaign_id is not null;

/* ── 4 · capacity and lifecycle, enforced by the database ────────────── */
--
-- ─────────────────────────────────────────────────────────────────────
-- WHY A TRIGGER AND NOT AN APPLICATION CHECK.
--
-- `wellbeing_campaign_admits()` has existed since 00044 and is correct, but a
-- function nobody is obliged to call is advice, not enforcement. Two
-- participants racing for the last place both read "one place left" and both
-- insert.
--
-- So the rule runs inside the insert, and it takes a row lock on the campaign
-- BEFORE counting — the same shape as 00031's pilot control. The second
-- transaction queues behind the first and sees its row, so the final place can
-- be taken exactly once. This is what makes capacity server-authoritative
-- rather than a UI courtesy.
--
-- Lifecycle is enforced in the same place and for the same reason: a closed or
-- expired campaign must refuse admission even to a request that never touched
-- a disabled button.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.enforce_wellbeing_campaign_admission()
returns trigger language plpgsql as $$
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

  -- FOR UPDATE: serialise concurrent admissions to the same campaign.
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
  -- campaign's instrument or a version the campaign did not pin. This is the
  -- rule that makes `campaign.version_id` authoritative rather than advisory:
  -- however a session is created, it cannot disagree with its campaign.
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

-- Ordered after the pilot control by name so both run; neither supersedes the
-- other, and a campaign-backed team is governed by whichever is stricter.
create trigger wellbeing_campaign_admission
  before insert on public.wellbeing_sessions
  for each row execute function public.enforce_wellbeing_campaign_admission();

create index if not exists wellbeing_sessions_campaign_profile_idx
  on public.wellbeing_sessions (campaign_id, profile_id);

/* ── 5 · a result may not drift from its campaign ────────────────────── */
--
-- The session trigger above governs admission. This governs the OUTPUT: a
-- stored result naming a campaign must carry that campaign's instrument and
-- the version its own session ran. Provenance is checked where it is written,
-- so a result cannot be inserted claiming a campaign it did not come from.
create or replace function public.enforce_wellbeing_result_provenance()
returns trigger language plpgsql as $$
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

  -- The result belongs to the session's campaign, never to another.
  if new.campaign_id is distinct from v_session_campaign then
    raise exception using
      errcode = 'check_violation',
      message = 'Result campaign does not match its session''s campaign.',
      hint = 'RESULT_CAMPAIGN_MISMATCH';
  end if;

  -- And it reports what the session actually ran.
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

create trigger wellbeing_results_provenance
  before insert on public.wellbeing_results
  for each row execute function public.enforce_wellbeing_result_provenance();

/* ── 6 · the token lookup gains the id the app needs after auth ──────── */
--
-- 00044's `wellbeing_campaign_by_token` returns exactly what an UNAUTHENTICATED
-- scanner may see, and that is still what it returns. `capacity_reached` is
-- added because a full campaign must be able to say so on the invitation
-- rather than after somebody has signed in — it is a boolean about the
-- campaign, and discloses no count, no roster and no identity.
--
-- Dropped and recreated rather than replaced: `create or replace` cannot widen
-- a set-returning function's row type, and adding a column is widening it.
drop function if exists public.wellbeing_campaign_by_token(text);

create function public.wellbeing_campaign_by_token(token text)
returns table (
  campaign_id uuid,
  campaign_name text,
  organization_name text,
  instrument_key text,
  version_id uuid,
  status public.wellbeing_campaign_status,
  is_open boolean,
  capacity_reached boolean
)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, o.name, c.instrument_key, c.version_id, c.status,
         (c.status = 'active' and (c.expires_at is null or c.expires_at > now())),
         (c.participant_capacity is not null and (
            select count(distinct s.profile_id)
              from public.wellbeing_sessions s
             where s.campaign_id = c.id
          ) >= c.participant_capacity)
  from public.wellbeing_campaigns c
  join public.organizations o on o.id = c.organization_id
  where c.join_token = token;
$$;

revoke all on function public.wellbeing_campaign_by_token(text) from public;
grant execute on function public.wellbeing_campaign_by_token(text) to anon, authenticated;

do $$
declare
  converted int;
  attached int;
begin
  select count(*) into converted from public.wellbeing_campaigns where team_id is not null;
  select count(*) into attached from public.wellbeing_sessions where campaign_id is not null;
  raise notice 'wellbeing campaign adoption: % campaign(s) carry a roster, % session(s) attached; '
               'admission, capacity, lifecycle and provenance are now enforced by the database',
               converted, attached;
end $$;
