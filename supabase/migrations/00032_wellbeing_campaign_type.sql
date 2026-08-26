-- A Wellbeing Pulse campaign is its own kind of team, not a DISC team.
--
-- ─────────────────────────────────────────────────────────────────────
-- THE PRODUCT BOUNDARY THIS RESTORES.
--
-- 00025 reused `teams` as the campaign entity rather than adding a parallel
-- one, which was the right call: a campaign has members, an organisation, a
-- join token and a facilitator, and duplicating all of that would have meant
-- two identity models to keep in step.
--
-- What it did NOT do is tell the rest of the product that such a team is a
-- different product. `teams.assessment_type` is the field every DISC surface
-- reads to decide what to render — the team layout, the dashboard, settings,
-- live state, the join context and the session guard all branch on it. The
-- enum gained a 'wellbeing' value in 00023 and then nothing ever wrote it.
--
-- The result was a wellbeing campaign that rendered the full DISC team
-- experience: DISC Behaviour Assessment, Compare Members, Executive Brief, AI
-- Insights. Compare Members is the worst of those by some distance — it is a
-- named-person comparison, and a wellbeing campaign must never offer one.
--
-- WHY A BACKFILL AND A TRIGGER RATHER THAN A DEFAULT.
--
-- A default would fix new campaigns and leave existing ones mislabelled. The
-- backfill converts any team already carrying a wellbeing instrument, and the
-- trigger keeps the two fields in agreement afterwards, so a campaign cannot
-- drift back into being a DISC team by an UPDATE that forgets one of them.
--
-- Non-destructive: it sets a type on rows that carry a wellbeing instrument
-- and touches nothing else. No DISC team, result, session or score is read or
-- written here.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1 · existing campaigns are relabelled, nothing else ──────────────
--
-- Scoped to teams that carry a wellbeing instrument AND hold no DISC, Focus or
-- Combined work. A team that somehow has both is left alone and reported by
-- the assertion below rather than silently converted — losing a real DISC
-- team's identity would be far worse than an inconsistent label.

update public.teams t
set assessment_type = 'wellbeing'
where t.wellbeing_instrument_key is not null
  and t.assessment_type <> 'wellbeing'
  and not exists (
    select 1 from public.assessment_sessions s where s.team_id = t.id
  )
  and not exists (
    select 1 from public.focus_sessions f where f.team_id = t.id
  );

do $$
declare
  v_conflicted int;
begin
  select count(*) into v_conflicted
  from public.teams t
  where t.wellbeing_instrument_key is not null and t.assessment_type <> 'wellbeing';
  if v_conflicted > 0 then
    raise warning
      'wellbeing instrument set on % team(s) that also hold DISC or Focus work; left as-is for manual review',
      v_conflicted;
  end if;
end;
$$;

-- ── 2 · the two fields stay in agreement ─────────────────────────────

create or replace function public.enforce_wellbeing_campaign_type()
returns trigger language plpgsql as $$
begin
  -- Choosing an instrument makes a team a wellbeing campaign.
  if new.wellbeing_instrument_key is not null then
    new.assessment_type := 'wellbeing';
    return new;
  end if;

  -- Clearing the instrument on a campaign that has no attempts returns it to
  -- an ordinary team. Once attempts exist the campaign-lock trigger refuses
  -- the change anyway, so there is nothing to unwind here.
  if new.wellbeing_instrument_key is null and new.assessment_type = 'wellbeing' then
    new.assessment_type := 'disc';
  end if;

  return new;
end;
$$;

create trigger wellbeing_campaign_type
  before insert or update of wellbeing_instrument_key, assessment_type on public.teams
  for each row execute function public.enforce_wellbeing_campaign_type();

-- The lookup every DISC surface now uses to exclude campaigns.
create index if not exists teams_assessment_type_idx
  on public.teams (assessment_type)
  where archived_at is null;

comment on column public.teams.assessment_type is
  'Which PRODUCT this team belongs to. ''wellbeing'' campaigns are managed under /wellbeing and must never render DISC team surfaces — kept in agreement with wellbeing_instrument_key by enforce_wellbeing_campaign_type().';
