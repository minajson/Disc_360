-- One organisation named REN Africa Energy, with no participant data moved.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT WAS WRONG.
--
-- Five organisations existed, two of them literally named "Ren" and one
-- "REN Africa Energy", so the campaign creator offered a choice between
-- records that mean the same company.
--
-- WHY THIS RENAMES RATHER THAN REPOINTS.
--
-- The obvious reading — "consolidate into the correctly named org" — would
-- have moved 42 DISC results, 1 wellbeing session and 8 teams OUT of
-- cf53d83f, which is where the real history lives (Pipelines, NGRE, HR, BOD,
-- ARC, IT, Production LT and the existing Wellbeing Pulse pilot). Moving
-- participant results between organisations to fix a NAME is a historical
-- rewrite, and DISC reporting is organisation-scoped.
--
-- So the canonical record is the one that already holds the history, and the
-- only thing that changes about it is its name. Minimum data movement: this
-- migration moves TEAM rows and membership rows. It moves no result, session,
-- response or narrative row anywhere.
--
-- WHY THE ABSORBED TEAMS ARE SAFE TO MOVE.
--
-- a8566eaa's `Applications & ERP Team` carries 32 assessment_results and 32
-- focus_results. Those rows are reached by `team_id`, and every one of them
-- carries `organization_id IS NULL` — they were never organisation-tagged. So
-- re-parenting the team changes the team's organisation and leaves every
-- result row untouched and unambiguous. The re-check below proves that again
-- at apply time rather than trusting this comment.
--
-- WHAT IS DELIBERATELY LEFT ALONE.
--
-- Both "Renaissance Africa" records keep their teams and their 36 combined
-- DISC/Focus results. They are a differently-named organisation, not a "Ren"
-- duplicate, and absorbing them would be exactly the tidiness-driven rewrite
-- this migration exists to avoid.
--
-- Nothing is deleted. Absorbed organisations are archived via `archived_at`,
-- which the table already supports, so the rows and their audit trail remain.
-- ─────────────────────────────────────────────────────────────────────

do $$
declare
  canonical uuid := 'cf53d83f-baf5-43a6-97fa-59d2f5ab5c67';
  absorb    uuid[] := array[
    'a8566eaa-f14d-4118-ba4e-e657959473f9'::uuid,  -- "REN Africa Energy", 3 teams
    '6e96d75c-549b-4337-8159-bf311ec56e9c'::uuid   -- "Ren", 1 team (Security)
  ];
  src            uuid;
  tagged_results int;
  moved_teams    int;
  moved_members  int;
  moved_grants   int;
begin
  if not exists (select 1 from public.organizations where id = canonical) then
    raise notice 'organisation consolidation skipped: canonical record not present';
    return;
  end if;

  -- ── 1 · the canonical record takes the correct name ────────────────
  update public.organizations
     set name = 'REN Africa Energy'
   where id = canonical
     and name is distinct from 'REN Africa Energy';

  foreach src in array absorb loop
    if not exists (select 1 from public.organizations where id = src) then
      raise notice 'absorb skipped, organisation % not present', src;
      continue;
    end if;

    -- ── 2 · re-check at apply time, not at authoring time ────────────
    --
    -- The whole safety argument is that no result row is organisation-tagged
    -- to a team being moved. If that ever stops being true, moving the team
    -- would silently strand results under the wrong organisation, so refuse
    -- rather than proceed on a stale assumption.
    select count(*) into tagged_results
    from public.assessment_results r
    join public.teams t on t.id = r.team_id
    where t.organization_id = src
      and r.organization_id is not null
      and r.organization_id is distinct from canonical;

    if tagged_results > 0 then
      raise exception
        'Refusing to absorb %: % assessment_results are organisation-tagged to '
        'a different organisation. Moving these teams would rewrite history.',
        src, tagged_results;
    end if;

    select count(*) into tagged_results
    from public.focus_results r
    join public.teams t on t.id = r.team_id
    where t.organization_id = src
      and r.organization_id is not null
      and r.organization_id is distinct from canonical;

    if tagged_results > 0 then
      raise exception
        'Refusing to absorb %: % focus_results are organisation-tagged '
        'elsewhere.', src, tagged_results;
    end if;

    -- ── 3 · move the teams (team rows only; children ride along by FK) ─
    update public.teams set organization_id = canonical where organization_id = src;
    get diagnostics moved_teams = row_count;

    -- ── 4 · preserve membership ──────────────────────────────────────
    -- (organization_id, profile_id) is unique, so anyone already a member of
    -- the canonical organisation keeps the role they already hold there.
    insert into public.organization_members (organization_id, profile_id, role)
    select canonical, m.profile_id, m.role
    from public.organization_members m
    where m.organization_id = src
    on conflict (organization_id, profile_id) do nothing;
    get diagnostics moved_members = row_count;

    delete from public.organization_members where organization_id = src;

    -- ── 5 · preserve wellbeing grants ────────────────────────────────
    -- Partial unique index (profile, org, role) WHERE revoked_at is null, so a
    -- duplicate grant is skipped rather than raised. The source grants are then
    -- revoked — never deleted — so the audit trail survives.
    insert into public.wellbeing_role_grants
      (profile_id, organization_id, role, granted_by, note)
    select g.profile_id, canonical, g.role, g.granted_by,
           'Carried to the canonical organisation by migration 00043.'
    from public.wellbeing_role_grants g
    where g.organization_id = src
      and g.revoked_at is null
    on conflict (profile_id, organization_id, role) where revoked_at is null
    do nothing;
    get diagnostics moved_grants = row_count;

    update public.wellbeing_role_grants
       set revoked_at = now(),
           note = note || ' Revoked by 00043: organisation absorbed into the canonical record.'
     where organization_id = src
       and revoked_at is null;

    -- ── 6 · archive, never delete ────────────────────────────────────
    update public.organizations
       set archived_at = coalesce(archived_at, now()),
           name = name || ' (absorbed ' || left(src::text, 8) || ')'
     where id = src;

    raise notice 'absorbed %: % teams, % memberships, % grants carried',
      src, moved_teams, moved_members, moved_grants;
  end loop;

  raise notice 'canonical organisation is REN Africa Energy (%)', canonical;
end $$;
