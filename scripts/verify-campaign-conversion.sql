-- Wellbeing campaign conversion — the production edge case, reproduced.
--
-- Runs entirely inside one transaction that is ROLLED BACK, so it leaves no
-- data behind and is safe to re-run against any local database.
--
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f scripts/verify-campaign-conversion.sql
--
-- Never point this at a hosted database. It writes (and rolls back) rows.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT THIS REPRODUCES.
--
-- Production, after 00032 reported success:
--
--   a team with wellbeing_instrument_key set
--   assessment_type = 'disc'
--   one assessment_sessions row: in_progress, current_index 0, ZERO responses
--
-- 00032's backfill skipped that team because a session existed. The session
-- existed because the mislabelled team routed a wellbeing QR into the DISC
-- join form. The artefact of the fault blocked the fault's repair, and a
-- `raise warning` let the migration report success anyway.
--
-- CASE A proves 00037 converts that team.
-- CASE B proves it REFUSES a team holding real DISC history, and destroys
--        none of it — the failure mode that would be far worse than the bug.
--
-- Both cases are built by disabling the campaign-type trigger, because that is
-- the only way to recreate a state 00037 now makes unrepresentable.
-- ─────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

do $guard$
begin
  if coalesce(current_database(), '') <> 'postgres' then
    raise exception 'Refusing to run the conversion harness against database %', current_database();
  end if;
  -- Loopback, or a private (RFC1918 / Docker) address. A hosted Supabase
  -- instance is on neither, so this refuses anything reachable from outside.
  if inet_server_addr() is not null
     and not (inet_server_addr() <<= inet '127.0.0.0/8'
           or inet_server_addr() <<= inet '10.0.0.0/8'
           or inet_server_addr() <<= inet '172.16.0.0/12'
           or inet_server_addr() <<= inet '192.168.0.0/16') then
    raise exception 'Refusing to run the conversion harness against non-local host %', inet_server_addr();
  end if;
end;
$guard$;
\set QUIET on
set client_min_messages to notice;

begin;

create temporary table cc_check (
  id serial primary key,
  name text not null,
  passed boolean not null,
  detail text
) on commit drop;

create or replace function pg_temp.record(p_name text, p_passed boolean, p_detail text default null)
returns void language plpgsql as $$
begin
  insert into cc_check (name, passed, detail) values (p_name, p_passed, p_detail);
  raise notice '% — %', case when p_passed then 'PASS' else 'FAIL' end, p_name;
end;
$$;

/* ── fixtures ────────────────────────────────────────────────────────── */

do $fix$
declare
  v_org       uuid := gen_random_uuid();
  v_owner     uuid := gen_random_uuid();
  v_pilot     uuid := '11111111-1111-4111-8111-111111111111';
  v_real      uuid := '22222222-2222-4222-8222-222222222222';
  v_part_a    uuid := '33333333-3333-4333-8333-333333333333';
  v_part_b    uuid := '44444444-4444-4444-8444-444444444444';
  v_session_a uuid := '55555555-5555-4555-8555-555555555555';
  v_session_b uuid := '66666666-6666-4666-8666-666666666666';
  v_version   uuid;
begin
  insert into auth.users (id, email) values
    (v_owner,  'owner@example.test'),
    (v_part_a, 'a@example.test'),
    (v_part_b, 'b@example.test');

  insert into public.organizations (id, name, created_by)
  values (v_org, 'Conversion Harness Org', v_owner);

  select id into v_version from public.assessment_versions order by created_at limit 1;

  -- The trigger AND the constraint are what make the broken state
  -- unreachable, so both are lifted to build it — exactly the state 00032 left
  -- behind in production. That they have to be lifted at all is the first
  -- proof: after 00037 this state cannot be written by any ordinary path.
  alter table public.teams drop constraint teams_wellbeing_type_is_explicit;
  alter table public.teams disable trigger wellbeing_campaign_type;

  -- CASE A · the Management Pilot, reproduced.
  insert into public.teams (id, organization_id, name, team_code, created_by, assessment_type, wellbeing_instrument_key)
  values (v_pilot, v_org, 'Wellbeing Pulse — Pilot (harness)', 'HARNSA', v_owner, 'disc', 'disc360_wellbeing_v1');

  -- CASE B · a team carrying REAL DISC history that also acquired an
  -- instrument. This must never be silently reclassified.
  insert into public.teams (id, organization_id, name, team_code, created_by, assessment_type, wellbeing_instrument_key)
  values (v_real, v_org, 'Real DISC Team (harness)', 'HARNSB', v_owner, 'disc', 'disc360_wellbeing_v1');

  alter table public.teams enable trigger wellbeing_campaign_type;

  insert into public.team_members (team_id, profile_id, display_name, email, role)
  values
    (v_pilot, v_part_a, 'Participant A', 'a@example.test', 'member'),
    (v_real,  v_part_b, 'Participant B', 'b@example.test', 'member');

  -- CASE A's session: in_progress, current_index 0, and NO responses. The
  -- footprint of opening a page, which 00032 mistook for history.
  insert into public.assessment_sessions (id, profile_id, version_id, team_id, status, current_index)
  values (v_session_a, v_part_a, v_version, v_pilot, 'in_progress', 0);

  -- CASE B's session: completed, with real answers and a real result.
  insert into public.assessment_sessions (id, profile_id, version_id, team_id, status, current_index, completed_at)
  values (v_session_b, v_part_b, v_version, v_real, 'completed', 24, now());

  -- Three real answers, each picking two DIFFERENT options of the same
  -- question — MOST <> LEAST is enforced by the schema.
  insert into public.assessment_responses (session_id, question_id, most_option_id, least_option_id)
  select v_session_b, q.id,
         (select o.id from public.question_options o where o.question_id = q.id order by o.id limit 1),
         (select o.id from public.question_options o where o.question_id = q.id order by o.id desc limit 1)
  from public.questions q
  where q.version_id = v_version
  order by q.position
  limit 3;

  insert into public.assessment_results (
    session_id, profile_id, score_d, score_i, score_s, score_c,
    archetype_code, primary_dimension, secondary_dimension,
    intensity, raw_most, raw_least, net
  ) values (
    v_session_b, v_part_b, 72, 40, 30, 55,
    'DC', 'D', 'C',
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
  );
end;
$fix$;

/* ── the state 00037 inherits ────────────────────────────────────────── */

do $pre$
begin
  perform pg_temp.record(
    'reproduced: the pilot is a wellbeing campaign typed as DISC',
    (select assessment_type::text from public.teams where id = '11111111-1111-4111-8111-111111111111') = 'disc'
    and (select wellbeing_instrument_key from public.teams where id = '11111111-1111-4111-8111-111111111111') is not null
  );
  perform pg_temp.record(
    'reproduced: its one session is empty (in_progress, index 0, 0 responses)',
    (select count(*) from public.assessment_sessions where team_id = '11111111-1111-4111-8111-111111111111') = 1
    and (select count(*) from public.assessment_responses r
         join public.assessment_sessions s on s.id = r.session_id
         where s.team_id = '11111111-1111-4111-8111-111111111111') = 0
  );
  perform pg_temp.record(
    'reproduced: the DISC team holds a real completed result',
    (select count(*) from public.assessment_results ar
     join public.assessment_sessions s on s.id = ar.session_id
     where s.team_id = '22222222-2222-4222-8222-222222222222') = 1
  );
  -- 00032's own predicate, restated: it skips BOTH teams, which is the bug.
  perform pg_temp.record(
    '00032''s guard would skip the pilot (this is the defect)',
    exists (select 1 from public.assessment_sessions where team_id = '11111111-1111-4111-8111-111111111111')
  );
  -- 00037's predicate tells them apart.
  perform pg_temp.record(
    '00037 sees no work on the pilot',
    public.team_holds_assessment_work('11111111-1111-4111-8111-111111111111') = false
  );
  perform pg_temp.record(
    '00037 sees real work on the DISC team',
    public.team_holds_assessment_work('22222222-2222-4222-8222-222222222222') = true
  );
end;
$pre$;

/* ── CASE A · the pilot converts ─────────────────────────────────────── */

do $case_a$
declare v_type text;
begin
  update public.teams t
  set assessment_type = 'wellbeing'
  where t.wellbeing_instrument_key is not null
    and t.assessment_type <> 'wellbeing'
    and not public.team_holds_assessment_work(t.id);

  select assessment_type::text into v_type
  from public.teams where id = '11111111-1111-4111-8111-111111111111';

  perform pg_temp.record('CASE A · the pilot is now a wellbeing campaign', v_type = 'wellbeing', v_type);

  perform pg_temp.record(
    'CASE A · the participant survives',
    exists (select 1 from public.profiles where id = '33333333-3333-4333-8333-333333333333')
  );
  perform pg_temp.record(
    'CASE A · their membership survives',
    exists (select 1 from public.team_members
            where profile_id = '33333333-3333-4333-8333-333333333333'
              and team_id = '11111111-1111-4111-8111-111111111111')
  );
  perform pg_temp.record(
    'CASE A · the campaign survives',
    exists (select 1 from public.teams where id = '11111111-1111-4111-8111-111111111111')
  );
  perform pg_temp.record(
    'CASE A · no reconciliation reason is recorded — nothing was ambiguous',
    (select wellbeing_conversion_blocked_reason from public.teams
     where id = '11111111-1111-4111-8111-111111111111') is null
  );
end;
$case_a$;

/* ── CASE B · real DISC history is refused, and survives intact ──────── */

do $case_b$
declare
  v_type      text;
  v_reason    text;
  v_results   int;
  v_responses int;
  v_refused   boolean := false;
begin
  -- The corrective backfill must have left it alone.
  select assessment_type::text, wellbeing_conversion_blocked_reason
  into v_type, v_reason
  from public.teams where id = '22222222-2222-4222-8222-222222222222';

  perform pg_temp.record('CASE B · the DISC team was NOT reclassified', v_type = 'disc', v_type);

  update public.teams t
  set wellbeing_conversion_blocked_reason = 'Carries a wellbeing instrument but also holds DISC or Focus results.'
  where t.wellbeing_instrument_key is not null
    and t.assessment_type <> 'wellbeing'
    and t.wellbeing_conversion_blocked_reason is null;

  select wellbeing_conversion_blocked_reason into v_reason
  from public.teams where id = '22222222-2222-4222-8222-222222222222';

  perform pg_temp.record(
    'CASE B · it is marked as requiring explicit reconciliation',
    v_reason is not null, v_reason
  );

  -- 00037 re-adds the constraint LAST, once the backfill has settled every
  -- row. Re-adding it here validates the settled state: if either case had
  -- been left silent, this statement would fail.
  alter table public.teams
    add constraint teams_wellbeing_type_is_explicit
    check (
      wellbeing_instrument_key is null
      or assessment_type = 'wellbeing'
      or wellbeing_conversion_blocked_reason is not null
    );
  perform pg_temp.record('the constraint validates every settled row', true);

  -- And a direct attempt to convert it must be REFUSED by the trigger, not
  -- silently accepted the way 00032's trigger would have accepted it.
  begin
    update public.teams
    set assessment_type = 'wellbeing'
    where id = '22222222-2222-4222-8222-222222222222';
  exception
    when check_violation then v_refused := true;
  end;
  perform pg_temp.record('CASE B · a direct conversion attempt is refused', v_refused);

  -- Nothing was destroyed.
  select count(*) into v_results
  from public.assessment_results ar
  join public.assessment_sessions s on s.id = ar.session_id
  where s.team_id = '22222222-2222-4222-8222-222222222222';
  select count(*) into v_responses
  from public.assessment_responses r
  join public.assessment_sessions s on s.id = r.session_id
  where s.team_id = '22222222-2222-4222-8222-222222222222';

  perform pg_temp.record('CASE B · its DISC result is intact', v_results = 1, v_results::text);
  perform pg_temp.record('CASE B · its DISC answers are intact', v_responses = 3, v_responses::text);
  perform pg_temp.record(
    'CASE B · its completed session is intact',
    (select status::text from public.assessment_sessions
     where id = '66666666-6666-4666-8666-666666666666') = 'completed'
  );
end;
$case_b$;

/* ── the invariant, and the constraint that holds it ─────────────────── */

do $invariant$
declare
  v_silent  int;
  v_blocked boolean := false;
begin
  select count(*) into v_silent
  from public.teams t
  where t.wellbeing_instrument_key is not null
    and t.assessment_type <> 'wellbeing'
    and t.wellbeing_conversion_blocked_reason is null;

  perform pg_temp.record('no campaign is left silently typed as DISC', v_silent = 0, v_silent::text);

  -- The silent state must now be unrepresentable, not merely absent.
  begin
    alter table public.teams disable trigger wellbeing_campaign_type;
    update public.teams
    set assessment_type = 'disc', wellbeing_conversion_blocked_reason = null
    where id = '11111111-1111-4111-8111-111111111111';
    alter table public.teams enable trigger wellbeing_campaign_type;
  exception
    when check_violation then
      v_blocked := true;
      alter table public.teams enable trigger wellbeing_campaign_type;
  end;
  perform pg_temp.record(
    'the check constraint refuses the silent state even with the trigger off',
    v_blocked
  );
end;
$invariant$;

/* ── a brand-new campaign is typed correctly on insert ───────────────── */

do $insert$
declare
  v_new uuid := gen_random_uuid();
  v_org uuid;
  v_own uuid;
begin
  select organization_id, created_by into v_org, v_own
  from public.teams where id = '11111111-1111-4111-8111-111111111111';

  insert into public.teams (id, organization_id, name, team_code, created_by, assessment_type, wellbeing_instrument_key)
  values (v_new, v_org, 'Fresh campaign (harness)', 'HARNSC', v_own, 'disc', 'disc360_wellbeing_v1');

  perform pg_temp.record(
    'a new campaign carrying an instrument is typed wellbeing on insert',
    (select assessment_type::text from public.teams where id = v_new) = 'wellbeing'
  );
end;
$insert$;

/* ── verdict ─────────────────────────────────────────────────────────── */

do $verdict$
declare
  v_failed int;
  v_total  int;
  r        record;
begin
  select count(*) filter (where not passed), count(*) into v_failed, v_total from cc_check;
  raise notice '────────────────────────────────────────';
  if v_failed > 0 then
    for r in select name, detail from cc_check where not passed loop
      raise notice 'FAILED: % (%)', r.name, coalesce(r.detail, 'no detail');
    end loop;
    raise exception '% of % conversion checks FAILED', v_failed, v_total;
  end if;
  raise notice 'all % conversion checks passed', v_total;
end;
$verdict$;

rollback;
