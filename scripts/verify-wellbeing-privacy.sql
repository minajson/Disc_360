-- Wellbeing Pulse — adversarial schema and privacy harness.
--
-- Runs entirely inside one transaction that is ROLLED BACK, so it leaves no
-- data behind and is safe to re-run against any local database.
--
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--     -f scripts/verify-wellbeing-privacy.sql
--
-- Never point this at a hosted database. It writes (and rolls back) rows.
--
-- What it proves, case by case, is what the Wellbeing Pulse privacy model
-- claims: an individual's screening data is readable by that individual and
-- by nobody else — including the platform super administrator, for whom both
-- is_super_admin() and is_team_admin() return true everywhere.

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

begin;

create temporary table wb_check (
  id serial primary key,
  name text not null,
  passed boolean not null,
  detail text
) on commit drop;

create or replace function pg_temp.record(p_name text, p_passed boolean, p_detail text default null)
returns void language plpgsql as $$
begin
  insert into wb_check (name, passed, detail) values (p_name, p_passed, p_detail);
  raise notice '% — %', case when p_passed then 'PASS' else 'FAIL' end, p_name;
end;
$$;

/* Runs a statement that MUST be rejected by the database. */
create or replace function pg_temp.expect_rejected(p_name text, p_sql text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
    perform pg_temp.record(p_name, false, 'statement was accepted but should have been rejected');
  exception
    when check_violation or unique_violation or not_null_violation or foreign_key_violation then
      perform pg_temp.record(p_name, true, sqlerrm);
  end;
end;
$$;

/* Runs a statement that MUST be accepted. */
create or replace function pg_temp.expect_accepted(p_name text, p_sql text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
    perform pg_temp.record(p_name, true, null);
  exception when others then
    perform pg_temp.record(p_name, false, sqlerrm);
  end;
end;
$$;

/* Evaluates a boolean expression AS a given user, and asserts it is true. */
create or replace function pg_temp.expect_true_as(p_name text, p_user uuid, p_sql text)
returns void language plpgsql as $$
declare
  actual boolean;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  execute p_sql into actual;
  perform set_config('role', 'postgres', true);
  perform pg_temp.record(p_name, coalesce(actual, false),
    format('evaluated to %s', coalesce(actual::text, 'null')));
end;
$$;

/* Reads a count as a given user, under RLS, and asserts it. */
create or replace function pg_temp.expect_visible_count(
  p_name text, p_user uuid, p_sql text, p_expected bigint
) returns void language plpgsql as $$
declare
  actual bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  execute p_sql into actual;
  perform set_config('role', 'postgres', true);
  perform pg_temp.record(p_name, actual = p_expected,
    format('expected %s, saw %s', p_expected, actual));
end;
$$;

/* Runs a statement AS a given user that MUST be refused — RLS included. */
create or replace function pg_temp.expect_rejected_as(p_name text, p_user uuid, p_sql text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    execute p_sql;
    perform set_config('role', 'postgres', true);
    perform pg_temp.record(p_name, false, 'statement was accepted but should have been refused');
  exception when others then
    perform set_config('role', 'postgres', true);
    perform pg_temp.record(p_name, true, sqlerrm);
  end;
end;
$$;

do $harness$
declare
  v_team uuid;
  v_org uuid;
  v_alice uuid;
  v_bob uuid;
  v_super uuid;
  v_version uuid := '00000000-0000-4000-8000-0000000000e1';
  v_alice_session uuid := 'aaaa0000-0000-4000-8000-000000000001';
  v_bob_session uuid := 'bbbb0000-0000-4000-8000-000000000001';
  v_spare uuid := 'cccc0000-0000-4000-8000-000000000001';
  v_org_a uuid;
  v_org_b uuid;
  v_member_a uuid;
  v_member_b uuid;
  v_floor int;
begin
  select t.id, t.organization_id into v_team, v_org from public.teams t limit 1;
  select id into v_super from public.profiles where is_super_admin order by email limit 1;
  select id into v_alice from public.profiles where not is_super_admin order by email limit 1;
  select id into v_bob from public.profiles where not is_super_admin and id <> v_alice
    order by email limit 1;

  /* ── fixture: two people complete a pulse on the same team ────────── */

  insert into public.wellbeing_sessions
    (id, profile_id, version_id, instrument_key, team_id, organization_id, status,
     consent_given, consent_at, department_name, work_location, office_location_name, completed_at)
  values
    (v_alice_session, v_alice, v_version, 'ghq12', v_team, v_org, 'completed', true, now(),
     'Production', 'office_based', 'Port Harcourt', now()),
    (v_bob_session, v_bob, v_version, 'ghq12', v_team, v_org, 'completed', true, now(),
     'Wells', 'field_based', null, now());

  insert into public.wellbeing_responses (session_id, item_id, option_position)
  select v_alice_session, i.id, 3 from public.wellbeing_items i where i.version_id = v_version;

  insert into public.wellbeing_results
    (session_id, profile_id, instrument_key, total_score, likert_score, item_positions,
     scoring_version, questionnaire_version, version_id, threshold_at_completion,
     at_or_above_threshold, team_id, organization_id, department_at_completion,
     work_location_at_completion, office_location_at_completion, attempt_number)
  values
    (v_alice_session, v_alice, 'ghq12', 7, 21, '{3,3,3,3,3,3,3,0,0,0,0,0}', '1.0.0', 1, v_version,
     4, true, v_team, v_org, 'Production', 'office_based', 'Port Harcourt', 1),
    (v_bob_session, v_bob, 'ghq12', 2, 8, '{3,3,0,0,0,0,0,0,0,0,0,0}', '1.0.0', 1, v_version,
     4, false, v_team, v_org, 'Wells', 'field_based', null, 1);

  /* ── §11 · individual ownership ───────────────────────────────────── */

  perform pg_temp.expect_visible_count(
    'a participant sees exactly their own wellbeing result',
    v_alice, 'select count(*) from public.wellbeing_results', 1);

  perform pg_temp.expect_visible_count(
    'participant A cannot read participant B''s result',
    v_alice, format('select count(*) from public.wellbeing_results where profile_id = %L', v_bob), 0);

  perform pg_temp.expect_visible_count(
    'participant A cannot read participant B''s session context',
    v_alice, format('select count(*) from public.wellbeing_sessions where profile_id = %L', v_bob), 0);

  perform pg_temp.expect_visible_count(
    'participant B cannot read participant A''s item responses',
    v_bob, 'select count(*) from public.wellbeing_responses', 0);

  /* ── §11 / §28 · platform admin is NOT a health-data reader ───────── */

  -- These two make the three checks below meaningful rather than vacuous: the
  -- platform admin genuinely holds platform scope AND administers this team
  -- (00019 made is_team_admin() platform-wide) — and still sees no health data.
  perform pg_temp.expect_true_as(
    'fixture: the platform admin holds platform scope',
    v_super, 'select public.is_super_admin()');

  perform pg_temp.expect_true_as(
    'fixture: the platform admin administers this very team',
    v_super, format('select public.is_team_admin(%L)', v_team));

  perform pg_temp.expect_visible_count(
    'a platform super admin reads NO individual wellbeing result',
    v_super, 'select count(*) from public.wellbeing_results', 0);

  perform pg_temp.expect_visible_count(
    'a platform super admin reads NO wellbeing session',
    v_super, 'select count(*) from public.wellbeing_sessions', 0);

  perform pg_temp.expect_visible_count(
    'a platform super admin reads NO individual item response',
    v_super, 'select count(*) from public.wellbeing_responses', 0);

  perform pg_temp.expect_visible_count(
    'a platform super admin holds no wellbeing role by default',
    v_super, format(
      'select count(*) filter (where public.has_any_wellbeing_role(%L)) from (select 1) t', v_org), 0);

  /* A granted analyst still cannot reach an individual row. */
  insert into public.wellbeing_role_grants (profile_id, organization_id, role, granted_by)
  values (v_super, v_org, 'wellbeing_analyst', v_super);

  perform pg_temp.expect_visible_count(
    'even a granted wellbeing analyst reads NO individual result',
    v_super, 'select count(*) from public.wellbeing_results', 0);

  perform pg_temp.expect_visible_count(
    'even a granted wellbeing analyst reads NO individual response',
    v_super, 'select count(*) from public.wellbeing_responses', 0);

  /* ── §26 · retakes never overwrite ────────────────────────────────── */

  perform pg_temp.expect_accepted(
    'a second completed attempt on the same team is allowed',
    format($sql$
      insert into public.wellbeing_sessions
        (profile_id, version_id, instrument_key, team_id, organization_id, status, consent_given,
         consent_at, department_name, work_location, completed_at)
      values (%L, %L, 'ghq12', %L, %L, 'completed', true, now(), 'Wells', 'field_based', now())
    $sql$, v_alice, v_version, v_team, v_org));

  perform pg_temp.record(
    'both of a participant''s completed attempts remain',
    (select count(*) from public.wellbeing_sessions
      where profile_id = v_alice and status = 'completed') = 2);

  perform pg_temp.expect_accepted(
    'one in-progress attempt per person per team is allowed',
    format($sql$insert into public.wellbeing_sessions (profile_id, version_id, instrument_key, team_id, status)
            values (%L, %L, 'ghq12', %L, 'in_progress')$sql$, v_alice, v_version, v_team));

  perform pg_temp.expect_rejected(
    'a SECOND in-progress attempt on the same team is refused',
    format($sql$insert into public.wellbeing_sessions (profile_id, version_id, instrument_key, team_id, status)
            values (%L, %L, 'ghq12', %L, 'in_progress')$sql$, v_alice, v_version, v_team));

  /* ── §5 · work location / office location rules ───────────────────── */

  perform pg_temp.expect_rejected(
    'field-based work may not carry an office location',
    format($sql$insert into public.wellbeing_sessions
             (profile_id, version_id, instrument_key, status, work_location, office_location_name)
           values (%L, %L, 'ghq12', 'in_progress', 'field_based', 'Lagos')$sql$, v_bob, v_version));

  perform pg_temp.expect_accepted(
    'field-based work with no office location is accepted',
    format($sql$insert into public.wellbeing_sessions
             (profile_id, version_id, instrument_key, status, consent_given, consent_at,
              department_name, work_location, completed_at)
           values (%L, %L, 'ghq12', 'completed', true, now(), 'Wells', 'field_based', now())$sql$,
           v_bob, v_version));

  perform pg_temp.expect_rejected(
    'a completed office-based attempt must name an office',
    format($sql$insert into public.wellbeing_sessions
             (profile_id, version_id, instrument_key, status, consent_given, consent_at,
              department_name, work_location, completed_at)
           values (%L, %L, 'ghq12', 'completed', true, now(), 'Finance', 'office_based', now())$sql$,
           v_bob, v_version));

  /* ── consent gate ─────────────────────────────────────────────────── */

  perform pg_temp.expect_rejected(
    'a completed attempt without consent is refused',
    format($sql$insert into public.wellbeing_sessions
             (profile_id, version_id, instrument_key, status, consent_given,
              department_name, work_location, completed_at)
           values (%L, %L, 'ghq12', 'completed', false, 'Finance', 'field_based', now())$sql$,
           v_bob, v_version));

  /* ── §2 / §3 · score and threshold integrity ──────────────────────── */

  insert into public.wellbeing_sessions (id, profile_id, version_id, instrument_key, status)
  values (v_spare, v_bob, v_version, 'ghq12', 'in_progress');

  perform pg_temp.expect_rejected(
    'the at/above-threshold flag cannot disagree with the score',
    format($sql$insert into public.wellbeing_results
             (session_id, profile_id, instrument_key, total_score, likert_score, item_positions,
              scoring_version, questionnaire_version, version_id, threshold_at_completion, at_or_above_threshold)
           values (%L, %L, 'ghq12', 2, 6, '{3,3,0,0,0,0,0,0,0,0,0,0}', '1.0.0', 1, %L, 4, true)$sql$,
           v_spare, v_bob, v_version));

  perform pg_temp.expect_rejected(
    'a GHQ-12 total score above 12 is refused',
    format($sql$insert into public.wellbeing_results
             (session_id, profile_id, instrument_key, total_score, likert_score, item_positions,
              scoring_version, questionnaire_version, version_id, threshold_at_completion, at_or_above_threshold)
           values (%L, %L, 'ghq12', 13, 6, '{3,3,0,0,0,0,0,0,0,0,0,0}', '1.0.0', 1, %L, 4, true)$sql$,
           v_spare, v_bob, v_version));

  perform pg_temp.expect_rejected(
    'a Likert score above 36 is refused',
    format($sql$insert into public.wellbeing_results
             (session_id, profile_id, instrument_key, total_score, likert_score, item_positions,
              scoring_version, questionnaire_version, version_id, threshold_at_completion, at_or_above_threshold)
           values (%L, %L, 'ghq12', 2, 37, '{3,3,0,0,0,0,0,0,0,0,0,0}', '1.0.0', 1, %L, 4, false)$sql$,
           v_spare, v_bob, v_version));

  perform pg_temp.expect_rejected(
    'an item_positions array of the wrong length is refused',
    format($sql$insert into public.wellbeing_results
             (session_id, profile_id, instrument_key, total_score, likert_score, item_positions,
              scoring_version, questionnaire_version, version_id, threshold_at_completion, at_or_above_threshold)
           values (%L, %L, 'ghq12', 2, 6, '{3,3,0}', '1.0.0', 1, %L, 4, false)$sql$,
           v_spare, v_bob, v_version));

  perform pg_temp.expect_rejected(
    'a threshold outside 1-12 is refused',
    format($sql$insert into public.wellbeing_results
             (session_id, profile_id, instrument_key, total_score, likert_score, item_positions,
              scoring_version, questionnaire_version, version_id, threshold_at_completion, at_or_above_threshold)
           values (%L, %L, 'ghq12', 2, 6, '{3,3,0,0,0,0,0,0,0,0,0,0}', '1.0.0', 1, %L, 0, true)$sql$,
           v_spare, v_bob, v_version));

  /* ── §32 · unlicensed content cannot reach a participant ──────────── */

  perform pg_temp.expect_rejected(
    'a structure-only questionnaire version cannot be activated',
    'update public.wellbeing_versions set is_active = true where version = 1');

  -- Scoped to the version the MIGRATION seeds. A local database may also carry
  -- scripts/seed-wellbeing-smoke.sql's placeholder version, which is expected
  -- and is not what this check is about.
  -- Scoped to the THIRD-PARTY instruments. DISC360 Wellbeing is original
  -- content and ships its wording deliberately, so scoping by version number
  -- (all four are version 1) would report it as a violation.
  perform pg_temp.record(
    'no third-party instrument carries item wording',
    (select count(*) from public.wellbeing_items i
      join public.wellbeing_versions v on v.id = i.version_id
      where v.instrument_key in ('ghq12','ghq28','who5') and i.prompt is not null) = 0
    and (select count(*) from public.wellbeing_item_options o
      join public.wellbeing_items i on i.id = o.item_id
      join public.wellbeing_versions v on v.id = i.version_id
      where v.instrument_key in ('ghq12','ghq28','who5') and o.label is not null) = 0);

  perform pg_temp.record(
    'only DISC360 Wellbeing has an active questionnaire version',
    (select coalesce(array_agg(instrument_key order by instrument_key), array[]::text[])
     from public.wellbeing_versions where is_active) = array['disc360_wellbeing_v1']);

  perform pg_temp.expect_rejected(
    'a non-GHQ instrument cannot carry a screening threshold',
    format($sql$insert into public.wellbeing_results
             (session_id, profile_id, instrument_key, total_score, index_score, item_positions,
              scoring_version, questionnaire_version, version_id, threshold_at_completion,
              at_or_above_threshold)
           values (%L, %L, 'disc360_wellbeing_v1', 34, 71, '{4,2,3,1,3,2,4,3,2,3,4,3}',
                   '1.0.0', 1, %L, 4, true)$sql$,
           v_spare, v_bob, v_version));

  -- The governance invariant behind the whole licensing gate: a GHQ-12
  -- version may only carry wording once a licence is recorded ON THE ROW.
  -- A placeholder version declares a different questionnaire_code, so it does
  -- not need one and cannot borrow the exemption either.
  perform pg_temp.record(
    'no live GHQ-12 wording exists without a recorded licence',
    not exists (
      select 1
      from public.wellbeing_versions v
      join public.wellbeing_items i on i.version_id = v.id
      where v.questionnaire_code = 'ghq12'
        and i.prompt is not null
        and (v.licence_holder is null or v.licence_reference is null)
    ));

  /* ── campaign instrument locking ──────────────────────────────────── */

  perform pg_temp.expect_accepted(
    'a campaign with no attempts may have its instrument set',
    format($sql$update public.teams set wellbeing_instrument_key = 'disc360_wellbeing_v1'
            where id = %L$sql$, v_team));

  perform pg_temp.expect_accepted(
    'and changed, while no attempt exists for it',
    format($sql$update public.teams set wellbeing_instrument_key = 'ghq12'
            where id = %L$sql$, v_team));

  -- Alice and Bob already hold GHQ-12 attempts on this team from the fixture.
  perform pg_temp.expect_rejected(
    'once a participant has begun, the campaign instrument is LOCKED',
    format($sql$update public.teams set wellbeing_instrument_key = 'disc360_wellbeing_v1'
            where id = %L$sql$, v_team));

  perform pg_temp.expect_accepted(
    're-setting the SAME instrument on a locked campaign is not a change',
    format($sql$update public.teams set wellbeing_instrument_key = 'ghq12'
            where id = %L$sql$, v_team));

  perform pg_temp.expect_accepted(
    'unrelated campaign fields still update while locked',
    format($sql$update public.teams set description = 'renamed'
            where id = %L$sql$, v_team));

  /* ── §22 · no path joins wellbeing to DISC or Focus ───────────────── */

  perform pg_temp.record(
    'no view or table combines a wellbeing score with a DISC or Focus score',
    not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name like 'wellbeing%'
        and column_name in ('score_d','score_i','score_s','score_c','archetype_code',
                            'automaticity','distraction','mental_load','recovery','pattern_code')
    ));

  perform pg_temp.record(
    'DISC and Focus result tables carry no wellbeing column',
    not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name in ('assessment_results','focus_results','combined_sessions')
        and (column_name like '%wellbeing%' or column_name like '%ghq%')
    ));

  /* ── §23 · the catalogue is tenant-scoped ─────────────────────────── */
  --
  -- DISC360 is multi-organisation. An organisation's Department / Function
  -- catalogue is its own information: another tenant must not be able to read
  -- it, select from it, or inherit it. The platform-level rows are the one
  -- shared surface, and they must therefore describe nobody.

  select m.organization_id, m.profile_id into v_org_a, v_member_a
  from public.organization_members m order by m.organization_id limit 1;
  select m.organization_id, m.profile_id into v_org_b, v_member_b
  from public.organization_members m
  where m.organization_id <> v_org_a order by m.organization_id limit 1;

  insert into public.wellbeing_departments (organization_id, name, position)
  values (v_org_a, 'Tenant A Confidential Unit', 900),
         (v_org_b, 'Tenant B Confidential Unit', 900);
  insert into public.wellbeing_office_locations (organization_id, name, position)
  values (v_org_a, 'Tenant A Confidential Site', 900);

  -- Non-vacuous: A really can see its own entry.
  perform pg_temp.expect_visible_count(
    'fixture: an organisation reads its OWN Department / Function entry',
    v_member_a,
    $q$select count(*) from public.wellbeing_departments where name = 'Tenant A Confidential Unit'$q$,
    1);

  perform pg_temp.expect_visible_count(
    'organisation B cannot read organisation A''s Department / Function catalogue',
    v_member_b,
    $q$select count(*) from public.wellbeing_departments where name = 'Tenant A Confidential Unit'$q$,
    0);

  perform pg_temp.expect_visible_count(
    'organisation A cannot read organisation B''s Department / Function catalogue',
    v_member_a,
    $q$select count(*) from public.wellbeing_departments where name = 'Tenant B Confidential Unit'$q$,
    0);

  perform pg_temp.expect_visible_count(
    'organisation B cannot read organisation A''s office catalogue',
    v_member_b,
    $q$select count(*) from public.wellbeing_office_locations where name = 'Tenant A Confidential Site'$q$,
    0);

  -- B creating an entry changes nothing about what A can see.
  perform pg_temp.expect_visible_count(
    'a new department in organisation B leaves organisation A''s catalogue unchanged',
    v_member_a,
    format('select count(*) from public.wellbeing_departments where organization_id = %L', v_org_b),
    0);

  -- The shared floor is readable by everyone, which is exactly why it must
  -- carry no customer's structure.
  perform pg_temp.expect_true_as(
    'every organisation reads the neutral platform floor',
    v_member_b,
    'select count(*) > 0 from public.wellbeing_departments where organization_id is null');

  select count(*) into v_floor
  from public.wellbeing_departments d
  where d.organization_id is null
    and (d.name ilike '%shell%' or d.name ilike '%ogoni%' or d.name ilike '%nigeria%'
      or d.name ilike '%renaissance%' or d.name ilike '%country chair%'
      or d.name ilike '%integrated gas%' or d.name ilike '%geo solutions%');
  perform pg_temp.record(
    'the platform Department / Function floor names no real customer',
    v_floor = 0, format('%s customer-specific platform rows', v_floor));

  select count(*) into v_floor
  from public.wellbeing_office_locations l
  where l.organization_id is null
    and l.name in ('Abuja', 'Lagos', 'Port Harcourt', 'Warri');
  perform pg_temp.record(
    'the platform office floor names no real customer geography',
    v_floor = 0, format('%s customer-specific platform offices', v_floor));

  -- Writes are tenant-scoped too: nobody may add to another tenant's
  -- catalogue, and nobody may add a NEW platform-level row through the
  -- ordinary path — that would publish it to every organisation at once.
  perform pg_temp.expect_rejected_as(
    'an organisation member cannot write into another organisation''s catalogue',
    v_member_a,
    format('insert into public.wellbeing_departments (organization_id, name) values (%L, ''Injected By A'')', v_org_b));

  perform pg_temp.expect_rejected_as(
    'nobody may create a platform-level catalogue row through RLS',
    v_member_a,
    'insert into public.wellbeing_departments (organization_id, name) values (null, ''Injected Platform Default'')');

  perform pg_temp.expect_rejected_as(
    'a platform super admin does not inherit catalogue write access to an organisation',
    v_super,
    format('insert into public.wellbeing_departments (organization_id, name) values (%L, ''Injected By Platform Admin'')', v_org_a));
end;
$harness$;

\set QUIET off
\echo ''
\echo '──────────────── Wellbeing Pulse privacy harness ────────────────'
select id, case when passed then 'PASS' else 'FAIL' end as result, name from wb_check order by id;

select count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed,
       count(*) as total
from wb_check;

\echo ''
select case when count(*) = 0 then 'ALL CHECKS PASSED'
            else count(*) || ' CHECK(S) FAILED' end as verdict
from wb_check where not passed;

rollback;
