-- Remediation: remove ONE empty DISC session created by the broken Wellbeing QR.
--
-- ─────────────────────────────────────────────────────────────────────
-- SCOPE. One row, addressed by its primary key. Nothing else.
--
--   assessment_sessions.id = dcd1e31b-32ba-4302-897c-4e5676fd4472
--
-- There is deliberately no `where team_id = …`, no `where current_index = 0`,
-- no `where status = 'in_progress'`. A predicate that describes a class of
-- rows can match a row somebody added between the audit and the run; a primary
-- key cannot. Every condition below is an ASSERTION about that one row, not a
-- selector for others.
--
-- WHAT THIS ROW IS.
--
--   profile_id     a11a9102-d52a-4513-932e-c17548c3b238  (vitus moses)
--   team_id        d3733a1d-34f5-4be2-a410-3644f50dcf45  (Management Pilot)
--   status         in_progress
--   current_index  0
--   started_at     2026-08-26T07:32:19.432775+00:00
--   responses      0
--   results        0
--
-- The profile was created at 07:32:17 and the session at 07:32:19 — two
-- seconds later. A participant scanned the Wellbeing Pulse code, was routed to
-- the DISC join form by the fault, signed up, and a DISC session shell was
-- created before they answered anything. They then stopped.
--
-- WHY IT HAS TO GO.
--
-- 00032's backfill skipped this campaign because a session existed, which is
-- why the pilot is still assessment_type='disc'. 00037 fixes the rule so a
-- shell no longer blocks conversion — this script removes the shell itself, so
-- no DISC surface offers this participant a resumable assessment on a
-- wellbeing campaign.
--
-- BLAST RADIUS, from the foreign keys that reference assessment_sessions:
--
--   assessment_responses.session_id   on delete cascade   — 0 rows
--   assessment_results.session_id     on delete cascade   — 0 rows
--   combined_sessions.disc_session_id on delete set null  — 0 rows
--
-- Nothing else in the schema references assessment_sessions. With all three at
-- zero, deleting this row deletes exactly one row.
--
-- WHAT IS NOT TOUCHED: the participant, their profile, their identity alias,
-- their team membership, the campaign, and every DISC, Focus and Wellbeing
-- result anywhere in the database. This participant has no result of any kind.
--
-- WHY THIS LIVES OUTSIDE scripts/.
--
-- Everything under scripts/ is a development tool, and every writer there must
-- refuse to run anywhere but a local database — enforced by
-- lib/wellbeing/seed-safety.test.ts. This is the opposite kind of thing: a
-- one-shot repair whose only correct target IS the hosted database the audit
-- was performed against. It still fails closed, but towards that database
-- rather than away from it, which is why it cannot live beside the seeds.
--
-- HOW TO RUN — the flag is required and must come first:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/remediations/00001_pilot_stray_session.sql
--
-- Without ON_ERROR_STOP psql prints a failed assertion and runs the DELETE
-- anyway. That is not hypothetical: it is how seed guards in this repo were
-- once decorative.
-- ─────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

-- ── fail closed towards the audited database ─────────────────────────
--
-- Running this against the wrong database must be an explicit refusal, not a
-- quiet no-op that reads like success. Both audited identities have to be
-- present before anything is touched. Nothing here is a secret: they are the
-- ids the audit was reported with.

do $target$
begin
  if not exists (select 1 from public.teams where id = 'd3733a1d-34f5-4be2-a410-3644f50dcf45') then
    raise exception
      'Refusing: this database has no Management Pilot campaign (d3733a1d…). It is not the database this remediation was audited against.';
  end if;
  if not exists (select 1 from public.profiles where id = 'a11a9102-d52a-4513-932e-c17548c3b238') then
    raise exception
      'Refusing: this database has no audited participant (a11a9102…). It is not the database this remediation was audited against.';
  end if;
end;
$target$;

begin;

do $$
declare
  v_session   public.assessment_sessions%rowtype;
  v_responses int;
  v_results   int;
  v_combined  int;
begin
  select * into v_session
  from public.assessment_sessions
  where id = 'dcd1e31b-32ba-4302-897c-4e5676fd4472';

  -- Already remediated is a success, not a failure: re-running must be safe.
  if not found then
    raise notice 'session dcd1e31b… is already absent — nothing to do';
    return;
  end if;

  -- ── every fact from the audit, re-proved at run time ──────────────
  --
  -- If ANY of these has changed since the audit, the row is no longer the row
  -- that was reviewed, and this script must not touch it.

  if v_session.team_id <> 'd3733a1d-34f5-4be2-a410-3644f50dcf45' then
    raise exception 'refusing: session belongs to team %, not the Management Pilot', v_session.team_id;
  end if;

  if v_session.profile_id <> 'a11a9102-d52a-4513-932e-c17548c3b238' then
    raise exception 'refusing: session belongs to profile %, not the audited participant', v_session.profile_id;
  end if;

  if v_session.status <> 'in_progress' then
    raise exception 'refusing: session status is %, not in_progress — it has advanced since the audit', v_session.status;
  end if;

  if v_session.completed_at is not null then
    raise exception 'refusing: session was completed at % — this is real history', v_session.completed_at;
  end if;

  if v_session.current_index <> 0 then
    raise exception 'refusing: current_index is % — the participant has made progress', v_session.current_index;
  end if;

  select count(*) into v_responses
  from public.assessment_responses where session_id = v_session.id;
  if v_responses <> 0 then
    raise exception 'refusing: session has % response(s) — these are real answers', v_responses;
  end if;

  select count(*) into v_results
  from public.assessment_results where session_id = v_session.id;
  if v_results <> 0 then
    raise exception 'refusing: session has % result(s) — this is real history', v_results;
  end if;

  select count(*) into v_combined
  from public.combined_sessions where disc_session_id = v_session.id;
  if v_combined <> 0 then
    raise exception 'refusing: session is linked to % combined session(s)', v_combined;
  end if;

  -- Proven empty. One row, by primary key.
  delete from public.assessment_sessions where id = v_session.id;

  raise notice 'removed empty DISC session dcd1e31b… from the Management Pilot';
end;
$$;

-- The participant, their membership and the campaign must all still be here.
-- A remediation that quietly took one of them with it would be far worse than
-- the fault it repairs.
do $$
begin
  if not exists (select 1 from public.profiles where id = 'a11a9102-d52a-4513-932e-c17548c3b238') then
    raise exception 'ABORT: the participant profile was removed';
  end if;
  if not exists (
    select 1 from public.team_members
    where profile_id = 'a11a9102-d52a-4513-932e-c17548c3b238'
      and team_id = 'd3733a1d-34f5-4be2-a410-3644f50dcf45'
  ) then
    raise exception 'ABORT: the participant lost their campaign membership';
  end if;
  if not exists (select 1 from public.teams where id = 'd3733a1d-34f5-4be2-a410-3644f50dcf45') then
    raise exception 'ABORT: the Management Pilot campaign was removed';
  end if;
end;
$$;

commit;
