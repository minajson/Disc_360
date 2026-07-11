-- DISC360 development seed. Fictional people only — never real data.
-- Local sign-in for every seeded account: password "disc360-demo".
--   demo@disc360.dev  → organization/team admin with three teams
--   solo@disc360.dev  → individual with history + an in-progress session

do $$
declare
  v_version uuid := '00000000-0000-4000-8000-000000000001';
  v_admin uuid := '10000000-0000-4000-8000-000000000001';
  v_solo uuid := '10000000-0000-4000-8000-000000000002';
  v_org uuid := '20000000-0000-4000-8000-000000000001';
  v_team_product uuid := '30000000-0000-4000-8000-000000000001';
  v_team_eng uuid := '30000000-0000-4000-8000-000000000002';
  v_team_gtm uuid := '30000000-0000-4000-8000-000000000003';
  v_campaign_product uuid := '40000000-0000-4000-8000-000000000001';
  v_campaign_eng uuid := '40000000-0000-4000-8000-000000000002';
  v_campaign_gtm uuid := '40000000-0000-4000-8000-000000000003';

  member record;
  v_uid uuid;
  v_member_id uuid;
  v_session uuid;
  v_result uuid;
  v_team uuid;
  v_campaign uuid;
  v_q record;
  v_i int;
begin
  -- ── auth users (email/password, confirmed) ─────────────────────────
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  values
    ('00000000-0000-0000-0000-000000000000', v_admin, 'authenticated', 'authenticated',
     'demo@disc360.dev', crypt('disc360-demo', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Dana Whitfield"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_solo, 'authenticated', 'authenticated',
     'solo@disc360.dev', crypt('disc360-demo', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Sam Okonkwo"}',
     now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), v_admin, v_admin::text,
     jsonb_build_object('sub', v_admin::text, 'email', 'demo@disc360.dev'), 'email', now(), now(), now()),
    (gen_random_uuid(), v_solo, v_solo::text,
     jsonb_build_object('sub', v_solo::text, 'email', 'solo@disc360.dev'), 'email', now(), now(), now());

  update public.profiles set
    preferred_name = 'Dana', profession = 'Head of People',
    country = 'US', timezone = 'America/New_York',
    onboarding_intent = 'create_team', consented_at = now(), onboarded_at = now()
  where id = v_admin;

  update public.profiles set
    preferred_name = 'Sam', profession = 'Product designer',
    country = 'NG', timezone = 'Africa/Lagos',
    onboarding_intent = 'understand_myself', consented_at = now(), onboarded_at = now()
  where id = v_solo;

  -- ── organization + teams ───────────────────────────────────────────
  insert into public.organizations (id, name, industry, created_by)
  values (v_org, 'Atlas Collective', 'Software', v_admin);

  insert into public.organization_members (organization_id, profile_id, role)
  values (v_org, v_admin, 'organization_admin');

  insert into public.teams (id, organization_id, name, description, department,
    team_code, results_named, members_can_view_summary, deadline_at, created_by, timezone)
  values
    (v_team_product, v_org, 'Product Leadership',
     'Product managers and design leads shaping the roadmap.', 'Product',
     'ATLAS-1001', true, true, now() - interval '10 days', v_admin, 'America/New_York'),
    (v_team_eng, v_org, 'Engineering Core',
     'Platform, data and QA leadership.', 'Engineering',
     'ATLAS-1002', false, true, now() + interval '11 days', v_admin, 'America/New_York'),
    (v_team_gtm, v_org, 'Go-to-Market',
     'Sales, marketing and customer success.', 'Go-to-Market',
     'ATLAS-1003', true, false, null, v_admin, 'America/New_York');

  -- Dana is admin on every team
  insert into public.team_members (team_id, profile_id, display_name, email, department, role)
  values
    (v_team_product, v_admin, 'Dana Whitfield', 'demo@disc360.dev', 'Product', 'team_admin'),
    (v_team_eng, v_admin, 'Dana Whitfield', 'demo@disc360.dev', 'Engineering', 'team_admin'),
    (v_team_gtm, v_admin, 'Dana Whitfield', 'demo@disc360.dev', 'Go-to-Market', 'team_admin');

  -- ── campaigns ──────────────────────────────────────────────────────
  insert into public.assessment_campaigns
    (id, team_id, version_id, name, invitation_message, status, starts_at, deadline_at, created_by)
  values
    (v_campaign_product, v_team_product, v_version, 'Q2 Leadership Offsite',
     'Please complete before the offsite — it takes about seven minutes.',
     'closed', now() - interval '40 days', now() - interval '10 days', v_admin),
    (v_campaign_eng, v_team_eng, v_version, 'Engineering Culture Map',
     'Part of our quarterly development cycle.',
     'active', now() - interval '5 days', now() + interval '11 days', v_admin),
    (v_campaign_gtm, v_team_gtm, v_version, 'GTM Onboarding Wave',
     '', 'draft', null, null, v_admin);

  -- ── fictional members ──────────────────────────────────────────────
  -- columns: email · name · preferred · team (1=product 2=eng 3=gtm) · dept ·
  --          role title → profession · d,i,s,c · archetype · primary · secondary · completed
  for member in
    select * from (values
      ('amara@atlasdemo.dev',  'Amara Okafor',    'Amara',  1, 'Product',      'Head of Product',          86, 54, 24, 48, 'D',  'D', 'I',  true),
      ('nia@atlasdemo.dev',    'Nia Thompson',    'Nia',    1, 'Product',      'Program Manager',          52, 56, 58, 50, 'BAL','S', null, true),
      ('lena@atlasdemo.dev',   'Lena Fischer',    'Lena',   1, 'Product',      'Design Lead',              66, 78, 34, 30, 'ID', 'I', 'D',  true),
      ('keiko@atlasdemo.dev',  'Keiko Tanaka',    'Keiko',  1, 'Product',      'Product Strategist',       70, 30, 22, 64, 'DC', 'D', 'C',  true),
      ('marcus@atlasdemo.dev', 'Marcus Bell',     'Marcus', 2, 'Engineering',  'QA Engineering Lead',      30, 36, 66, 58, 'SC', 'S', 'C',  true),
      ('elena@atlasdemo.dev',  'Elena Volkov',    'Elena',  2, 'Engineering',  'Data Science Lead',        40, 28, 46, 88, 'C',  'C', null, true),
      ('tomas@atlasdemo.dev',  'Tomás Ferreira',  'Tomás',  2, 'Engineering',  'Engineering Manager',      62, 44, 38, 70, 'CD', 'C', 'D',  true),
      ('omar@atlasdemo.dev',   'Omar Haddad',     'Omar',   2, 'Engineering',  'Platform Engineer',        28, 62, 70, 40, 'SI', 'S', 'I',  false),
      ('leo@atlasdemo.dev',    'Leo Marchetti',   'Leo',    3, 'Go-to-Market', 'Enterprise Sales Lead',    76, 64, 30, 36, 'DI', 'D', 'I',  true),
      ('priya@atlasdemo.dev',  'Priya Shah',      'Priya',  3, 'Go-to-Market', 'Marketing Director',       52, 82, 44, 30, 'I',  'I', null, true),
      ('daniel@atlasdemo.dev', 'Daniel Kim',      'Daniel', 3, 'Go-to-Market', 'Customer Success Manager', 34, 68, 60, 40, 'IS', 'I', 'S',  true),
      ('sofia@atlasdemo.dev',  'Sofia Reyes',     'Sofia',  3, 'Go-to-Market', 'People Operations Lead',   26, 48, 84, 52, 'S',  'S', null, false)
    ) as m(email, full_name, preferred, team_no, dept, profession, d, i, s, c, archetype, prim, sec, completed)
  loop
    v_uid := gen_random_uuid();

    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      member.email, crypt('disc360-demo', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', member.full_name),
      now(), now(), '', '', '', '');

    insert into auth.identities (id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', member.email), 'email', now(), now(), now());

    update public.profiles set
      preferred_name = member.preferred, profession = member.profession,
      country = 'US', timezone = 'America/New_York',
      onboarding_intent = 'join_team', consented_at = now(), onboarded_at = now()
    where id = v_uid;

    v_team := case member.team_no when 1 then v_team_product when 2 then v_team_eng else v_team_gtm end;
    v_campaign := case member.team_no when 1 then v_campaign_product when 2 then v_campaign_eng else v_campaign_gtm end;

    insert into public.team_members (team_id, profile_id, display_name, email, department, role)
    values (v_team, v_uid, member.full_name, member.email, member.dept, 'member')
    returning id into v_member_id;

    if member.completed then
      insert into public.assessment_sessions (profile_id, version_id, campaign_id, status,
        current_index, started_at, completed_at)
      values (v_uid, v_version,
        case when member.team_no = 3 then null else v_campaign end,
        'completed', 23,
        now() - interval '20 days', now() - interval '20 days' + interval '8 minutes')
      returning id into v_session;

      insert into public.assessment_results (session_id, profile_id,
        score_d, score_i, score_s, score_c, archetype_code,
        primary_dimension, secondary_dimension, intensity, raw_most, raw_least, net)
      values (v_session, v_uid,
        member.d, member.i, member.s, member.c, member.archetype::public.archetype_code,
        member.prim::public.dimension,
        case when member.sec is null then null else member.sec::public.dimension end,
        jsonb_build_object(
          'D', case when member.d <= 35 then 'LOW' when member.d <= 55 then 'MODERATE' when member.d <= 75 then 'HIGH' else 'VERY_HIGH' end,
          'I', case when member.i <= 35 then 'LOW' when member.i <= 55 then 'MODERATE' when member.i <= 75 then 'HIGH' else 'VERY_HIGH' end,
          'S', case when member.s <= 35 then 'LOW' when member.s <= 55 then 'MODERATE' when member.s <= 75 then 'HIGH' else 'VERY_HIGH' end,
          'C', case when member.c <= 35 then 'LOW' when member.c <= 55 then 'MODERATE' when member.c <= 75 then 'HIGH' else 'VERY_HIGH' end),
        -- development fixtures: plausible tallies derived from normalized scores
        jsonb_build_object('d', greatest(0, round(member.d * 0.24)), 'i', greatest(0, round(member.i * 0.24)),
                           's', greatest(0, round(member.s * 0.24)), 'c', greatest(0, round(member.c * 0.24))),
        jsonb_build_object('d', greatest(0, round((100 - member.d) * 0.24)), 'i', greatest(0, round((100 - member.i) * 0.24)),
                           's', greatest(0, round((100 - member.s) * 0.24)), 'c', greatest(0, round((100 - member.c) * 0.24))),
        jsonb_build_object('d', round(member.d * 0.48 - 24), 'i', round(member.i * 0.48 - 24),
                           's', round(member.s * 0.48 - 24), 'c', round(member.c * 0.48 - 24)))
      returning id into v_result;

      if member.team_no <> 3 then
        insert into public.campaign_assignments (campaign_id, team_member_id, status)
        values (v_campaign, v_member_id, 'completed');
      end if;
    else
      if member.team_no <> 3 then
        insert into public.campaign_assignments (campaign_id, team_member_id, status)
        values (v_campaign, v_member_id,
          (case when member.email like 'omar%' then 'started' else 'invited' end)::public.assignment_status);
      end if;
    end if;
  end loop;

  -- ── roster entries who have not signed up yet + invitation states ──
  insert into public.team_members (team_id, profile_id, display_name, email, department, role)
  values
    (v_team_gtm, null, 'Maya Lindqvist', 'maya@atlasdemo.dev', 'Go-to-Market', 'member'),
    (v_team_gtm, null, 'Jon Osei', 'jon@atlasdemo.dev', 'Go-to-Market', 'member');

  insert into public.invitations (team_id, team_member_id, email, status, invited_by, expires_at, message)
  select v_team_gtm, tm.id, tm.email, 'pending', v_admin, now() + interval '10 days',
         'Join our Go-to-Market team on DISC360.'
  from public.team_members tm
  where tm.team_id = v_team_gtm and tm.profile_id is null;

  insert into public.invitations (team_id, email, status, invited_by, expires_at)
  values
    (v_team_eng, 'former@atlasdemo.dev', 'expired', v_admin, now() - interval '3 days'),
    (v_team_eng, 'declined@atlasdemo.dev', 'revoked', v_admin, now() + interval '5 days');

  -- ── solo individual: history + one in-progress session ─────────────
  insert into public.assessment_sessions (profile_id, version_id, status, current_index, started_at, completed_at)
  values (v_solo, v_version, 'completed', 23, now() - interval '90 days', now() - interval '90 days' + interval '9 minutes')
  returning id into v_session;

  insert into public.assessment_results (session_id, profile_id,
    score_d, score_i, score_s, score_c, archetype_code, primary_dimension, secondary_dimension,
    intensity, raw_most, raw_least, net)
  values (v_session, v_solo, 38, 63, 58, 46, 'IS', 'I', 'S',
    '{"D":"MODERATE","I":"HIGH","S":"HIGH","C":"MODERATE"}',
    '{"d":4,"i":9,"s":8,"c":3}', '{"d":10,"i":3,"s":4,"c":7}',
    '{"d":-6,"i":6,"s":4,"c":-4}');

  insert into public.assessment_sessions (profile_id, version_id, status, current_index, started_at)
  values (v_solo, v_version, 'in_progress', 8, now() - interval '2 days')
  returning id into v_session;

  -- eight answered scenarios in the in-progress session
  v_i := 0;
  for v_q in
    select q.id as question_id,
      (select id from public.question_options where question_id = q.id and position = 0) as most_id,
      (select id from public.question_options where question_id = q.id and position = 2) as least_id
    from public.questions q
    where q.version_id = v_version and q.position < 8
    order by q.position
  loop
    insert into public.assessment_responses (session_id, question_id, most_option_id, least_option_id)
    values (v_session, v_q.question_id, v_q.most_id, v_q.least_id);
    v_i := v_i + 1;
  end loop;
end $$;
