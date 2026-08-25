-- A Wellbeing Pulse campaign is locked to exactly one instrument.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHY THIS IS A DATABASE TRIGGER RATHER THAN A UI RULE.
--
-- Switching a live campaign's instrument would silently reinterpret every
-- result already collected under it: a team's GHQ-12 twos would sit in the
-- same campaign as DISC360 Wellbeing seventies, and every aggregate over that
-- campaign would mix two scales running in opposite directions.
--
-- A disabled dropdown does not prevent that — a server action, a script, a
-- support fix or a future refactor all bypass it. The guarantee has to live
-- where the write happens.
--
-- What is still allowed: SETTING the instrument on a campaign that has no
-- attempts yet, and CLEARING it back to null before anyone starts. Only a
-- change away from an instrument that already has attempts is refused.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.enforce_wellbeing_instrument_lock()
returns trigger language plpgsql as $$
declare
  v_attempts int;
begin
  -- Nothing to protect if the instrument is not changing.
  if new.wellbeing_instrument_key is not distinct from old.wellbeing_instrument_key then
    return new;
  end if;

  -- Nothing to protect if no instrument was chosen yet.
  if old.wellbeing_instrument_key is null then
    return new;
  end if;

  select count(*) into v_attempts
  from public.wellbeing_sessions s
  where s.team_id = new.id
    and s.instrument_key = old.wellbeing_instrument_key;

  if v_attempts > 0 then
    raise exception using
      errcode = 'check_violation',
      message = format(
        'Wellbeing instrument is locked: %s participant attempt(s) already exist for %s on this campaign.',
        v_attempts, old.wellbeing_instrument_key),
      hint = 'Create a new campaign to run a different instrument.';
  end if;

  return new;
end;
$$;

create trigger wellbeing_instrument_lock
  before update of wellbeing_instrument_key on public.teams
  for each row execute function public.enforce_wellbeing_instrument_lock();

-- Lookup path for the trigger and for the facilitator dashboard.
create index if not exists wellbeing_sessions_team_instrument_idx
  on public.wellbeing_sessions (team_id, instrument_key);
