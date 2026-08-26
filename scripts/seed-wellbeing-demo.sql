-- Wellbeing Pulse — LOCAL management-demo dataset. Never for a hosted database.
--
-- ─────────────────────────────────────────────────────────────────────
-- SYNTHETIC AGGREGATE DATA ONLY.
--
-- Creates completed results for DISC360 Wellbeing Pulse V1 across four waves,
-- several departments, both work locations and all four offices, so the
-- analytics workspace can be evaluated with realistic shape.
--
-- Auth rows are unavoidable: public.profiles.id is a foreign key into
-- auth.users, so a result cannot exist without one. They are made
-- structurally unusable instead — an invalid password hash that no input can
-- produce, an unconfirmed address, and the reserved .invalid TLD which cannot
-- receive mail. None of these accounts can sign in or be contacted.
--
-- Nothing here is a real participant and nothing here can reach production:
-- the script refuses to run against a non-local host, and is not a migration.
--
-- The three third-party instruments get NO synthetic data, because they have
-- no questionnaire content — inventing results for them would imply an
-- assessment that cannot yet be run.
--
-- Includes one DELIBERATELY SUPPRESSED cohort (Legal, 4 respondents) so the
-- confidentiality engine can be demonstrated rather than described.
--
-- Run:
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--     -f scripts/seed-wellbeing-demo.sql
--
-- Undo: `npx supabase db reset`.
-- ─────────────────────────────────────────────────────────────────────

-- Abort on the FIRST error. Without this the local-host guard below is
-- decorative: `raise exception` inside a DO block ends that block, psql
-- reports it and then carries straight on to the next statement — so a script
-- that "refuses to run" against the wrong database would seed it anyway.
\set ON_ERROR_STOP on

do $$
begin
  -- Loopback, or a private (RFC1918 / Docker) address. A hosted Supabase
  -- instance is on neither, so this refuses anything reachable from outside.
  if inet_server_addr() is not null
     and not (inet_server_addr() <<= inet '127.0.0.0/8'
           or inet_server_addr() <<= inet '10.0.0.0/8'
           or inet_server_addr() <<= inet '172.16.0.0/12'
           or inet_server_addr() <<= inet '192.168.0.0/16') then
    raise exception 'Refusing to seed demo data into a non-local host %', inet_server_addr();
  end if;
end;
$$;

begin;

do $$
declare
  v_org uuid;
  v_team uuid;
  v_version uuid := '00000000-0000-4000-8000-0000000000d1';
  v_profile uuid; v_session uuid; v_result uuid;
  v_dept text; v_loc text; v_office text;
  v_raw int; v_idx int; v_wave int; v_dimraw int;
  v_wave_id uuid;
  -- Four EXPLICIT waves. Two of them — Baseline (re-measure) and
  -- Post-intervention — deliberately share Q3 2026, because that is the case
  -- the old calendar-quarter wave rule silently merged. A demo that cannot
  -- show the defect cannot show that it is fixed.
  v_wave_ids uuid[] := array[
    '40000000-0000-4000-8000-0000000000a1',
    '40000000-0000-4000-8000-0000000000a2',
    '40000000-0000-4000-8000-0000000000a3',
    '40000000-0000-4000-8000-0000000000a4'
  ]::uuid[];
  v_wave_labels text[] := array['Baseline', 'Follow-up', 'Baseline (re-measure)', 'Post-intervention'];
  v_wave_dates timestamptz[] := array[
    '2025-11-12T09:00:00Z', '2026-02-11T09:00:00Z',
    '2026-08-12T09:00:00Z', '2026-09-09T09:00:00Z'
  ]::timestamptz[];
  i int; d int;
  v_dims text[] := array['capacity','recovery_demand','emotional_resilience',
                         'connection_safety','purpose_confidence','everyday_wellbeing'];
  -- Department, headcount. Legal is intentionally below the floor of 7.
  -- Drawn from the NEUTRAL platform catalogue seeded by 00028, so the demo
  -- shows departments a participant could actually select, and describes no
  -- real customer's structure.
  v_depts text[] := array['Operations','Engineering','Information Technology',
                          'Finance','Human Resources','Legal'];
  v_sizes int[]  := array[14, 11, 9, 8, 7, 4];
  v_person int;
begin
  select id into v_org from public.organizations order by created_at limit 1;

  -- A DEDICATED campaign, never an existing DISC team.
  --
  -- This used to attach the demo results to whichever team happened to be
  -- first in the organisation — which was a DISC team holding real DISC
  -- sessions. Since 00032 that is worse than untidy: setting an instrument on
  -- a team makes it a wellbeing campaign, so the script would have converted
  -- a DISC team out of its own product and stranded its sessions.
  --
  -- Fixed id, so re-running replaces the demo campaign rather than
  -- accumulating copies of it.
  insert into public.teams
    (id, organization_id, name, description, assessment_type, wellbeing_instrument_key,
     team_code, invite_token, join_enabled, created_by)
  values ('30000000-0000-4000-8000-0000000009d1', v_org,
          'Wellbeing Pulse — Management Demo', '',
          'wellbeing', 'disc360_wellbeing_v1',
          'WELLB-9001', '9d100000-0000-4000-8000-0000000009d1'::uuid, true,
          (select id from public.profiles where email = 'demo@disc360.dev'))
  on conflict (id) do update
    set wellbeing_instrument_key = excluded.wellbeing_instrument_key,
        assessment_type = excluded.assessment_type
  returning id into v_team;

  -- The waves exist before any response does, so every result below is
  -- attached to the wave it was actually completed in rather than to whatever
  -- wave happened to be open.
  for v_wave in 1..4 loop
    insert into public.wellbeing_waves
      (id, team_id, organization_id, wave_number, label, opened_at, closed_at)
    values (v_wave_ids[v_wave], v_team, v_org, v_wave, v_wave_labels[v_wave],
            v_wave_dates[v_wave],
            -- The last wave stays OPEN, so the campaign is live and a new
            -- participant scanning the QR joins wave 4 rather than a fifth.
            case when v_wave = 4 then null else v_wave_dates[v_wave] + interval '10 days' end)
    on conflict (id) do update set label = excluded.label;
  end loop;

  for d in 1..array_length(v_depts, 1) loop
    v_dept := v_depts[d];

    for v_person in 1..v_sizes[d] loop
      i := d * 100 + v_person;
      v_loc := case when v_person % 3 = 0 then 'field_based' else 'office_based' end;
      v_office := case when v_loc = 'office_based'
                       then (array['Head Office','Regional Office','Other'])[1 + (i % 3)] end;

      -- A synthetic identity that cannot authenticate. The password column
      -- holds a literal that is not a valid bcrypt hash, so no credential
      -- verifies against it, and the address is unconfirmed and undeliverable.
      insert into auth.users
        (instance_id, id, aud, role, email, encrypted_password,
         email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
              'authenticated', 'authenticated',
              'demo-' || i || '@wellbeing.invalid',
              'DEMO-FIXTURE-NO-LOGIN',
              null, now(), now(),
              '{"provider":"email","providers":["email"]}'::jsonb,
              jsonb_build_object('full_name', 'Demo Participant ' || i))
      returning id into v_profile;

      -- handle_new_user() creates the profile row; make sure it is onboarded
      -- so it behaves like a completed participant in analytics.
      update public.profiles
      set full_name = 'Demo Participant ' || i, onboarded_at = now(), consented_at = now()
      where id = v_profile;

      -- On the campaign roster, so participation has an honest denominator.
      -- A campaign whose roster is empty reports a participation rate of null,
      -- which demonstrates nothing about the surface that displays it.
      insert into public.team_members (team_id, profile_id, display_name, email, role)
      values (v_team, v_profile, 'Demo Participant ' || i,
              'demo-' || i || '@wellbeing.invalid', 'member')
      on conflict do nothing;

      -- Four waves, drifting slightly upward per department.
      for v_wave in 0..3 loop
        v_wave_id := v_wave_ids[v_wave + 1];
        v_raw := 16 + ((i * 3 + v_wave * 5) % 22) + (v_wave * 2) + (d - 3);
        v_raw := greatest(0, least(48, v_raw));
        v_idx := round((v_raw::numeric / 48) * 100);

        insert into public.wellbeing_sessions
          (profile_id, version_id, instrument_key, team_id, organization_id, status,
           wave_id, consent_given, consent_at, department_name, work_location,
           office_location_name, completed_at, started_at)
        values (v_profile, v_version, 'disc360_wellbeing_v1', v_team, v_org, 'completed',
                v_wave_id, true, v_wave_dates[v_wave + 1],
                v_dept, v_loc::public.wellbeing_work_location, v_office,
                v_wave_dates[v_wave + 1], v_wave_dates[v_wave + 1])
        returning id into v_session;

        insert into public.wellbeing_results
          (session_id, profile_id, instrument_key, total_score, index_score, item_positions,
           scoring_method, scoring_version, questionnaire_version, version_id, organization_id,
           team_id, wave_id, department_at_completion, work_location_at_completion,
           office_location_at_completion, attempt_number, completed_at, created_at)
        values (v_session, v_profile, 'disc360_wellbeing_v1', v_raw, v_idx,
                (select array_agg(least(4, greatest(0, (v_raw / 12) + ((g + i) % 3) - 1)) order by g)
                 from generate_series(1, 12) g)::smallint[],
                'disc360_wellbeing_sum_0_48', '1.0.0', 1, v_version, v_org, v_team, v_wave_id,
                v_dept, v_loc::public.wellbeing_work_location, v_office, v_wave + 1,
                v_wave_dates[v_wave + 1], v_wave_dates[v_wave + 1])
        returning id into v_result;

        for i in 1..6 loop
          v_dimraw := greatest(0, least(8, round(v_raw::numeric / 6) + ((i * 2 + v_person) % 5) - 2));
          insert into public.wellbeing_result_dimensions
            (result_id, dimension_key, raw_score, index_score)
          values (v_result, v_dims[i], v_dimraw, round((v_dimraw::numeric / 8) * 100));
        end loop;
        i := d * 100 + v_person;
      end loop;
    end loop;
  end loop;

  -- The facilitator who runs the campaign.
  insert into public.team_members (team_id, profile_id, display_name, email, role)
  select v_team, p.id, p.full_name, p.email, 'team_admin'
  from public.profiles p where p.email = 'demo@disc360.dev'
  on conflict do nothing;
end;
$$;

-- Sub-unit / Team catalogue for the demo organisation.
--
-- LOCAL fixture values, parented to the platform departments where a parent
-- makes sense so the participant form can be seen narrowing. There is no
-- shipped catalogue of sub-units — a sub-unit name is always somebody's own
-- org chart — so these exist here and in no migration.
insert into public.wellbeing_sub_units (organization_id, department_id, name, sort_order)
select o.id, d.id, v.name, v.sort_order
from (select id from public.organizations order by created_at limit 1) o
cross join (values
    ('Terminal Operations', 'Operations', 10),
    ('Upstream Field Services', 'Operations', 20),
    ('Maintenance & Reliability', 'Engineering', 30),
    ('Project Delivery', 'Engineering', 40),
    ('Payroll & Reporting', 'Finance', 50),
    ('Talent & Development', 'Human Resources', 60),
    ('Service Desk', 'Information Technology', 70),
    ('Corporate Services', null, 80),
    ('Innovation Lab', null, 90)
  ) as v(name, department, sort_order)
left join public.wellbeing_departments d
  on d.organization_id is null and d.name = v.department
on conflict do nothing;

-- Give the demo account wellbeing governance and analytics.
--
-- BOTH roles, because they are genuinely different privileges and the demo
-- has to exercise both: governance creates campaigns and sets the
-- confidentiality floor, analytics reads what that floor produces. Neither is
-- implied by team administration or by platform administration — which is the
-- point of the separation and the reason it is granted explicitly here.
insert into public.wellbeing_role_grants (profile_id, organization_id, role, granted_by)
select p.id, o.id, r.role, p.id
from public.profiles p
cross join lateral (select id from public.organizations order by created_at limit 1) o
cross join (values ('wellbeing_analyst'::public.wellbeing_access_role),
                   ('wellbeing_governance'::public.wellbeing_access_role)) as r(role)
where p.email = 'demo@disc360.dev'
on conflict do nothing;

commit;

select department_at_completion as department,
       count(distinct profile_id) as respondents,
       count(*) as results,
       round(percentile_cont(0.5) within group (order by index_score)) as median_index
from public.wellbeing_results
group by 1 order by 2 desc;

-- The same-quarter pair, stated plainly: two waves, one quarter.
select w.wave_number,
       w.label,
       to_char(w.opened_at, 'Mon YYYY') as opened,
       'Q' || to_char(w.opened_at, 'Q YYYY') as quarter,
       count(r.id) as results
from public.wellbeing_waves w
left join public.wellbeing_results r on r.wave_id = w.id
group by 1, 2, 3, 4
order by 1;
