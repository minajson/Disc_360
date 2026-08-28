-- Every score rule states the scale it is on.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT WAS WRONG, AND WHY IT LOOKED RIGHT.
--
-- 00039 removed two GHQ-12 assumptions from the threshold constraints. Auditing
-- the rest of the score rules found three more of the same shape, plus two
-- fail-open defaults. Every one of them was written when GHQ-12 was the only
-- instrument on the platform, and every one reads plausibly beside GHQ-12.
--
--  1 · THE FLAG'S ARITHMETIC WAS GHQ'S.
--
--      wellbeing_results_threshold_matches_flag defined the stored flag as
--
--          at_or_above_threshold = (total_score >= threshold_at_completion)
--
--      `total_score` is the instrument's RAW total. WHO-5's cut-off of 50 is a
--      number on its TRANSFORMED scale, stored in `index_score`; its raw total
--      cannot exceed 25. So the comparison was not merely inaccurate for WHO-5,
--      it was unsatisfiable: every WHO-5 result at or above the cut-off was
--      REJECTED AT INSERT, and a participant reporting strong wellbeing would
--      have completed the questionnaire and been told it could not be scored.
--
--      Zero WHO-5 results exist in any database, which is the only reason this
--      was found by a test rather than by a person.
--
--  2 · THE LIKERT BOUND WAS GHQ-12'S.
--
--      `likert_score between 0 and 36` is 12 items x 3. GHQ-28's Likert total
--      runs to 84 (28 x 3), so a GHQ-28 result scoring above 36 on the
--      secondary measure was rejected at insert — reachable by any participant
--      answering in the upper half throughout.
--
--  3 · THE POLICY BOUND WAS GHQ-12'S.
--
--      `screening_threshold between 1 and 12` is GHQ-12's range, applied to a
--      table whose rows can govern any instrument. GHQ-28 runs 0–28 and WHO-5
--      0–100, so neither could record its own governed cut-off.
--
--  4 · TWO RULES FAILED OPEN.
--
--      The per-instrument CASE bounds ended `else total_score <= 1000` and
--      `else array_length(item_positions, 1) between 1 and 50`. A newly added
--      instrument therefore got a meaningless bound INSTEAD OF an error — the
--      failure mode that put five directional defects into shared surfaces in
--      the first place. They now fail closed: an instrument whose bound has not
--      been stated cannot store a result at all.
--
-- WHAT THIS DOES NOT DO.
--
-- No stored value moves and no row is recomputed. Every existing result is
-- DISC360 Wellbeing V1 with no threshold and no Likert score, and the only
-- policy row governs GHQ-12 with a threshold of 4 — all still valid, which the
-- assertions below prove BEFORE each constraint is replaced.
--
-- THE ENUMERATIONS ARE DELIBERATE, AND THEY ARE TESTED.
--
-- A CHECK constraint cannot read another table, so each rule enumerates the
-- instruments rather than deriving them at run time. That is a drift risk, so
-- it is not left to vigilance: lib/wellbeing/constraint-integrity.test.ts reads
-- this file and fails if any enumeration disagrees with the instrument registry
-- in data/wellbeing-instruments.ts, or omits an instrument entirely.
-- ─────────────────────────────────────────────────────────────────────

-- ── 0 · drop GHQ-12's hard-coded threshold range ─────────────────────
--
-- `wellbeing_results_threshold_at_completion_check` is
--
--   check (threshold_at_completion between 1 and 12)
--
-- GHQ-12's range. It was written INLINE on the column in 00023, when GHQ-12
-- was the only instrument that had a threshold, and 00023 IS APPLIED TO
-- PRODUCTION — verified with `supabase migration list --linked`, which reports
-- 00001-00037 remote and 00038-00041 unapplied.
--
-- So production carries this bound today. Nothing has gone wrong yet: WHO-5
-- and GHQ-28 are both held and unservable there, and GHQ-12's own cut-off of 4
-- sits inside 1-12. It becomes a live defect the moment WHO-5 is switched on,
-- because its cut-off of 50 would be refused at insert and a participant would
-- complete the questionnaire and be told their pulse could not be scored.
--
-- Dropped here rather than in 00039, deliberately. 00039 is committed and its
-- repository copy is byte-identical to what was committed; the correction is
-- forward-only so migration history stays a record of what ran rather than a
-- description of what we wish had run.

alter table public.wellbeing_results
  drop constraint if exists wellbeing_results_threshold_at_completion_check;

-- ── 1 · prove no existing row would be rejected ──────────────────────

do $$
declare
  v_flag  int;
  v_likert int;
  v_policy int;
begin
  select count(*) into v_flag
  from public.wellbeing_results
  where threshold_at_completion is not null
    and at_or_above_threshold is distinct from (
      case instrument_key
        when 'who5' then index_score
        else total_score
      end >= threshold_at_completion
    );
  if v_flag > 0 then
    raise exception '% result(s) disagree with the scale-aware threshold flag', v_flag;
  end if;

  select count(*) into v_likert
  from public.wellbeing_results
  where case instrument_key
          when 'ghq12' then likert_score is null or likert_score not between 0 and 36
          when 'ghq28' then likert_score is null or likert_score not between 0 and 84
          else likert_score is not null
        end;
  if v_likert > 0 then
    raise exception '% result(s) disagree with the per-instrument Likert rule', v_likert;
  end if;

  select count(*) into v_policy
  from public.wellbeing_policies
  where screening_threshold < 1
     or screening_threshold > case scoring_method
          when 'ghq_bimodal_0011'   then 12
          when 'ghq28_bimodal_0011' then 28
          when 'who5_sum_x4'        then 100
          else 0
        end;
  if v_policy > 0 then
    raise exception '% policy row(s) carry a threshold outside their instrument''s scale', v_policy;
  end if;
end;
$$;

-- ── 2 · the flag is compared on the instrument's own threshold scale ──
--
-- `index_score is not null` is stated rather than assumed. Without it a null
-- index would make the comparison null, and a CHECK that evaluates to NULL
-- PASSES in Postgres — the rule would fail open on exactly the instrument it
-- was written for.

alter table public.wellbeing_results
  drop constraint if exists wellbeing_results_threshold_matches_flag;

alter table public.wellbeing_results
  add constraint wellbeing_results_threshold_matches_flag check (
    case
      when threshold_at_completion is null then at_or_above_threshold is null
      when at_or_above_threshold is null then false
      -- thresholdScale 'raw': the cut-off is a count on the raw total.
      when instrument_key in ('ghq12', 'ghq28')
        then at_or_above_threshold = (total_score >= threshold_at_completion)
      -- thresholdScale 'index': the cut-off is on the transformed scale.
      when instrument_key = 'who5'
        then index_score is not null
         and at_or_above_threshold = (index_score >= threshold_at_completion)
      -- An instrument that has not declared which scale its threshold is on
      -- cannot store one. Failing closed is the point.
      else false
    end
  );

comment on constraint wellbeing_results_threshold_matches_flag on public.wellbeing_results is
  'The stored flag must equal the comparison on the instrument''s OWN threshold scale: the raw '
  'total for GHQ-12 and GHQ-28, the transformed 0-100 index for WHO-5. This constraint used to '
  'read total_score for every instrument, which made WHO-5''s cut-off of 50 unsatisfiable against '
  'a 0-25 raw. It says nothing about what the flag MEANS — at or above is the concerning side on '
  'GHQ and the unremarkable one on WHO-5; that is scoreDirection''s job.';

-- ── 3 · the Likert total is GHQ's, on each GHQ's own scale ───────────

alter table public.wellbeing_results
  drop constraint if exists wellbeing_results_likert_score_check;

alter table public.wellbeing_results
  add constraint wellbeing_results_likert_score_check check (
    case instrument_key
      when 'ghq12' then likert_score is not null and likert_score between 0 and 36
      when 'ghq28' then likert_score is not null and likert_score between 0 and 84
      -- Not "may be null" — MUST be null. WHO-5 and DISC360 Wellbeing define no
      -- Likert measure, so a number in this column would be an invented score.
      else likert_score is null
    end
  );

comment on constraint wellbeing_results_likert_score_check on public.wellbeing_results is
  'GHQ''s secondary continuous measure, bounded per instrument: 0-36 for GHQ-12 (12 items x 3) '
  'and 0-84 for GHQ-28 (28 x 3). The single 0-36 bound was GHQ-12''s, applied platform-wide, and '
  'rejected legitimate GHQ-28 results. Instruments defining no Likert measure must store none.';

-- ── 4 · a policy threshold sits on the scale it governs ──────────────
--
-- `scoring_method` has been on this table since it was created and was never
-- read: lib/wellbeing/policy.ts applied one organisation-wide number to every
-- instrument, so GHQ-28 was scored against GHQ-12's 3/4 split. The column is
-- now the authority for which instrument a policy governs, in code and here.
--
-- A scoring method belonging to an instrument with no threshold falls to 0 and
-- is therefore rejected: you cannot govern a cut-off that does not exist.

alter table public.wellbeing_policies
  drop constraint if exists wellbeing_policies_screening_threshold_check;

alter table public.wellbeing_policies
  add constraint wellbeing_policies_screening_threshold_check check (
    screening_threshold >= 1
    and screening_threshold <= case scoring_method
      when 'ghq_bimodal_0011'   then 12
      when 'ghq28_bimodal_0011' then 28
      when 'who5_sum_x4'        then 100
      else 0
    end
  );

comment on constraint wellbeing_policies_screening_threshold_check on public.wellbeing_policies is
  'A governed threshold must sit on the scale of the instrument its scoring_method names. The '
  'previous 1-12 was GHQ-12''s range applied to every instrument.';

-- ── 5 · the remaining per-instrument bounds fail closed ──────────────

alter table public.wellbeing_results
  drop constraint if exists wellbeing_results_total_score_check;

alter table public.wellbeing_results
  add constraint wellbeing_results_total_score_check check (
    total_score >= 0
    and case instrument_key
      when 'ghq12' then total_score <= 12
      when 'ghq28' then total_score <= 28
      when 'who5' then total_score <= 25            -- raw, before the x4
      when 'disc360_wellbeing_v1' then total_score <= 48
      else false                                    -- was `total_score <= 1000`
    end
  );

alter table public.wellbeing_results
  drop constraint if exists wellbeing_results_item_positions_check;

alter table public.wellbeing_results
  add constraint wellbeing_results_item_positions_check check (
    case instrument_key
      when 'ghq12' then array_length(item_positions, 1) = 12
      when 'ghq28' then array_length(item_positions, 1) = 28
      when 'who5' then array_length(item_positions, 1) = 5
      when 'disc360_wellbeing_v1' then array_length(item_positions, 1) = 12
      else false                                    -- was `between 1 and 50`
    end
  );

alter table public.wellbeing_results
  drop constraint if exists wellbeing_results_threshold_in_range;

alter table public.wellbeing_results
  add constraint wellbeing_results_threshold_in_range check (
    threshold_at_completion is null
    or (
      threshold_at_completion >= 0
      and threshold_at_completion <= case instrument_key
        when 'ghq12' then 12
        when 'ghq28' then 28
        when 'who5'  then 100                       -- the transformed scale
        else -1                                     -- fails closed, was 0
      end
    )
  );

-- ── 6 · the policy lookup returns what it governs ────────────────────
--
-- Returning the threshold without its scoring_method is what allowed a caller
-- to apply it to any instrument. The column travels with the number now.

-- Dropped rather than replaced: `create or replace` cannot change a function's
-- return signature, and adding an output column changes it. Grants are
-- reinstated explicitly below, because dropping takes them with it.
drop function if exists public.wellbeing_active_policy(uuid);

create function public.wellbeing_active_policy(org uuid)
returns table (
  screening_threshold smallint,
  min_cohort_size smallint,
  scoring_method text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p.screening_threshold, p.min_cohort_size, p.scoring_method
  from public.wellbeing_policies p
  where (p.organization_id = org or p.organization_id is null)
    and p.effective_from <= now()
  -- An organisation row outranks the platform default at equal recency.
  order by (p.organization_id is not null) desc, p.effective_from desc
  limit 1;
$function$;

revoke all on function public.wellbeing_active_policy(uuid) from public;
grant execute on function public.wellbeing_active_policy(uuid) to authenticated, service_role;

-- ── 7 · confirm ──────────────────────────────────────────────────────

do $$
declare
  v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
  from pg_constraint
  where conname = 'wellbeing_results_threshold_matches_flag'
    and conrelid = 'public.wellbeing_results'::regclass;
  if v_def is null or v_def not like '%index_score%' then
    raise exception 'the threshold flag is still compared on the raw total alone';
  end if;

  select pg_get_constraintdef(oid) into v_def
  from pg_constraint
  where conname = 'wellbeing_results_likert_score_check'
    and conrelid = 'public.wellbeing_results'::regclass;
  if v_def is null or v_def not like '%84%' then
    raise exception 'the Likert bound is still GHQ-12''s 0-36 platform-wide';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'wellbeing_active_policy'
      and pg_get_function_result(p.oid) like '%scoring_method%'
  ) then
    raise exception 'wellbeing_active_policy does not return the scoring method it governs';
  end if;

  raise notice 'instrument scale integrity installed: flag scale, Likert bound, policy scale, closed defaults';
end;
$$;
