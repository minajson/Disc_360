-- DISC360 development seed. Fictional people only — never real data.
-- Local sign-in for every seeded account: password "disc360-demo".
--
-- One clean account per navigation experience, so all four are demonstrable
-- and none depends on another's state:
--   solo@disc360.dev  → individual: history + an in-progress session
--   demo@disc360.dev  → facilitator: org/team admin with three teams
--   coach@disc360.dev → coach: coach profile + its own client engagement
--   admin@disc360.dev → super admin
--
-- demo@ deliberately has NO coach profile: a coach profile outranks team_admin
-- in resolveExperience(), so giving demo@ one would hide the facilitator nav.

do $$
declare
  -- v2 (Workplace Scenarios) — the active bank. Seeded sessions must use the
  -- same questions a real participant gets, or resuming demo data shows the
  -- retired v1 wording.
  v_version uuid := '00000000-0000-4000-8000-000000000002';
  v_admin uuid := '10000000-0000-4000-8000-000000000001';
  v_solo uuid := '10000000-0000-4000-8000-000000000002';
  v_super uuid := '10000000-0000-4000-8000-000000000003';
  v_coach uuid := '10000000-0000-4000-8000-000000000004';
  v_org uuid := '20000000-0000-4000-8000-000000000001';
  v_org_coach uuid := '20000000-0000-4000-8000-000000000002';
  v_team_coach uuid := '30000000-0000-4000-8000-000000000004';
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
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_super, 'authenticated', 'authenticated',
     'admin@disc360.dev', crypt('disc360-demo', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Alex Reeve"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_coach, 'authenticated', 'authenticated',
     'coach@disc360.dev', crypt('disc360-demo', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Rosa Lindqvist"}',
     now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), v_admin, v_admin::text,
     jsonb_build_object('sub', v_admin::text, 'email', 'demo@disc360.dev'), 'email', now(), now(), now()),
    (gen_random_uuid(), v_solo, v_solo::text,
     jsonb_build_object('sub', v_solo::text, 'email', 'solo@disc360.dev'), 'email', now(), now(), now()),
    (gen_random_uuid(), v_super, v_super::text,
     jsonb_build_object('sub', v_super::text, 'email', 'admin@disc360.dev'), 'email', now(), now(), now()),
    (gen_random_uuid(), v_coach, v_coach::text,
     jsonb_build_object('sub', v_coach::text, 'email', 'coach@disc360.dev'), 'email', now(), now(), now());

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

  update public.profiles set
    preferred_name = 'Alex', profession = 'Platform owner',
    country = 'US', timezone = 'America/New_York', is_super_admin = true,
    onboarding_intent = 'setup_organization', consented_at = now(), onboarded_at = now()
  where id = v_super;

  update public.profiles set
    preferred_name = 'Rosa', profession = 'Leadership coach',
    country = 'SE', timezone = 'Europe/Stockholm',
    onboarding_intent = 'manage_clients', consented_at = now(), onboarded_at = now()
  where id = v_coach;

  -- ── the coach persona: profile + one client engagement ─────────────
  insert into public.coach_profiles (profile_id, title, organization, location, bio,
    credentials, expertise, years_experience)
  values (v_coach, 'Leadership Coach', 'Northlight Coaching', 'Stockholm, SE',
    'Fifteen years helping engineering and product leaders build teams that '
    || 'communicate well under pressure.',
    array['ICF Professional Certified Coach', 'DISC360 Certified Practitioner'],
    array['Team dynamics', 'Conflict resolution', 'Leadership transitions'],
    15);

  insert into public.organizations (id, name, industry, created_by)
  values (v_org_coach, 'Northlight Coaching', 'Professional services', v_coach);

  insert into public.organization_members (organization_id, profile_id, role)
  values (v_org_coach, v_coach, 'organization_admin');

  insert into public.teams (id, organization_id, name, description, department,
    team_code, client_organization, session_name, results_named,
    members_can_view_summary, deadline_at, created_by, timezone)
  values (v_team_coach, v_org_coach, 'Meridian Bank — Exec Team',
    'Executive team offsite preparation.', 'Executive',
    'NORTH-2001', 'Meridian Bank', 'Q3 Executive Offsite', true, true,
    now() + interval '18 days', v_coach, 'Europe/Stockholm');

  insert into public.team_members (team_id, profile_id, display_name, email, department, role)
  values (v_team_coach, v_coach, 'Rosa Lindqvist', 'coach@disc360.dev', 'Executive', 'team_admin');

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

  -- Entitlements: Dana has one consumed purchase (Product Leadership) and
  -- one unused entitlement ready for a new team.
  insert into public.entitlements (purchaser_id, status, team_id, purchased_at)
  values
    (v_admin, 'consumed', v_team_product, now() - interval '45 days'),
    (v_admin, 'active', null, now() - interval '2 days');

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

-- ── enterprise-scale fixtures ────────────────────────────────────────
--
-- Four cohorts of 5, 10, 20 and 100 fictional participants under one client
-- organisation. These exist so the enterprise surfaces can be exercised at
-- the sizes they were designed for — the comparison workspace's batching
-- (2–8 simultaneous, 9–10 on a rail, 11+ in batches of ten), department
-- cohorts, the department heat map and a twelve-month completion trend.
--
-- Fictional people only. Every account shares the same local development
-- password as the rest of this seed and none of it ships anywhere.
do $$
declare
  v_version uuid := '00000000-0000-4000-8000-000000000002';
  v_admin uuid := '10000000-0000-4000-8000-000000000001';
  v_org uuid := '20000000-0000-4000-8000-000000000003';

  -- Deterministic ids so a reset produces stable links for local bookmarks.
  v_teams uuid[] := array[
    '30000000-0000-4000-8000-000000000101'::uuid,  -- 100
    '30000000-0000-4000-8000-000000000102'::uuid,  --  20
    '30000000-0000-4000-8000-000000000103'::uuid,  --  10
    '30000000-0000-4000-8000-000000000104'::uuid   --   5
  ];
  v_sizes int[] := array[100, 20, 10, 5];
  v_names text[] := array[
    'Meridian Group — Enterprise Program',
    'Meridian Group — Cohort 20',
    'Meridian Group — Cohort 10',
    'Meridian Group — Cohort 5'
  ];
  v_codes_team text[] := array['MERID-9100', 'MERID-9020', 'MERID-9010', 'MERID-9005'];

  -- Archetype codes paired with the primary/secondary they imply, so
  -- archetype_code, primary_dimension and the scores can never disagree.
  v_codes text[] := array['D','DI','ID','I','IS','SI','S','SC','CS','C','CD','DC','BAL'];
  v_prim  text[] := array['D','D', 'I', 'I','I', 'S', 'S','S', 'C', 'C','C', 'D', 'S'];
  v_sec   text[] := array[null,'I','D',null,'S','I',null,'C','S',null,'D','C',null];

  v_first text[] := array['Mina','Prince','Vivian','Emmanuel','Ada','Chidi','Zainab',
    'Tunde','Ngozi','Kofi','Amaka','Bola','Ifeoma','Segun','Hauwa','Obi','Yemi',
    'Sade','Chinedu','Halima','Femi','Rita','Uche','Kemi','Bayo'];
  v_last text[] := array['Allison','Okoro','Bello','Nwosu','Adeyemi','Mensah',
    'Danjuma','Eze','Ogbonna','Suleiman','Balogun','Ikenna','Sani','Chukwu',
    'Ogunlesi','Yusuf','Abara','Duru','Tetteh','Kalu'];

  -- One bcrypt hash reused across the fixtures: 135 salted hashes would add
  -- seconds to every `supabase db reset` for zero local benefit.
  v_pw text := crypt('disc360-demo', gen_salt('bf'));

  v_team uuid;
  v_size int;
  v_uid uuid;
  v_session uuid;
  v_code text;
  v_slot int;
  v_dept text;
  v_full text;
  v_email text;
  v_d int; v_i2 int; v_s int; v_c int;
  v_scores jsonb;
  v_completed boolean;
  v_days int;
  t int;
  n int;
begin
  insert into public.organizations (id, name, industry, created_by)
  values (v_org, 'Meridian Group', 'Financial services', v_admin);

  insert into public.organization_members (organization_id, profile_id, role)
  values (v_org, v_admin, 'organization_admin');

  for t in 1..4 loop
    v_team := v_teams[t];
    v_size := v_sizes[t];

    insert into public.teams (id, organization_id, name, description, department,
      team_code, client_organization, session_name, results_named,
      members_can_view_summary, deadline_at, created_by, timezone)
    values (v_team, v_org, v_names[t],
      'Enterprise fixture cohort of ' || v_size || ' participants.',
      'Enterprise', v_codes_team[t], 'Meridian Group',
      'Organisational Development Programme', true, true,
      now() + interval '21 days', v_admin, 'Europe/London');

    insert into public.team_members (team_id, profile_id, display_name, email, department, role)
    values (v_team, v_admin, 'Dana Whitfield', 'demo@disc360.dev', 'Leadership', 'team_admin');

    for n in 0..(v_size - 1) loop
      v_uid := gen_random_uuid();
      v_full := v_first[1 + (n % 25)] || ' ' || v_last[1 + (n % 20)];
      v_email := 'p' || t || '-' || n || '@meridiandemo.dev';

      -- Departments only where the cohort is large enough for the split to
      -- mean anything; the small cohorts stay single-department.
      --
      -- The 20-cohort carries a deliberately tiny "Executive" department so
      -- the privacy-suppression path (fewer than three completed profiles →
      -- coverage only, no group interpretation) is exercisable locally.
      v_dept := case
        when v_size < 20 then 'Leadership'
        when v_size = 20 and n < 2 then 'Executive'
        when n % 5 = 0 then 'Leadership'
        when n % 5 = 1 then 'Operations'
        when n % 5 = 2 then 'Engineering'
        when n % 5 = 3 then 'Commercial'
        else 'People'
      end;

      v_slot := 1 + ((n * 7) % 13);
      v_code := v_codes[v_slot];

      -- Primary highest, secondary second, remainder well below — so the
      -- stored scores, primary_dimension and archetype_code agree.
      v_d := 30 + (n % 17);
      v_i2 := 30 + ((n * 3) % 17);
      v_s := 30 + ((n * 5) % 17);
      v_c := 30 + ((n * 11) % 17);
      if v_code = 'BAL' then
        v_d := 48 + (n % 7); v_i2 := 47 + ((n * 3) % 7);
        v_s := 49 + ((n * 5) % 7); v_c := 46 + ((n * 11) % 7);
      else
        case v_prim[v_slot]
          when 'D' then v_d := 70 + (n % 15);
          when 'I' then v_i2 := 70 + (n % 15);
          when 'S' then v_s := 70 + (n % 15);
          else v_c := 70 + (n % 15);
        end case;
        if v_sec[v_slot] is not null then
          case v_sec[v_slot]
            when 'D' then v_d := 56 + (n % 9);
            when 'I' then v_i2 := 56 + (n % 9);
            when 'S' then v_s := 56 + (n % 9);
            else v_c := 56 + (n % 9);
          end case;
        end if;
      end if;

      -- The 100-cohort deliberately leaves eight profiles outstanding so
      -- completion analytics has something real to report.
      v_completed := not (v_size = 100 and n % 12 = 11);
      v_days := (n * 3) % 300;

      insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
      values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
        v_email, v_pw, now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', v_full),
        now(), now(), '', '', '', '');

      insert into auth.identities (id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_uid, v_uid::text,
        jsonb_build_object('sub', v_uid::text, 'email', v_email), 'email', now(), now(), now());

      update public.profiles set
        preferred_name = split_part(v_full, ' ', 1),
        profession = v_dept || ' team member',
        country = 'GB', timezone = 'Europe/London',
        onboarding_intent = 'join_team', consented_at = now(), onboarded_at = now()
      where id = v_uid;

      insert into public.team_members (team_id, profile_id, display_name, email, department, role)
      values (v_team, v_uid, v_full, v_email, v_dept, 'member');

      if v_completed then
        insert into public.assessment_sessions (profile_id, version_id, team_id, status,
          current_index, started_at, completed_at)
        values (v_uid, v_version, v_team, 'completed', 23,
          now() - (interval '1 day' * v_days),
          now() - (interval '1 day' * v_days) + interval '9 minutes')
        returning id into v_session;

        v_scores := jsonb_build_object(
          'D', case when v_d <= 35 then 'LOW' when v_d <= 55 then 'MODERATE' when v_d <= 75 then 'HIGH' else 'VERY_HIGH' end,
          'I', case when v_i2 <= 35 then 'LOW' when v_i2 <= 55 then 'MODERATE' when v_i2 <= 75 then 'HIGH' else 'VERY_HIGH' end,
          'S', case when v_s <= 35 then 'LOW' when v_s <= 55 then 'MODERATE' when v_s <= 75 then 'HIGH' else 'VERY_HIGH' end,
          'C', case when v_c <= 35 then 'LOW' when v_c <= 55 then 'MODERATE' when v_c <= 75 then 'HIGH' else 'VERY_HIGH' end);

        insert into public.assessment_results (session_id, profile_id, team_id,
          score_d, score_i, score_s, score_c, archetype_code,
          primary_dimension, secondary_dimension, intensity, raw_most, raw_least, net, created_at)
        values (v_session, v_uid, v_team,
          v_d, v_i2, v_s, v_c, v_code::public.archetype_code,
          v_prim[v_slot]::public.dimension,
          case when v_sec[v_slot] is null then null else v_sec[v_slot]::public.dimension end,
          v_scores,
          jsonb_build_object('d', round(v_d * 0.24), 'i', round(v_i2 * 0.24),
                             's', round(v_s * 0.24), 'c', round(v_c * 0.24)),
          jsonb_build_object('d', round((100 - v_d) * 0.24), 'i', round((100 - v_i2) * 0.24),
                             's', round((100 - v_s) * 0.24), 'c', round((100 - v_c) * 0.24)),
          jsonb_build_object('d', round(v_d * 0.48 - 24), 'i', round(v_i2 * 0.48 - 24),
                             's', round(v_s * 0.48 - 24), 'c', round(v_c * 0.48 - 24)),
          now() - (interval '1 day' * v_days));
      end if;
    end loop;
  end loop;
end $$;

-- ── longitudinal fixtures ────────────────────────────────────────────
--
-- A two-period team lineage plus participants who assessed in both, so the
-- history surfaces have something real to render: retakes that preserve the
-- earlier result, context snapshots that differ between periods, and an
-- explicit team_series linking two separately-named teams.
--
-- The two teams are named differently on purpose. A name heuristic would fail
-- to connect them, which is exactly why lineage is an explicit column.
do $$
declare
  v_version uuid := '00000000-0000-4000-8000-000000000002';
  v_admin uuid := '10000000-0000-4000-8000-000000000001';
  v_org uuid := '20000000-0000-4000-8000-000000000003';
  v_series uuid := '50000000-0000-4000-8000-000000000001';
  v_team_2026 uuid := '30000000-0000-4000-8000-000000000201';
  v_team_2027 uuid := '30000000-0000-4000-8000-000000000202';
  v_pw text := crypt('disc360-demo', gen_salt('bf'));

  v_period record;
  v_uid uuid;
  v_session uuid;
  v_full text;
  v_email text;
  v_d int; v_i2 int; v_s int; v_c int;
  n int;
begin
  insert into public.team_series (id, organization_id, name, description, created_by)
  values (v_series, v_org, 'Applications & ERP Programme',
    'Annual reassessment of the same continuing team.', v_admin);

  insert into public.teams (id, organization_id, name, description, department,
    team_code, client_organization, session_name, results_named,
    members_can_view_summary, created_by, timezone, team_series_id)
  values
    (v_team_2026, v_org, 'ERP Team 2026', 'First assessment period.', 'ERP',
     'MERID-8026', 'Meridian Group', 'Baseline assessment', true, true,
     v_admin, 'Europe/London', v_series),
    (v_team_2027, v_org, 'Applications & ERP 2027', 'Annual reassessment.', 'ERP',
     'MERID-8027', 'Meridian Group', 'Annual reassessment', true, true,
     v_admin, 'Europe/London', v_series);

  update public.teams set parent_team_id = v_team_2026 where id = v_team_2027;

  insert into public.team_members (team_id, profile_id, display_name, email, department, role)
  values
    (v_team_2026, v_admin, 'Dana Whitfield', 'demo@disc360.dev', 'ERP', 'team_admin'),
    (v_team_2027, v_admin, 'Dana Whitfield', 'demo@disc360.dev', 'ERP', 'team_admin');

  -- Eight people, both periods. The same account each time, so each of them
  -- ends up with two completed results and a real personal history.
  for n in 0..7 loop
    v_uid := gen_random_uuid();
    v_full := (array['Vivian Nwosu','Emmanuel Eze','Ada Bello','Chidi Okoro',
                     'Zainab Sani','Tunde Balogun','Ngozi Duru','Kofi Mensah'])[n + 1];
    v_email := 'lineage' || n || '@meridiandemo.dev';

    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      v_email, v_pw, now(), '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', v_full), now(), now(), '', '', '', '');

    insert into auth.identities (id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', v_email), 'email', now(), now(), now());

    update public.profiles set
      preferred_name = split_part(v_full, ' ', 1),
      profession = case when n < 4 then 'Systems Analyst' else 'Team Lead' end,
      country = 'GB', timezone = 'Europe/London',
      onboarding_intent = 'join_team', consented_at = now(), onboarded_at = now()
    where id = v_uid;

    for v_period in
      select * from (values
        -- team, department, role, days ago, score offset, retake reason
        (v_team_2026, 'ERP', 'Systems Analyst', 400, 0, 'first_attempt'),
        (v_team_2027, 'IDT', 'Team Lead', 40, 1, 'annual_reassessment')
      ) as p(team_id, dept, role_title, days_ago, shift, reason)
    loop
      insert into public.team_members (team_id, profile_id, display_name, email, department, role)
      values (v_period.team_id, v_uid, v_full, v_email, v_period.dept, 'member');

      -- Second period moves Dominant up and Analytical down by a clearly
      -- reportable margin, so the trend view has real movement to show.
      v_d := 42 + (n % 5) + (v_period.shift * 12);
      v_i2 := 38 + (n % 4);
      v_s := 56 + (n % 6) + (v_period.shift * 4);
      v_c := 64 - (n % 5) - (v_period.shift * 10);

      insert into public.assessment_sessions (profile_id, version_id, team_id, status,
        current_index, started_at, completed_at, retake_reason)
      values (v_uid, v_version, v_period.team_id, 'completed', 23,
        now() - (interval '1 day' * v_period.days_ago),
        now() - (interval '1 day' * v_period.days_ago) + interval '8 minutes',
        v_period.reason::public.retake_reason)
      returning id into v_session;

      insert into public.assessment_results (session_id, profile_id, team_id,
        score_d, score_i, score_s, score_c, archetype_code,
        primary_dimension, secondary_dimension, intensity, raw_most, raw_least, net, created_at,
        role_at_completion, department_at_completion, team_name_at_completion,
        organization_name_at_completion, organization_id, team_series_id,
        assessment_version, scoring_version, retake_reason, attempt_number)
      values (v_session, v_uid, v_period.team_id,
        v_d, v_i2, v_s, v_c,
        (case when v_c >= v_s then 'CS' else 'SC' end)::public.archetype_code,
        (case when v_c >= v_s then 'C' else 'S' end)::public.dimension,
        (case when v_c >= v_s then 'S' else 'C' end)::public.dimension,
        jsonb_build_object('D','MODERATE','I','MODERATE','S','HIGH','C','HIGH'),
        jsonb_build_object('d', round(v_d * 0.24), 'i', round(v_i2 * 0.24),
                           's', round(v_s * 0.24), 'c', round(v_c * 0.24)),
        jsonb_build_object('d', round((100 - v_d) * 0.24), 'i', round((100 - v_i2) * 0.24),
                           's', round((100 - v_s) * 0.24), 'c', round((100 - v_c) * 0.24)),
        jsonb_build_object('d', round(v_d * 0.48 - 24), 'i', round(v_i2 * 0.48 - 24),
                           's', round(v_s * 0.48 - 24), 'c', round(v_c * 0.48 - 24)),
        now() - (interval '1 day' * v_period.days_ago),
        v_period.role_title, v_period.dept,
        (select name from public.teams where id = v_period.team_id),
        'Meridian Group', v_org, v_series,
        2, '1.0.0', v_period.reason::public.retake_reason,
        v_period.shift + 1);
    end loop;
  end loop;
end $$;

-- Seeded teams are mid-flight fixtures: like the production backfill, teams
-- that already have members run with the assessment window open.
update public.teams set session_state = 'assessment_open'
where exists (select 1 from public.team_members m where m.team_id = teams.id);

-- Team-scope the seeded attempts (00018): each seeded participant belongs to
-- exactly one team, and their fixture attempts were taken for that team.
update public.assessment_sessions s
set team_id = m.team_id
from (
  select profile_id, min(team_id::text)::uuid as team_id
  from public.team_members
  where profile_id is not null
  group by profile_id
  having count(distinct team_id) = 1
) m
where m.profile_id = s.profile_id and s.team_id is null;

update public.assessment_results r
set team_id = s.team_id
from public.assessment_sessions s
where r.session_id = s.id and r.team_id is null;
