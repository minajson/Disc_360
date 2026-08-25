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

do $$
begin
  if inet_server_addr() is not null
     and host(inet_server_addr()) not in ('127.0.0.1', '::1', '172.17.0.1') then
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
  i int; d int;
  v_dims text[] := array['capacity','recovery_demand','emotional_resilience',
                         'connection_safety','purpose_confidence','everyday_wellbeing'];
  -- Department, headcount. Legal is intentionally below the floor of 7.
  v_depts text[] := array['Production','Wells','Information Technology',
                          'Engineering and Major Project','Security','Legal'];
  v_sizes int[]  := array[14, 11, 9, 8, 7, 4];
  v_person int;
begin
  select id into v_org from public.organizations order by created_at limit 1;
  select id into v_team from public.teams where organization_id = v_org order by created_at limit 1;

  for d in 1..array_length(v_depts, 1) loop
    v_dept := v_depts[d];

    for v_person in 1..v_sizes[d] loop
      i := d * 100 + v_person;
      v_loc := case when v_person % 3 = 0 then 'field_based' else 'office_based' end;
      v_office := case when v_loc = 'office_based'
                       then (array['Abuja','Lagos','Port Harcourt','Warri'])[1 + (i % 4)] end;

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

      -- Four historical waves, drifting slightly upward per department.
      for v_wave in 0..3 loop
        v_raw := 16 + ((i * 3 + v_wave * 5) % 22) + (v_wave * 2) + (d - 3);
        v_raw := greatest(0, least(48, v_raw));
        v_idx := round((v_raw::numeric / 48) * 100);

        insert into public.wellbeing_sessions
          (profile_id, version_id, instrument_key, team_id, organization_id, status,
           consent_given, consent_at, department_name, work_location, office_location_name,
           completed_at, started_at)
        values (v_profile, v_version, 'disc360_wellbeing_v1', v_team, v_org, 'completed',
                true, now() - ((300 - v_wave * 75) || ' days')::interval,
                v_dept, v_loc::public.wellbeing_work_location, v_office,
                now() - ((300 - v_wave * 75) || ' days')::interval,
                now() - ((300 - v_wave * 75) || ' days')::interval)
        returning id into v_session;

        insert into public.wellbeing_results
          (session_id, profile_id, instrument_key, total_score, index_score, item_positions,
           scoring_method, scoring_version, questionnaire_version, version_id, organization_id,
           team_id, department_at_completion, work_location_at_completion,
           office_location_at_completion, attempt_number, completed_at, created_at)
        values (v_session, v_profile, 'disc360_wellbeing_v1', v_raw, v_idx,
                (select array_agg(least(4, greatest(0, (v_raw / 12) + ((g + i) % 3) - 1)) order by g)
                 from generate_series(1, 12) g)::smallint[],
                'disc360_wellbeing_sum_0_48', '1.0.0', 1, v_version, v_org, v_team,
                v_dept, v_loc::public.wellbeing_work_location, v_office, v_wave + 1,
                now() - ((300 - v_wave * 75) || ' days')::interval,
                now() - ((300 - v_wave * 75) || ' days')::interval)
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

  -- The campaign runs the one instrument that has content.
  update public.teams set wellbeing_instrument_key = 'disc360_wellbeing_v1' where id = v_team;
end;
$$;

-- Give the demo account aggregate analytics access.
insert into public.wellbeing_role_grants (profile_id, organization_id, role, granted_by)
select p.id, o.id, 'wellbeing_analyst', p.id
from public.profiles p
cross join lateral (select id from public.organizations order by created_at limit 1) o
where p.email = 'demo@disc360.dev'
on conflict do nothing;

commit;

select department_at_completion as department,
       count(distinct profile_id) as respondents,
       count(*) as results,
       round(percentile_cont(0.5) within group (order by index_score)) as median_index
from public.wellbeing_results
group by 1 order by 2 desc;
