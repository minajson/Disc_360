-- Participant counts, countable for ONE campaign as well as a whole organisation.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHY THIS EXISTS.
--
-- 00030 established the rule that confidentiality is counted in PEOPLE and
-- that the counting happens inside the database, so the participant
-- identifiers it needs never enter application memory. That function is
-- scoped to an organisation.
--
-- The campaign dashboard reports on one campaign. Without a campaign scope
-- here it would have to either (a) count rows in application code, which
-- reintroduces exactly the longitudinal miscount 00030 fixed, or (b) select
-- profile_id into the analytics layer, which is the one column that layer is
-- forbidden to read. Both are worse than a parameter.
--
-- WHY DROP AND RECREATE RATHER THAN ADD A DEFAULT.
--
-- Adding a defaulted third parameter with `create or replace` creates a
-- SECOND function rather than replacing the first, and a two-argument call
-- then resolves ambiguously. Dropping the two-argument form leaves exactly one
-- callable signature, which is what makes "every count is scoped" checkable.
--
-- Non-destructive: this touches no row. It replaces a read-only counting
-- function with the same function plus an optional scope.
-- ─────────────────────────────────────────────────────────────────────

drop function if exists public.wellbeing_participant_counts(uuid, text);

create function public.wellbeing_participant_counts(
  p_organization uuid,
  p_instrument text,
  -- Null counts the whole organisation, which is what the organisation-wide
  -- workspace asks for. A uuid narrows every scope below to one campaign.
  p_team uuid default null
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
           r.team_id
    from public.wellbeing_results r
    where r.organization_id = p_organization
      and r.instrument_key = p_instrument
      -- One predicate for both readings, so the campaign scope cannot be
      -- forgotten by one branch of a union and applied by another.
      and (p_team is null or r.team_id = p_team)
  )
  select 'overall'::text, ''::text, count(distinct s.profile_id)::int from scoped s

  union all

  select 'department', coalesce(s.department_at_completion, ''), count(distinct s.profile_id)::int
  from scoped s
  where s.department_at_completion is not null
  group by s.department_at_completion

  union all

  select 'work_location', s.work_location_at_completion::text, count(distinct s.profile_id)::int
  from scoped s
  where s.work_location_at_completion is not null
  group by s.work_location_at_completion

  union all

  select 'office_location', coalesce(s.office_location_at_completion, ''), count(distinct s.profile_id)::int
  from scoped s
  where s.office_location_at_completion is not null
  group by s.office_location_at_completion

  union all

  select 'team', s.team_id::text, count(distinct s.profile_id)::int
  from scoped s
  where s.team_id is not null
  group by s.team_id;
$$;

revoke all on function public.wellbeing_participant_counts(uuid, text, uuid) from public;
grant execute on function public.wellbeing_participant_counts(uuid, text, uuid) to service_role;

-- The campaign-scoped lookup path.
create index if not exists wellbeing_results_campaign_participants_idx
  on public.wellbeing_results (organization_id, instrument_key, team_id, profile_id);

comment on function public.wellbeing_participant_counts(uuid, text, uuid) is
  'Distinct PARTICIPANT counts per cohort, for suppression. Returns integers only — no identifier leaves the database. p_team narrows every scope to one campaign.';
