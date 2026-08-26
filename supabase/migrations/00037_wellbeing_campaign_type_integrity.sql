-- A wellbeing campaign may never SILENTLY remain a DISC team.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT WENT WRONG, EXACTLY.
--
-- 00032 relabelled wellbeing campaigns and reported success. It left the one
-- campaign it existed for — "Wellbeing Pulse — Management Pilot" — as
-- assessment_type='disc', so every printed QR code kept resolving to the DISC
-- join form.
--
-- Its backfill skipped any team holding an `assessment_sessions` row. The
-- pilot had exactly one: in_progress, current_index 0, ZERO responses, created
-- two seconds after the participant signed up, by the very bug being fixed.
-- Someone scanned the wellbeing code, landed on the DISC join page, and a DISC
-- session shell was created. So the artefact of the fault became the thing
-- that blocked its repair.
--
-- The mismatch was reported with `raise warning`. A warning does not fail a
-- migration, does not fail `db push`, and does not appear in any deployment
-- gate. The database ended in exactly the state the migration was written to
-- prevent, and said it had succeeded.
--
-- THE THREE CORRECTIONS.
--
-- 1 · A SESSION SHELL IS NOT HISTORY. The guard asks the wrong question. What
--     must never be silently reclassified is a team holding real DISC or Focus
--     work — an ANSWER or an OUTCOME. An empty in-progress session is neither;
--     it is a row that records that somebody opened a page.
--
-- 2 · REFUSE, RATHER THAN WARN OR SILENTLY CONVERT. 00032's trigger forces
--     assessment_type := 'wellbeing' whenever an instrument is present. On a
--     team carrying genuine DISC results that is a silent reclassification of
--     real history. It now raises instead, and the campaign is recorded as
--     requiring explicit reconciliation.
--
-- 3 · MAKE THE BAD STATE UNREPRESENTABLE. A check constraint ends the class of
--     bug rather than this instance of it: a team carrying a wellbeing
--     instrument is either a wellbeing campaign, or it is explicitly and
--     visibly marked as needing reconciliation. There is no third state, so
--     there is nothing left to drift into silently.
--
-- WHAT THIS MIGRATION DOES NOT DO.
--
-- It deletes nothing. It does not remove the stray session — that is a
-- narrowly scoped, separately reviewed production remediation targeting one
-- UUID (scripts/remediate-pilot-stray-session.sql). A migration that deletes
-- participant rows on the way past is exactly the kind of thing nobody can
-- review safely.
--
-- Rollback:
--   alter table public.teams drop constraint teams_wellbeing_type_is_explicit;
--   alter table public.teams drop column wellbeing_conversion_blocked_reason;
--   -- and restore 00032's enforce_wellbeing_campaign_type() body.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1 · the explicit remediation state ───────────────────────────────
--
-- Nullable, and null is the healthy case. A value here means: this team
-- carries a wellbeing instrument, it could not be converted, and a human must
-- decide what it is. It is prose because the only consumer is a person.

alter table public.teams
  add column if not exists wellbeing_conversion_blocked_reason text;

comment on column public.teams.wellbeing_conversion_blocked_reason is
  'Set only when a team carries wellbeing_instrument_key but holds real DISC or Focus work, so it cannot be typed as a wellbeing campaign without discarding that history. Non-null means: requires explicit human reconciliation. Never set automatically for an empty session shell.';

-- ── 2 · what actually counts as work ─────────────────────────────────
--
-- An ANSWER or an OUTCOME. Deliberately NOT "a session exists": a session row
-- with no responses is the footprint of opening a page, and treating it as
-- history is the precise mistake that left the pilot mislabelled.
--
-- Stable, immutable and side-effect free, so it can sit in the trigger and in
-- the backfill without either drifting from the other.

create or replace function public.team_holds_assessment_work(p_team_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    exists (
      select 1
      from public.assessment_responses r
      join public.assessment_sessions s on s.id = r.session_id
      where s.team_id = p_team_id
    )
    or exists (
      select 1
      from public.assessment_results ar
      join public.assessment_sessions s on s.id = ar.session_id
      where s.team_id = p_team_id
    )
    or exists (
      select 1
      from public.focus_responses fr
      join public.focus_sessions fs on fs.id = fr.session_id
      where fs.team_id = p_team_id
    )
    or exists (
      select 1
      from public.focus_results fres
      join public.focus_sessions fs on fs.id = fres.session_id
      where fs.team_id = p_team_id
    );
$$;

comment on function public.team_holds_assessment_work(uuid) is
  'True when a team holds a DISC or Focus ANSWER or RESULT. An empty in-progress session is not work — it records that a page was opened, and must never block a campaign conversion or be mistaken for history.';

revoke all on function public.team_holds_assessment_work(uuid) from public;
grant execute on function public.team_holds_assessment_work(uuid) to authenticated, service_role;

-- ── 3 · the trigger refuses instead of silently reclassifying ────────

create or replace function public.enforce_wellbeing_campaign_type()
returns trigger language plpgsql as $$
begin
  if new.wellbeing_instrument_key is not null then
    -- Already a campaign BEFORE this statement. Nothing about its identity is
    -- changing, so there is nothing to check; the assignment simply refuses to
    -- let an UPDATE type it back to DISC while it still holds an instrument.
    --
    -- This tests OLD, deliberately. Testing `new.assessment_type = 'wellbeing'`
    -- reads the value the statement is trying to write, so the single most
    -- dangerous statement there is — `set assessment_type = 'wellbeing'` on a
    -- team full of DISC results — would satisfy it and skip the check below.
    -- The local conversion harness caught exactly that.
    if tg_op = 'UPDATE' and old.assessment_type = 'wellbeing' then
      new.assessment_type := 'wellbeing';
      new.wellbeing_conversion_blocked_reason := null;
      return new;
    end if;

    -- Becoming a campaign. On INSERT there is no history to lose.
    if tg_op = 'INSERT' or not public.team_holds_assessment_work(new.id) then
      new.assessment_type := 'wellbeing';
      new.wellbeing_conversion_blocked_reason := null;
      return new;
    end if;

    -- Real DISC or Focus work exists. 00032 would have silently overwritten
    -- this team's identity; refusing is the only safe answer, because the
    -- alternative is deciding on somebody's behalf what happens to their
    -- results.
    raise exception
      'team % holds DISC or Focus results and cannot be converted to a wellbeing campaign; reconcile it explicitly (move the wellbeing campaign to its own team, or archive the DISC history first)',
      new.id
      using errcode = 'check_violation';
  end if;

  -- Clearing the instrument returns an unstarted campaign to an ordinary team.
  if new.wellbeing_instrument_key is null and new.assessment_type = 'wellbeing' then
    new.assessment_type := 'disc';
    new.wellbeing_conversion_blocked_reason := null;
  end if;

  return new;
end;
$$;

-- ── 4 · the corrected backfill ───────────────────────────────────────
--
-- Runs the conversion 00032 intended, with the guard it should have had. The
-- trigger fires on each row and is the single definition of "safe to convert",
-- so this cannot disagree with the rule enforced from here on.

update public.teams t
set assessment_type = 'wellbeing'
where t.wellbeing_instrument_key is not null
  and t.assessment_type <> 'wellbeing'
  and not public.team_holds_assessment_work(t.id);

-- Anything still unconverted genuinely holds work. Record WHY, per team, so
-- the facilitator surface can state it rather than showing a healthy campaign.
update public.teams t
set wellbeing_conversion_blocked_reason =
  'Carries a wellbeing instrument but also holds DISC or Focus results. Reconcile explicitly: move the wellbeing campaign onto its own team, or archive the existing assessment history first.'
where t.wellbeing_instrument_key is not null
  and t.assessment_type <> 'wellbeing'
  and t.wellbeing_conversion_blocked_reason is null;

-- ── 5 · fail loudly ──────────────────────────────────────────────────
--
-- `raise exception`, not `raise warning`. This is the line 00032 got wrong:
-- inside a DO block a warning prints and the migration proceeds to report
-- success. An exception aborts the transaction, so a deployment cannot claim
-- the invariant holds while it does not.

do $$
declare
  v_silent int;
  v_blocked int;
begin
  select count(*) into v_silent
  from public.teams t
  where t.wellbeing_instrument_key is not null
    and t.assessment_type <> 'wellbeing'
    and t.wellbeing_conversion_blocked_reason is null;

  if v_silent > 0 then
    raise exception
      '% team(s) carry a wellbeing instrument, are not typed as wellbeing campaigns, and carry no reconciliation reason — this is the silent state 00037 exists to abolish',
      v_silent;
  end if;

  select count(*) into v_blocked
  from public.teams t
  where t.wellbeing_conversion_blocked_reason is not null;

  if v_blocked > 0 then
    -- Visible, attributed and surfaced to the facilitator. Not silent, so the
    -- migration is allowed to complete.
    raise notice
      '% wellbeing campaign(s) require explicit reconciliation; see teams.wellbeing_conversion_blocked_reason',
      v_blocked;
  end if;
end;
$$;

-- ── 6 · the state cannot come back ───────────────────────────────────
--
-- Added last, so it validates the rows the backfill has just settled. From
-- here a wellbeing instrument implies either a wellbeing campaign or a written
-- reason it is not one — enforced by the database rather than by remembering.

alter table public.teams
  add constraint teams_wellbeing_type_is_explicit
  check (
    wellbeing_instrument_key is null
    or assessment_type = 'wellbeing'
    or wellbeing_conversion_blocked_reason is not null
  );

comment on constraint teams_wellbeing_type_is_explicit on public.teams is
  'A team carrying a wellbeing instrument is either a wellbeing campaign or explicitly marked as needing reconciliation. 00032 allowed a third, silent state in which a campaign stayed a DISC team and every printed QR opened the DISC assessment.';

create index if not exists teams_wellbeing_conversion_blocked_idx
  on public.teams (wellbeing_conversion_blocked_reason)
  where wellbeing_conversion_blocked_reason is not null;
