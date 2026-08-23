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
begin
  select t.id, t.organization_id into v_team, v_org from public.teams t limit 1;
  select id into v_super from public.profiles where is_super_admin order by email limit 1;
  select id into v_alice from public.profiles where not is_super_admin order by email limit 1;
  select id into v_bob from public.profiles where not is_super_admin and id <> v_alice
    order by email limit 1;

  /* ── fixture: two people complete a pulse on the same team ────────── */

  insert into public.wellbeing_sessions
    (id, profile_id, version_id, team_id, organization_id, status, consent_given, consent_at,
     department_name, work_location, office_location_name, completed_at)
  values
    (v_alice_session, v_alice, v_version, v_team, v_org, 'completed', true, now(),
     'Production', 'office_based', 'Port Harcourt', now()),
    (v_bob_session, v_bob, v_version, v_team, v_org, 'completed', true, now(),
     'Wells', 'field_based', null, now());

  insert into public.wellbeing_responses (session_id, item_id, option_position)
  select v_alice_session, i.id, 3 from public.wellbeing_items i where i.version_id = v_version;

  insert into public.wellbeing_results
    (session_id, profile_id, total_score, likert_score, item_positions, scoring_version,
     questionnaire_version, version_id, threshold_at_completion, at_or_above_threshold,
     team_id, organization_id, department_at_completion, work_location_at_completion,
     office_location_at_completion, attempt_number)
  values
    (v_alice_session, v_alice, 7, 21, '{3,3,3,3,3,3,3,0,0,0,0,0}', '1.0.0', 1, v_version,
     4, true, v_team, v_org, 'Production', 'office_based', 'Port Harcourt', 1),
    (v_bob_session, v_bob, 2, 8, '{3,3,0,0,0,0,0,0,0,0,0,0}', '1.0.0', 1, v_version,
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
        (profile_id, version_id, team_id, organization_id, status, consent_given, consent_at,
         department_name, work_location, completed_at)
      values (%L, %L, %L, %L, 'completed', true, now(), 'Wells', 'field_based', now())
    $sql$, v_alice, v_version, v_team, v_org));

  perform pg_temp.record(
    'both of a participant''s completed attempts remain',
    (select count(*) from public.wellbeing_sessions
      where profile_id = v_alice and status = 'completed') = 2);

  perform pg_temp.expect_accepted(
    'one in-progress attempt per person per team is allowed',
    format($sql$insert into public.wellbeing_sessions (profile_id, version_id, team_id, status)
            values (%L, %L, %L, 'in_progress')$sql$, v_alice, v_version, v_team));

  perform pg_temp.expect_rejected(
    'a SECOND in-progress attempt on the same team is refused',
    format($sql$insert into public.wellbeing_sessions (profile_id, version_id, team_id, status)
            values (%L, %L, %L, 'in_progress')$sql$, v_alice, v_version, v_team));

  /* ── §5 · work location / office location rules ───────────────────── */

  perform pg_temp.expect_rejected(
    'field-based work may not carry an office location',
    format($sql$insert into public.wellbeing_sessions
             (profile_id, version_id, status, work_location, office_location_name)
           values (%L, %L, 'in_progress', 'field_based', 'Lagos')$sql$, v_bob, v_version));

  perform pg_temp.expect_accepted(
    'field-based work with no office location is accepted',
    format($sql$insert into public.wellbeing_sessions
             (profile_id, version_id, status, consent_given, consent_at,
              department_name, work_location, completed_at)
           values (%L, %L, 'completed', true, now(), 'Wells', 'field_based', now())$sql$,
           v_bob, v_version));

  perform pg_temp.expect_rejected(
    'a completed office-based attempt must name an office',
    format($sql$insert into public.wellbeing_sessions
             (profile_id, version_id, status, consent_given, consent_at,
              department_name, work_location, completed_at)
           values (%L, %L, 'completed', true, now(), 'Finance', 'office_based', now())$sql$,
           v_bob, v_version));

  /* ── consent gate ─────────────────────────────────────────────────── */

  perform pg_temp.expect_rejected(
    'a completed attempt without consent is refused',
    format($sql$insert into public.wellbeing_sessions
             (profile_id, version_id, status, consent_given,
              department_name, work_location, completed_at)
           values (%L, %L, 'completed', false, 'Finance', 'field_based', now())$sql$,
           v_bob, v_version));

  /* ── §2 / §3 · score and threshold integrity ──────────────────────── */

  insert into public.wellbeing_sessions (id, profile_id, version_id, status)
  values (v_spare, v_bob, v_version, 'in_progress');

  perform pg_temp.expect_rejected(
    'the at/above-threshold flag cannot disagree with the score',
    format($sql$insert into public.wellbeing_results
             (session_id, profile_id, total_score, likert_score, item_positions, scoring_version,
              questionnaire_version, version_id, threshold_at_completion, at_or_above_threshold)
           values (%L, %L, 2, 6, '{3,3,0,0,0,0,0,0,0,0,0,0}', '1.0.0', 1, %L, 4, true)$sql$,
           v_spare, v_bob, v_version));

  perform pg_temp.expect_rejected(
    'a total score above 12 is refused',
    format($sql$insert into public.wellbeing_results
             (session_id, profile_id, total_score, likert_score, item_positions, scoring_version,
              questionnaire_version, version_id, threshold_at_completion, at_or_above_threshold)
           values (%L, %L, 13, 6, '{3,3,0,0,0,0,0,0,0,0,0,0}', '1.0.0', 1, %L, 4, true)$sql$,
           v_spare, v_bob, v_version));

  perform pg_temp.expect_rejected(
    'a Likert score above 36 is refused',
    format($sql$insert into public.wellbeing_results
             (session_id, profile_id, total_score, likert_score, item_positions, scoring_version,
              questionnaire_version, version_id, threshold_at_completion, at_or_above_threshold)
           values (%L, %L, 2, 37, '{3,3,0,0,0,0,0,0,0,0,0,0}', '1.0.0', 1, %L, 4, false)$sql$,
           v_spare, v_bob, v_version));

  perform pg_temp.expect_rejected(
    'an item_positions array of the wrong length is refused',
    format($sql$insert into public.wellbeing_results
             (session_id, profile_id, total_score, likert_score, item_positions, scoring_version,
              questionnaire_version, version_id, threshold_at_completion, at_or_above_threshold)
           values (%L, %L, 2, 6, '{3,3,0}', '1.0.0', 1, %L, 4, false)$sql$,
           v_spare, v_bob, v_version));

  perform pg_temp.expect_rejected(
    'a threshold outside 1-12 is refused',
    format($sql$insert into public.wellbeing_results
             (session_id, profile_id, total_score, likert_score, item_positions, scoring_version,
              questionnaire_version, version_id, threshold_at_completion, at_or_above_threshold)
           values (%L, %L, 2, 6, '{3,3,0,0,0,0,0,0,0,0,0,0}', '1.0.0', 1, %L, 0, true)$sql$,
           v_spare, v_bob, v_version));

  /* ── §32 · unlicensed content cannot reach a participant ──────────── */

  perform pg_temp.expect_rejected(
    'a structure-only questionnaire version cannot be activated',
    'update public.wellbeing_versions set is_active = true where version = 1');

  -- Scoped to the version the MIGRATION seeds. A local database may also carry
  -- scripts/seed-wellbeing-smoke.sql's placeholder version, which is expected
  -- and is not what this check is about.
  perform pg_temp.record(
    'the migration-seeded questionnaire carries no item wording',
    (select count(*) from public.wellbeing_items i
      join public.wellbeing_versions v on v.id = i.version_id
      where v.version = 1 and i.prompt is not null) = 0
    and (select count(*) from public.wellbeing_item_options o
      join public.wellbeing_items i on i.id = o.item_id
      join public.wellbeing_versions v on v.id = i.version_id
      where v.version = 1 and o.label is not null) = 0);

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
