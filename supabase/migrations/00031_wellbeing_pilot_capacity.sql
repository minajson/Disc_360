-- Controlled pilot capacity for a Wellbeing Pulse campaign.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT.
--
-- This is CAMPAIGN GOVERNANCE: how many distinct people a particular campaign
-- will admit. It is not part of any instrument, and it must never become one.
-- Nothing here appears in scoring, thresholds, analytics formulas, history,
-- reports or questionnaire definitions, and setting the capacity back to NULL
-- lifts the cap without altering a single stored result or changing how any
-- figure is computed. A number that governs admission must not leak into a
-- number that describes wellbeing.
--
-- WHY THE DATABASE ENFORCES IT.
--
-- A disabled button is not a capacity control. A replayed request, a second
-- browser tab, a script or a future refactor all reach the insert directly, so
-- the guarantee has to live where the row is written.
--
-- WHY IT COUNTS PEOPLE, AND LOCKS.
--
-- The unit is a distinct participant identity — not sessions, attempts,
-- results or email addresses. Someone retaking their own pulse is still one
-- participant and must never consume a second place, and a participant who has
-- already joined must always be able to finish, return, and read their own
-- history however full the campaign becomes.
--
-- Counting without locking would be a race: two people submitting at the same
-- moment both read "9 joined" and both insert, and the campaign holds eleven.
-- The trigger therefore takes a row lock on the campaign first, which
-- serialises concurrent joins to that campaign and leaves joins to every other
-- campaign untouched.
-- ─────────────────────────────────────────────────────────────────────

-- NULL means no cap. That is the default, so every existing campaign is
-- unrestricted and nothing already running changes behaviour.
alter table public.teams
  add column wellbeing_pilot_capacity int
    check (wellbeing_pilot_capacity is null or wellbeing_pilot_capacity >= 1);

comment on column public.teams.wellbeing_pilot_capacity is
  'Maximum DISTINCT participants a Wellbeing Pulse campaign will admit. NULL = unrestricted. Campaign governance only — never an input to scoring or analytics.';

-- The count is per (campaign, person), so give it its own lookup path.
create index if not exists wellbeing_sessions_team_profile_idx
  on public.wellbeing_sessions (team_id, profile_id);

create or replace function public.enforce_wellbeing_pilot_capacity()
returns trigger language plpgsql as $$
declare
  v_capacity int;
  v_joined int;
begin
  -- A solo attempt belongs to no campaign, so no campaign governs it.
  if new.team_id is null then
    return new;
  end if;

  -- Lock the campaign row BEFORE counting. Two simultaneous joins to the same
  -- campaign now queue behind each other and the second sees the first.
  select t.wellbeing_pilot_capacity into v_capacity
  from public.teams t
  where t.id = new.team_id
  for update;

  -- Unrestricted campaign, or none found: nothing to enforce.
  if v_capacity is null then
    return new;
  end if;

  -- A participant who already holds a place keeps it. This is what lets
  -- someone retake, resume or return after the campaign is full, and it is
  -- why the check is by identity rather than by row count.
  if exists (
    select 1 from public.wellbeing_sessions s
    where s.team_id = new.team_id and s.profile_id = new.profile_id
  ) then
    return new;
  end if;

  select count(distinct s.profile_id) into v_joined
  from public.wellbeing_sessions s
  where s.team_id = new.team_id;

  if v_joined >= v_capacity then
    -- The hint is a stable machine-readable marker: the application turns it
    -- into a courteous message rather than parsing prose that may be reworded.
    raise exception using
      errcode = 'check_violation',
      message = format(
        'Wellbeing pilot capacity reached: %s of %s places are taken.', v_joined, v_capacity),
      hint = 'PILOT_CAPACITY_REACHED';
  end if;

  return new;
end;
$$;

create trigger wellbeing_pilot_capacity
  before insert on public.wellbeing_sessions
  for each row execute function public.enforce_wellbeing_pilot_capacity();

-- Reading the pilot's state, without reading anybody's data.
--
-- Returns four integers and nothing else — no profile id, no name, no score.
-- The facilitator dashboard needs "8 of 10 joined, 5 completed"; it does not
-- need, and must not receive, who those people are.
--
-- SECURITY DEFINER because wellbeing_sessions is own-row under RLS by design;
-- the caller is authorised as a team admin before this is invoked, and the
-- campaign is passed in rather than inferred.
create or replace function public.wellbeing_pilot_status(p_team uuid)
returns table (capacity int, joined int, completed int, in_progress int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select t.wellbeing_pilot_capacity from public.teams t where t.id = p_team),
    (select count(distinct s.profile_id)::int
       from public.wellbeing_sessions s where s.team_id = p_team),
    (select count(distinct s.profile_id)::int
       from public.wellbeing_sessions s
      where s.team_id = p_team and s.status = 'completed'),
    -- Deliberately EXCLUDES anyone who has already completed, so that a
    -- participant who finished and then retook is not counted twice and
    -- `completed + in_progress` never exceeds `joined`. "In progress" on a
    -- pilot dashboard means "still owes us a first response".
    (select count(distinct s.profile_id)::int
       from public.wellbeing_sessions s
      where s.team_id = p_team and s.status = 'in_progress'
        and not exists (
          select 1 from public.wellbeing_sessions done
          where done.team_id = p_team and done.profile_id = s.profile_id
            and done.status = 'completed'));
$$;

revoke all on function public.wellbeing_pilot_status(uuid) from public;
grant execute on function public.wellbeing_pilot_status(uuid) to service_role;
