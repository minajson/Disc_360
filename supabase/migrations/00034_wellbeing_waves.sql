-- A wellbeing wave is a THING, not a date range inferred at read time.
--
-- ─────────────────────────────────────────────────────────────────────
-- THE DEFECT THIS FIXES.
--
-- Until now a "wave" was computed from `completed_at` by rounding to a
-- calendar quarter. That is not an identity — it is a grouping rule that
-- happens to look like one while every campaign runs at most one pulse a
-- quarter.
--
-- It fails on the first real programme. A baseline in August 2026 and a
-- post-intervention pulse in September 2026 are two distinct measurements of
-- the same workforce, taken either side of something the organisation did.
-- Both land in Q3 2026, so the quarter rule silently merges them into one
-- number — destroying precisely the comparison the programme existed to make,
-- and doing it invisibly, because a merged wave looks exactly like a wave.
--
-- Nothing downstream could detect it either: suppression, trends, cohort
-- movement and the presentation deck all consumed the merged bucket.
--
-- WHY A TABLE RATHER THAN A LABEL COLUMN ON RESULTS.
--
-- A wave has properties of its own — when it opened, when it closed, what it
-- was called, where it sits in the campaign's sequence — and those must be
-- editable (a facilitator renames "Wave 2" to "Post-intervention") WITHOUT
-- touching a single completed result. A label on the result would make every
-- rename a rewrite of history.
--
-- WHAT IS IMMUTABLE, AND ENFORCED AS SUCH.
--
--  · A result's wave_id. Once a person's answers are counted in a wave they
--    stay in it, permanently. A campaign's dates changing must never move a
--    historical result.
--  · A wave's number and its campaign. The label and the dates may be
--    corrected; the identity may not.
--
-- Both are triggers, not conventions, because `wellbeing_results` is written
-- with the service role and RLS is not in the way there.
--
-- QUARTERS DO NOT DISAPPEAR — THEY BECOME A VIEW.
--
-- Monthly, quarterly and annual grouping remain available in reporting as an
-- EXPLICIT transformation the reader asks for. What is gone is quarter as the
-- default identity of a wave.
-- ─────────────────────────────────────────────────────────────────────

/* ── 1 · the wave ────────────────────────────────────────────────────── */

create table public.wellbeing_waves (
  id uuid primary key default gen_random_uuid(),

  -- The campaign this wave belongs to. A wave cannot exist without one:
  -- "wave" is an occurrence of a campaign, not a period on a calendar.
  team_id uuid not null references public.teams (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,

  -- 1-based, immutable, unique within the campaign. This is the identity.
  wave_number int not null check (wave_number >= 1),

  -- What the facilitator calls it. Free text and freely editable, because it
  -- is a label and not an identifier — renaming it moves no result.
  label text not null default '',

  opened_at timestamptz not null default now(),
  -- Null while the wave is still collecting responses.
  closed_at timestamptz,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint wellbeing_waves_number_unique unique (team_id, wave_number),
  constraint wellbeing_waves_dates check (closed_at is null or closed_at >= opened_at)
);

create trigger wellbeing_waves_updated before update on public.wellbeing_waves
  for each row execute function public.set_updated_at();

create index wellbeing_waves_team_idx on public.wellbeing_waves (team_id, wave_number);
create index wellbeing_waves_org_idx on public.wellbeing_waves (organization_id, opened_at);
-- At most ONE open wave per campaign: two open waves would make "which wave
-- does this response belong to" ambiguous at the moment it matters.
create unique index wellbeing_waves_one_open_idx
  on public.wellbeing_waves (team_id) where closed_at is null;

comment on table public.wellbeing_waves is
  'An occurrence of a wellbeing campaign. The immutable identity a result is counted in — never derived from a calendar quarter.';

/* ── 2 · results and sessions carry the wave ─────────────────────────── */

alter table public.wellbeing_sessions
  add column wave_id uuid references public.wellbeing_waves (id) on delete set null;

alter table public.wellbeing_results
  add column wave_id uuid references public.wellbeing_waves (id) on delete restrict;

create index wellbeing_sessions_wave_idx on public.wellbeing_sessions (wave_id);
create index wellbeing_results_wave_idx on public.wellbeing_results (wave_id);
-- The lookup the wave trend and per-wave suppression both use.
create index wellbeing_results_wave_participants_idx
  on public.wellbeing_results (organization_id, instrument_key, wave_id, profile_id);

comment on column public.wellbeing_results.wave_id is
  'The campaign occurrence this result was completed in. Immutable — see wellbeing_result_wave_is_immutable().';

/* ── 3 · backfill: the implicit waves become explicit ────────────────── */
--
-- The ONLY wave identity that has ever existed for these rows is the quarter
-- they were grouped into, so that is what is materialised — one wave per
-- distinct quarter per campaign, in chronological order. This changes no
-- reported figure; it makes the grouping that was being recomputed on every
-- request into a row that can no longer drift.
--
-- Nothing is merged that was previously separate, and nothing is separated
-- that was previously merged. From here on new waves are explicit.

with quarters as (
  select
    r.team_id,
    r.organization_id,
    date_trunc('quarter', r.completed_at) as quarter,
    min(r.completed_at) as opened_at,
    max(r.completed_at) as closed_at
  from public.wellbeing_results r
  where r.team_id is not null and r.organization_id is not null
  group by 1, 2, 3
),
numbered as (
  select *, row_number() over (partition by team_id order by quarter) as wave_number
  from quarters
)
insert into public.wellbeing_waves
  (team_id, organization_id, wave_number, label, opened_at, closed_at)
select
  team_id,
  organization_id,
  wave_number,
  -- Left blank rather than invented. The reader sees "Wave 1 · August 2026",
  -- derived from opened_at, instead of a label nobody chose.
  '',
  opened_at,
  closed_at
from numbered;

update public.wellbeing_results r
set wave_id = w.id
from public.wellbeing_waves w
where r.team_id = w.team_id
  and r.wave_id is null
  and r.completed_at >= w.opened_at
  and r.completed_at <= w.closed_at;

update public.wellbeing_sessions s
set wave_id = r.wave_id
from public.wellbeing_results r
where r.session_id = s.id and s.wave_id is null;

do $$
declare
  v_orphans int;
begin
  select count(*) into v_orphans
  from public.wellbeing_results
  where team_id is not null and wave_id is null;
  if v_orphans > 0 then
    raise exception 'Backfill left % campaign result(s) with no wave', v_orphans;
  end if;
end;
$$;

/* ── 4 · every new response lands in a wave, without app code ────────── */
--
-- Resolving the wave in the database rather than in a server action is what
-- makes "no result exists outside a wave" structural. There is no code path
-- that inserts a session or a result, now or later, that can forget it.

create or replace function public.wellbeing_open_wave(p_team uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wave uuid;
  v_org uuid;
begin
  if p_team is null then return null; end if;

  select id into v_wave
  from public.wellbeing_waves
  where team_id = p_team and closed_at is null
  limit 1;
  if v_wave is not null then return v_wave; end if;

  -- No open wave: the campaign is collecting its first (or next) pulse.
  -- Opening one implicitly is correct — a facilitator who shares a QR code
  -- has begun a wave whether or not they pressed a button first.
  select organization_id into v_org from public.teams where id = p_team;
  if v_org is null then return null; end if;

  insert into public.wellbeing_waves (team_id, organization_id, wave_number, opened_at)
  values (
    p_team,
    v_org,
    coalesce((select max(wave_number) from public.wellbeing_waves where team_id = p_team), 0) + 1,
    now()
  )
  returning id into v_wave;

  return v_wave;
end;
$$;

revoke all on function public.wellbeing_open_wave(uuid) from public;
grant execute on function public.wellbeing_open_wave(uuid) to service_role, authenticated;

create or replace function public.wellbeing_session_wave()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.wave_id is null and new.team_id is not null then
    new.wave_id := public.wellbeing_open_wave(new.team_id);
  end if;
  return new;
end;
$$;

create trigger wellbeing_sessions_wave
  before insert on public.wellbeing_sessions
  for each row execute function public.wellbeing_session_wave();

create or replace function public.wellbeing_result_wave()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- The wave comes from the SESSION, not from today's open wave. A person who
  -- began a pulse before a wave closed and finished after it must be counted
  -- in the wave they answered, not in the next one.
  if new.wave_id is null then
    select s.wave_id into new.wave_id
    from public.wellbeing_sessions s where s.id = new.session_id;
  end if;
  return new;
end;
$$;

create trigger wellbeing_results_wave
  before insert on public.wellbeing_results
  for each row execute function public.wellbeing_result_wave();

/* ── 5 · history is immutable ────────────────────────────────────────── */

create or replace function public.wellbeing_result_wave_is_immutable()
returns trigger language plpgsql as $$
begin
  if new.wave_id is distinct from old.wave_id then
    raise exception
      'A completed wellbeing result cannot be moved to another wave (result %)', old.id
      using hint = 'WELLBEING_HISTORY_IMMUTABLE';
  end if;
  if new.completed_at is distinct from old.completed_at then
    raise exception
      'A completed wellbeing result cannot be re-dated (result %)', old.id
      using hint = 'WELLBEING_HISTORY_IMMUTABLE';
  end if;
  return new;
end;
$$;

create trigger wellbeing_results_immutable
  before update on public.wellbeing_results
  for each row execute function public.wellbeing_result_wave_is_immutable();

create or replace function public.wellbeing_wave_identity_is_immutable()
returns trigger language plpgsql as $$
begin
  if new.wave_number is distinct from old.wave_number then
    raise exception 'A wave number is its identity and cannot change (wave %)', old.id
      using hint = 'WELLBEING_HISTORY_IMMUTABLE';
  end if;
  if new.team_id is distinct from old.team_id then
    raise exception 'A wave cannot move between campaigns (wave %)', old.id
      using hint = 'WELLBEING_HISTORY_IMMUTABLE';
  end if;
  return new;
end;
$$;

create trigger wellbeing_waves_immutable
  before update on public.wellbeing_waves
  for each row execute function public.wellbeing_wave_identity_is_immutable();

/* ── 6 · RLS ─────────────────────────────────────────────────────────── */
--
-- A wave carries no wellbeing data — a campaign id, a number, a label and two
-- dates. Reading it is reading the campaign's schedule, so it follows team
-- membership. Writing it is running the campaign, so it follows team
-- administration.

alter table public.wellbeing_waves enable row level security;

create policy wellbeing_waves_select on public.wellbeing_waves
  for select to authenticated
  using (
    exists (
      select 1 from public.team_members m
      where m.team_id = wellbeing_waves.team_id and m.profile_id = auth.uid()
    )
    or public.is_team_admin(wellbeing_waves.team_id)
  );

create policy wellbeing_waves_insert on public.wellbeing_waves
  for insert to authenticated
  with check (public.is_team_admin(wellbeing_waves.team_id));

create policy wellbeing_waves_update on public.wellbeing_waves
  for update to authenticated
  using (public.is_team_admin(wellbeing_waves.team_id))
  with check (public.is_team_admin(wellbeing_waves.team_id));

-- No DELETE policy. A wave with results behind it is history, and the
-- restrict FK on wellbeing_results.wave_id refuses the delete anyway.

/* ── 7 · participant counts gain a wave scope ────────────────────────── */
--
-- Suppression is counted in PEOPLE, inside the database, so no identifier
-- reaches the analytics layer (00030). The wave scope belongs there for the
-- same reason: an organisation-wide wave spans campaigns, so the same person
-- could appear in two of that period's campaigns and counting rows would
-- double them.

drop function if exists public.wellbeing_participant_counts(uuid, text, uuid);

create function public.wellbeing_participant_counts(
  p_organization uuid,
  p_instrument text,
  p_team uuid default null,
  p_wave uuid default null
)
returns table (scope text, cohort text, participants int)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select r.profile_id,
           r.department_at_completion,
           r.work_location_at_completion,
           r.office_location_at_completion,
           r.team_id,
           r.wave_id
    from public.wellbeing_results r
    where r.organization_id = p_organization
      and r.instrument_key = p_instrument
      and (p_team is null or r.team_id = p_team)
      and (p_wave is null or r.wave_id = p_wave)
  )
  select 'overall'::text, ''::text, count(distinct s.profile_id)::int from scoped s

  union all

  select 'department', coalesce(s.department_at_completion, ''), count(distinct s.profile_id)::int
  from scoped s where s.department_at_completion is not null
  group by s.department_at_completion

  union all

  select 'work_location', s.work_location_at_completion::text, count(distinct s.profile_id)::int
  from scoped s where s.work_location_at_completion is not null
  group by s.work_location_at_completion

  union all

  select 'office_location', coalesce(s.office_location_at_completion, ''), count(distinct s.profile_id)::int
  from scoped s where s.office_location_at_completion is not null
  group by s.office_location_at_completion

  union all

  select 'team', s.team_id::text, count(distinct s.profile_id)::int
  from scoped s where s.team_id is not null
  group by s.team_id

  union all

  -- Distinct PEOPLE per wave. Within one campaign wave a person answers once,
  -- but an organisation-wide wave view spans campaigns, where they may not.
  select 'wave', s.wave_id::text, count(distinct s.profile_id)::int
  from scoped s where s.wave_id is not null
  group by s.wave_id;
$$;

revoke all on function public.wellbeing_participant_counts(uuid, text, uuid, uuid) from public;
grant execute on function public.wellbeing_participant_counts(uuid, text, uuid, uuid) to service_role;

comment on function public.wellbeing_participant_counts(uuid, text, uuid, uuid) is
  'Distinct PARTICIPANT counts per cohort, for suppression. Returns integers only — no identifier leaves the database. p_team narrows to one campaign; p_wave to one wave.';
