-- Confidentiality is counted in PEOPLE, not in rows.
--
-- ─────────────────────────────────────────────────────────────────────
-- THE BUG THIS FIXES.
--
-- Cohort suppression compared the minimum cohort size against the number of
-- RESULTS in a cohort. With longitudinal data that is the wrong unit: four
-- people who have each completed four waves produce sixteen rows, which sails
-- past a floor of seven while the cohort still contains only four
-- identifiable individuals.
--
-- The floor exists so that no one in a reported group can be picked out. That
-- is a property of how many PEOPLE are in the group, and it does not improve
-- because they answered more often.
--
-- WHY A DATABASE FUNCTION.
--
-- Counting distinct participants requires a participant identifier, and the
-- analytics layer deliberately never selects one — see
-- WELLBEING_ANALYTICS_COLUMNS and its guard test. This function does the
-- counting inside the database and returns only integers, so the identifiers
-- never enter application memory, a payload, a log or a stack trace.
--
-- SECURITY DEFINER because wellbeing_results is own-row under RLS by design.
-- The caller has already been authorised by requireWellbeingAnalyst, and the
-- organisation is passed in rather than inferred, so the function can only
-- count within a scope the caller was granted.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.wellbeing_participant_counts(
  p_organization uuid,
  p_instrument text
)
returns table (scope text, cohort text, participants int)
language sql
stable
security definer
set search_path = public
as $$
  -- Whole organisation.
  select 'overall'::text, ''::text, count(distinct r.profile_id)::int
  from public.wellbeing_results r
  where r.organization_id = p_organization and r.instrument_key = p_instrument

  union all

  select 'department', coalesce(r.department_at_completion, ''), count(distinct r.profile_id)::int
  from public.wellbeing_results r
  where r.organization_id = p_organization and r.instrument_key = p_instrument
    and r.department_at_completion is not null
  group by r.department_at_completion

  union all

  select 'work_location', r.work_location_at_completion::text, count(distinct r.profile_id)::int
  from public.wellbeing_results r
  where r.organization_id = p_organization and r.instrument_key = p_instrument
    and r.work_location_at_completion is not null
  group by r.work_location_at_completion

  union all

  select 'office_location', coalesce(r.office_location_at_completion, ''), count(distinct r.profile_id)::int
  from public.wellbeing_results r
  where r.organization_id = p_organization and r.instrument_key = p_instrument
    and r.office_location_at_completion is not null
  group by r.office_location_at_completion

  union all

  select 'team', r.team_id::text, count(distinct r.profile_id)::int
  from public.wellbeing_results r
  where r.organization_id = p_organization and r.instrument_key = p_instrument
    and r.team_id is not null
  group by r.team_id;
$$;

-- Not callable by anon, and not by a signed-in user directly reaching for it:
-- the server calls it with the service role after authorising the caller.
revoke all on function public.wellbeing_participant_counts(uuid, text) from public;
grant execute on function public.wellbeing_participant_counts(uuid, text) to service_role;

-- Counting distinct participants per cohort is now a lookup path.
create index if not exists wellbeing_results_cohort_participants_idx
  on public.wellbeing_results (organization_id, instrument_key, profile_id);
