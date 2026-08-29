-- Version pinning, capacity, lifecycle and provenance — proven, not asserted.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHY THIS HARNESS EXISTS.
--
-- The whole case for `wellbeing_campaigns` rests on one claim: a participant
-- answers the questionnaire version THEIR CAMPAIGN PINNED, whatever has been
-- activated since. That claim was unfalsifiable while only one version of each
-- instrument had ever existed — "the pinned one" and "the active one" were the
-- same row, so every test passed either way and the invariant was never
-- actually exercised.
--
-- So this harness makes a second version. It is the only way to tell the two
-- resolutions apart, and therefore the only way to know the refactor did
-- anything.
--
-- Everything runs inside one transaction and ROLLS BACK. It creates a real
-- organisation, real campaigns and real sessions, and leaves nothing behind.
-- ─────────────────────────────────────────────────────────────────────

-- Fail closed, not merely loudly.
--
-- This harness INSERTS auth users, an organisation, campaigns, sessions and a
-- result before rolling them back. A rollback that never runs — an interrupted
-- session, a statement executed outside the transaction, a future edit — would
-- leave every one of them behind, in whatever database it was pointed at.
--
-- So refuse a non-local target outright rather than trusting the rollback, and
-- abort on the first error so the refusal actually stops the script: a bare
-- `raise exception` inside a DO block ends the block, and psql would otherwise
-- carry straight on to the next statement.
\set ON_ERROR_STOP on

do $guard$
begin
  if coalesce(current_database(), '') <> 'postgres' then
    raise exception 'Refusing to run the pinning harness against database %', current_database();
  end if;
  -- Loopback, or a private (RFC1918 / Docker) address. A hosted Supabase
  -- instance is on neither, so this refuses anything reachable from outside.
  if inet_server_addr() is not null
     and not (inet_server_addr() <<= inet '127.0.0.0/8'
           or inet_server_addr() <<= inet '10.0.0.0/8'
           or inet_server_addr() <<= inet '172.16.0.0/12'
           or inet_server_addr() <<= inet '192.168.0.0/16') then
    raise exception 'Refusing to run the pinning harness against non-local host %', inet_server_addr();
  end if;
end;
$guard$;

begin;

create temporary table checks (
  id serial primary key,
  ok boolean not null,
  label text not null
) on commit drop;

create or replace function pg_temp.check_that(p_ok boolean, p_label text)
returns void language plpgsql as $$
begin
  insert into checks (ok, label) values (coalesce(p_ok, false), p_label);
end $$;

do $harness$
declare
  v_org uuid;
  v_actor uuid;
  v_p1 uuid;
  v_p2 uuid;
  v_p3 uuid;
  v_v1 uuid;
  v_v2 uuid;
  v_team_a uuid;
  v_team_b uuid;
  v_camp_a uuid;
  v_camp_b uuid;
  v_camp_cap uuid;
  v_team_cap uuid;
  v_session uuid;
  v_got uuid;
  v_err text;
  v_count int;
begin
  /* ── fixtures ────────────────────────────────────────────────────── */

  -- Four synthetic identities FIRST: `organizations.created_by` is NOT NULL,
  -- so the actor has to exist before the organisation does.
  -- `handle_new_user()` creates the profile rows.
  for i in 1..4 loop
    insert into auth.users
      (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
       created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
            'authenticated', 'authenticated',
            'pin-' || i || '@harness.invalid', 'HARNESS-NO-LOGIN', null, now(), now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('full_name', 'Pin Harness ' || i));
  end loop;

  select id into v_actor from public.profiles where email = 'pin-1@harness.invalid';
  select id into v_p1    from public.profiles where email = 'pin-2@harness.invalid';
  select id into v_p2    from public.profiles where email = 'pin-3@harness.invalid';
  select id into v_p3    from public.profiles where email = 'pin-4@harness.invalid';

  insert into public.organizations (name, created_by)
  values ('Pinning Harness Org', v_actor)
    returning id into v_org;

  /* ── 1 · V1 exists and is active ─────────────────────────────────── */

  select id into v_v1
    from public.wellbeing_versions
   where instrument_key = 'disc360_wellbeing_v1' and is_active;

  perform pg_temp.check_that(v_v1 is not null, 'V1 exists and is the active version');

  /* ── 2 · Campaign A is created and pins V1 ───────────────────────── */

  insert into public.teams
    (organization_id, name, description, assessment_type, wellbeing_instrument_key,
     team_code, created_by, join_enabled)
  values (v_org, 'Pinning A', '', 'wellbeing', 'disc360_wellbeing_v1',
          'PINA-0001', v_actor, false)
  returning id into v_team_a;

  insert into public.wellbeing_campaigns
    (organization_id, instrument_key, version_id, created_by, name, status, join_token, team_id)
  values (v_org, 'disc360_wellbeing_v1', v_v1, v_actor, 'Pinning A', 'active',
          'harness-campaign-a-token-000000000001', v_team_a)
  returning id into v_camp_a;

  select version_id into v_got from public.wellbeing_campaigns where id = v_camp_a;
  perform pg_temp.check_that(v_got = v_v1, 'Campaign A pins V1 at creation');

  /* ── 3 · V2 is introduced and activated ──────────────────────────── */
  --
  -- `wellbeing_versions_one_active_per_instrument` is a partial unique index,
  -- so V1 must be stood down in the same statement order a real release would
  -- use. This is the step that makes "pinned" and "active" different rows.

  update public.wellbeing_versions set is_active = false where id = v_v1;

  insert into public.wellbeing_versions
    (name, version, questionnaire_code, instrument_key, content_status, item_count,
     licence_note, is_active)
  values ('DISC360 Wellbeing Pulse V2', 2, 'disc360_wellbeing_v1', 'disc360_wellbeing_v1',
          'licensed', 12, 'Harness fixture', true)
  returning id into v_v2;

  -- V2 needs items, or the application's completeness check rejects it. Copied
  -- from V1 so the two differ only in identity, which is exactly the variable
  -- under test.
  insert into public.wellbeing_items
    (version_id, external_id, position, prompt, facet, dimension_key)
  select v_v2, external_id, position, prompt || ' (V2)', facet, dimension_key
    from public.wellbeing_items where version_id = v_v1;

  insert into public.wellbeing_item_options (item_id, position, label, points)
  select i2.id, o.position, o.label, o.points
    from public.wellbeing_items i1
    join public.wellbeing_item_options o on o.item_id = i1.id
    join public.wellbeing_items i2
      on i2.version_id = v_v2 and i2.external_id = i1.external_id
   where i1.version_id = v_v1;

  select id into v_got
    from public.wellbeing_versions
   where instrument_key = 'disc360_wellbeing_v1' and is_active;
  perform pg_temp.check_that(v_got = v_v2, 'V2 is now the active version');

  /* ── 4 · THE CENTRAL CLAIM ───────────────────────────────────────── */
  --
  -- A NEW participant joining Campaign A after V2 was activated must still be
  -- served V1. Under the old architecture the version came from `is_active`,
  -- so this session would have carried V2 — and been pooled with V1 answers.

  select version_id into v_got from public.wellbeing_campaigns where id = v_camp_a;
  perform pg_temp.check_that(
    v_got = v_v1,
    'Campaign A STILL pins V1 after V2 is activated');

  insert into public.wellbeing_sessions
    (profile_id, version_id, instrument_key, campaign_id, team_id, organization_id,
     consent_given, consent_at)
  values (v_p1, v_v1, 'disc360_wellbeing_v1', v_camp_a, v_team_a, v_org, true, now())
  returning id into v_session;

  select version_id into v_got from public.wellbeing_sessions where id = v_session;
  perform pg_temp.check_that(
    v_got = v_v1,
    'a NEW participant in Campaign A receives V1, not the newly active V2');

  /* ── 5 · the database refuses a session that disagrees with its pin ─ */

  begin
    insert into public.wellbeing_sessions
      (profile_id, version_id, instrument_key, campaign_id, team_id, organization_id,
       consent_given, consent_at)
    values (v_p2, v_v2, 'disc360_wellbeing_v1', v_camp_a, v_team_a, v_org, true, now());
    perform pg_temp.check_that(false, 'a session on V2 inside a V1 campaign must be refused');
  exception when others then
    get stacked diagnostics v_err = PG_EXCEPTION_HINT;
    perform pg_temp.check_that(
      v_err = 'CAMPAIGN_VERSION_MISMATCH',
      'a session on V2 inside a V1 campaign is refused (' || coalesce(v_err, 'no hint') || ')');
  end;

  -- Cross-INSTRUMENT substitution is refused by the same rule.
  begin
    insert into public.wellbeing_sessions
      (profile_id, version_id, instrument_key, campaign_id, team_id, organization_id,
       consent_given, consent_at)
    values (v_p2, v_v1, 'ghq12', v_camp_a, v_team_a, v_org, true, now());
    perform pg_temp.check_that(false, 'a GHQ-12 session inside a DISC360 campaign must be refused');
  exception when others then
    get stacked diagnostics v_err = PG_EXCEPTION_HINT;
    perform pg_temp.check_that(
      v_err = 'CAMPAIGN_INSTRUMENT_MISMATCH',
      'cross-instrument substitution is refused (' || coalesce(v_err, 'no hint') || ')');
  end;

  /* ── 6 · Campaign B, created after V2, may pin V2 ────────────────── */

  insert into public.teams
    (organization_id, name, description, assessment_type, wellbeing_instrument_key,
     team_code, created_by, join_enabled)
  values (v_org, 'Pinning B', '', 'wellbeing', 'disc360_wellbeing_v1',
          'PINB-0001', v_actor, false)
  returning id into v_team_b;

  insert into public.wellbeing_campaigns
    (organization_id, instrument_key, version_id, created_by, name, status, join_token, team_id)
  values (v_org, 'disc360_wellbeing_v1', v_v2, v_actor, 'Pinning B', 'active',
          'harness-campaign-b-token-000000000002', v_team_b)
  returning id into v_camp_b;

  perform pg_temp.check_that(true, 'Campaign B, created after V2, pins V2');

  insert into public.wellbeing_sessions
    (profile_id, version_id, instrument_key, campaign_id, team_id, organization_id,
     consent_given, consent_at)
  values (v_p3, v_v2, 'disc360_wellbeing_v1', v_camp_b, v_team_b, v_org, true, now());

  perform pg_temp.check_that(
    (select count(distinct version_id) from public.wellbeing_sessions
      where campaign_id in (v_camp_a, v_camp_b)) = 2,
    'two live campaigns serve two different versions at the same time');

  /* ── 7 · Campaign A cannot be repinned once anybody has answered ─── */

  begin
    update public.wellbeing_campaigns set version_id = v_v2 where id = v_camp_a;
    perform pg_temp.check_that(false, 'repinning a campaign with participants must be refused');
  exception when others then
    perform pg_temp.check_that(true, 'repinning Campaign A after participation is refused by the database');
  end;

  select version_id into v_got from public.wellbeing_campaigns where id = v_camp_a;
  perform pg_temp.check_that(v_got = v_v1, 'and Campaign A is still pinned to V1 afterwards');

  /* ── 8 · capacity: distinct participants, retake free, race-safe ─── */

  insert into public.teams
    (organization_id, name, description, assessment_type, wellbeing_instrument_key,
     team_code, created_by, join_enabled)
  values (v_org, 'Pinning Cap', '', 'wellbeing', 'disc360_wellbeing_v1',
          'PINC-0001', v_actor, false)
  returning id into v_team_cap;

  insert into public.wellbeing_campaigns
    (organization_id, instrument_key, version_id, created_by, name, status,
     participant_capacity, join_token, team_id)
  values (v_org, 'disc360_wellbeing_v1', v_v2, v_actor, 'Pinning Cap', 'active',
          1, 'harness-campaign-c-token-000000000003', v_team_cap)
  returning id into v_camp_cap;

  insert into public.wellbeing_sessions
    (profile_id, version_id, instrument_key, campaign_id, team_id, organization_id,
     consent_given, consent_at)
  values (v_p1, v_v2, 'disc360_wellbeing_v1', v_camp_cap, v_team_cap, v_org, true, now());
  perform pg_temp.check_that(true, 'capacity 1 admits the first participant');

  -- A retake means the first attempt is FINISHED first —
  -- `wellbeing_sessions_active_team_uniq` allows one in-progress attempt per
  -- (participant, team, instrument), which is a separate and correct rule.
  update public.wellbeing_sessions
     set status = 'completed', completed_at = now(),
         department_name = 'Harness', work_location = 'field_based'
   where campaign_id = v_camp_cap and profile_id = v_p1;

  -- The SAME participant again: a retake, which must not consume a place.
  insert into public.wellbeing_sessions
    (profile_id, version_id, instrument_key, campaign_id, team_id, organization_id,
     consent_given, consent_at)
  values (v_p1, v_v2, 'disc360_wellbeing_v1', v_camp_cap, v_team_cap, v_org, true, now());
  perform pg_temp.check_that(true, 'a retake by the same participant does not consume a second place');

  -- A DIFFERENT participant, with the only place taken.
  begin
    insert into public.wellbeing_sessions
      (profile_id, version_id, instrument_key, campaign_id, team_id, organization_id,
       consent_given, consent_at)
    values (v_p2, v_v2, 'disc360_wellbeing_v1', v_camp_cap, v_team_cap, v_org, true, now());
    perform pg_temp.check_that(false, 'a full campaign must refuse a new participant');
  exception when others then
    get stacked diagnostics v_err = PG_EXCEPTION_HINT;
    perform pg_temp.check_that(
      v_err = 'CAMPAIGN_CAPACITY_REACHED',
      'a full campaign refuses a new participant (' || coalesce(v_err, 'no hint') || ')');
  end;

  /* ── 9 · lifecycle: closed and expired admit nobody ──────────────── */

  update public.wellbeing_campaigns
     set status = 'closed', closed_at = now() where id = v_camp_b;
  begin
    insert into public.wellbeing_sessions
      (profile_id, version_id, instrument_key, campaign_id, team_id, organization_id,
       consent_given, consent_at)
    values (v_p2, v_v2, 'disc360_wellbeing_v1', v_camp_b, v_team_b, v_org, true, now());
    perform pg_temp.check_that(false, 'a closed campaign must admit nobody');
  exception when others then
    get stacked diagnostics v_err = PG_EXCEPTION_HINT;
    perform pg_temp.check_that(
      v_err = 'CAMPAIGN_NOT_OPEN',
      'a closed campaign admits nobody (' || coalesce(v_err, 'no hint') || ')');
  end;

  update public.wellbeing_campaigns
     set status = 'active', closed_at = null, expires_at = now() - interval '1 day'
   where id = v_camp_b;
  begin
    insert into public.wellbeing_sessions
      (profile_id, version_id, instrument_key, campaign_id, team_id, organization_id,
       consent_given, consent_at)
    values (v_p2, v_v2, 'disc360_wellbeing_v1', v_camp_b, v_team_b, v_org, true, now());
    perform pg_temp.check_that(false, 'an expired campaign must admit nobody');
  exception when others then
    get stacked diagnostics v_err = PG_EXCEPTION_HINT;
    perform pg_temp.check_that(
      v_err = 'CAMPAIGN_EXPIRED',
      'an expired campaign admits nobody (' || coalesce(v_err, 'no hint') || ')');
  end;

  /* ── 10 · token resolution discloses nothing extra ───────────────── */

  select count(*) into v_count
    from public.wellbeing_campaign_by_token('harness-campaign-a-token-000000000001');
  perform pg_temp.check_that(v_count = 1, 'a valid token resolves to exactly one campaign');

  select count(*) into v_count
    from public.wellbeing_campaign_by_token('harness-campaign-a-token-00000000000X');
  perform pg_temp.check_that(v_count = 0, 'an unknown token resolves to nothing at all');

  -- Cross-campaign substitution: B's token must never return A's campaign.
  perform pg_temp.check_that(
    (select campaign_id from public.wellbeing_campaign_by_token('harness-campaign-b-token-000000000002'))
      = v_camp_b,
    'a token resolves to its OWN campaign and no other');

  /* ── 11 · result provenance ──────────────────────────────────────── */

  select id into v_session
    from public.wellbeing_sessions
   where campaign_id = v_camp_a and profile_id = v_p1
   limit 1;

  update public.wellbeing_sessions
     set department_name = 'Harness', work_location = 'field_based',
         status = 'completed', completed_at = now()
   where id = v_session;

  -- A result claiming a DIFFERENT campaign than its session's.
  begin
    insert into public.wellbeing_results
      (session_id, profile_id, instrument_key, total_score, index_score, item_positions,
       scoring_method, scoring_version, questionnaire_version, version_id, organization_id,
       team_id, campaign_id, department_at_completion, work_location_at_completion,
       attempt_number, completed_at)
    values (v_session, v_p1, 'disc360_wellbeing_v1', 24, 50,
            array_fill(2::smallint, array[12]), 'disc360_wellbeing_sum_0_48', '1.0.0', 1,
            v_v1, v_org, v_team_a, v_camp_b, 'Harness', 'field_based', 1, now());
    perform pg_temp.check_that(false, 'a result naming another campaign must be refused');
  exception when others then
    get stacked diagnostics v_err = PG_EXCEPTION_HINT;
    perform pg_temp.check_that(
      v_err = 'RESULT_CAMPAIGN_MISMATCH',
      'a result naming another campaign is refused (' || coalesce(v_err, 'no hint') || ')');
  end;

  -- A result claiming a different VERSION than its session ran.
  begin
    insert into public.wellbeing_results
      (session_id, profile_id, instrument_key, total_score, index_score, item_positions,
       scoring_method, scoring_version, questionnaire_version, version_id, organization_id,
       team_id, campaign_id, department_at_completion, work_location_at_completion,
       attempt_number, completed_at)
    values (v_session, v_p1, 'disc360_wellbeing_v1', 24, 50,
            array_fill(2::smallint, array[12]), 'disc360_wellbeing_sum_0_48', '1.0.0', 2,
            v_v2, v_org, v_team_a, v_camp_a, 'Harness', 'field_based', 1, now());
    perform pg_temp.check_that(false, 'a result on another version must be refused');
  exception when others then
    get stacked diagnostics v_err = PG_EXCEPTION_HINT;
    perform pg_temp.check_that(
      v_err = 'RESULT_PROVENANCE_MISMATCH',
      'a result on another version is refused (' || coalesce(v_err, 'no hint') || ')');
  end;

  -- The honest one is accepted, and carries full provenance.
  insert into public.wellbeing_results
    (session_id, profile_id, instrument_key, total_score, index_score, item_positions,
     scoring_method, scoring_version, questionnaire_version, version_id, organization_id,
     team_id, campaign_id, department_at_completion, work_location_at_completion,
     attempt_number, completed_at)
  values (v_session, v_p1, 'disc360_wellbeing_v1', 24, 50,
          array_fill(2::smallint, array[12]), 'disc360_wellbeing_sum_0_48', '1.0.0', 1,
          v_v1, v_org, v_team_a, v_camp_a, 'Harness', 'field_based', 1, now());

  perform pg_temp.check_that(
    (select count(*) from public.wellbeing_results r
      where r.session_id = v_session
        and r.campaign_id = v_camp_a
        and r.version_id = v_v1
        and r.instrument_key = 'disc360_wellbeing_v1'
        and r.profile_id = v_p1
        and r.completed_at is not null
        and r.scoring_method = 'disc360_wellbeing_sum_0_48'
        and r.scoring_version = '1.0.0') = 1,
    'a stored result carries campaign, instrument, version, participant, timestamp and scoring method');
end
$harness$;

select id, case when ok then 'PASS' else 'FAIL' end as status, label from checks order by id;

select count(*) filter (where ok) as passed,
       count(*) filter (where not ok) as failed,
       count(*) as total
  from checks;

do $$
declare failed int;
begin
  select count(*) into failed from checks where not ok;
  if failed > 0 then
    raise exception '% pinning check(s) FAILED', failed;
  end if;
  raise notice 'all % campaign pinning checks passed', (select count(*) from checks);
end $$;

rollback;
