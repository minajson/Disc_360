-- A threshold belongs to whichever instrument defines one.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT WAS WRONG.
--
-- `wellbeing_results_threshold_matches_instrument` named ONE instrument:
--
--   (instrument_key =  'ghq12' and threshold_at_completion is not null)
--   or
--   (instrument_key <> 'ghq12' and threshold_at_completion is null)
--
-- That was right when GHQ-12 was the only instrument with a threshold. It is
-- now wrong in both directions:
--
--   · WHO-5 documents a suggested cut-off (below 50 on its percentage scale)
--     and could not store it — the row would be rejected.
--   · GHQ-28 has a threshold of its own and could not store it either.
--
-- The shape of the rule was also the problem, not just its contents. Written
-- as "is it ghq12", it had to be edited for every instrument ever added, and
-- the edit is easy to forget because nothing fails until a participant
-- completes that instrument in production.
--
-- WHAT REPLACES IT.
--
-- The rule is now stated as what it always meant: an instrument either defines
-- a threshold or it does not, and the row must agree with that. The set is
-- enumerated explicitly rather than inferred, because it is a governance fact
-- — which instruments grade anyone — and it should be readable in the schema
-- rather than only in TypeScript.
--
-- DISC360 Wellbeing Pulse V1 stays OUT of the set deliberately. It is not
-- psychometrically validated, so it carries no threshold and grades nobody.
--
-- WHAT THIS DOES NOT DO.
--
-- It changes no existing row. Every current result is GHQ-12 with a threshold
-- or DISC360 Wellbeing without one, and both still satisfy the new rule —
-- which the check below proves before the constraint is added.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1 · prove no existing row would be rejected ──────────────────────
--
-- Validating first, and loudly. `alter table ... add constraint` validates
-- existing rows anyway, but it reports a row count rather than saying which
-- instrument disagreed — and a migration that fails at 3am should say why.

do $$
declare
  v_bad int;
begin
  select count(*) into v_bad
  from public.wellbeing_results
  where (instrument_key in ('ghq12', 'ghq28', 'who5') and threshold_at_completion is null)
     or (instrument_key not in ('ghq12', 'ghq28', 'who5') and threshold_at_completion is not null);

  if v_bad > 0 then
    raise exception
      '% existing result(s) disagree with the threshold rule — reconcile them before tightening it', v_bad;
  end if;
end;
$$;

-- ── 2 · replace the rule ─────────────────────────────────────────────

alter table public.wellbeing_results
  drop constraint if exists wellbeing_results_threshold_matches_instrument;

alter table public.wellbeing_results
  add constraint wellbeing_results_threshold_matches_instrument
  check (
    (instrument_key in ('ghq12', 'ghq28', 'who5') and threshold_at_completion is not null)
    or
    (instrument_key not in ('ghq12', 'ghq28', 'who5') and threshold_at_completion is null)
  );

comment on constraint wellbeing_results_threshold_matches_instrument on public.wellbeing_results is
  'An instrument either defines a threshold or it does not, and a result must agree. '
  'GHQ-12, GHQ-28 and WHO-5 define one; DISC360 Wellbeing Pulse V1 deliberately does not, '
  'because it is not validated and grades nobody. Adding an instrument means deciding which '
  'side it falls on, here, rather than discovering it when somebody completes it.';

-- ── 3 · the threshold is a number on the instrument's own scale ──────
--
-- A threshold outside the score's range is meaningless and would previously
-- have been storable. GHQ-12 runs 0–12, GHQ-28 runs 0–28, WHO-5 runs 0–100 on
-- its transformed scale — so the bound differs per instrument and a single
-- number would be wrong for two of the three.

alter table public.wellbeing_results
  drop constraint if exists wellbeing_results_threshold_in_range;

alter table public.wellbeing_results
  add constraint wellbeing_results_threshold_in_range
  check (
    threshold_at_completion is null
    or (
      threshold_at_completion >= 0
      and threshold_at_completion <= case instrument_key
        when 'ghq12' then 12
        when 'ghq28' then 28
        when 'who5'  then 100
        else 0
      end
    )
  );

comment on constraint wellbeing_results_threshold_in_range on public.wellbeing_results is
  'A threshold must sit inside its own instrument''s score range. WHO-5''s 50 is on a 0-100 '
  'transformed scale and would be nonsense on GHQ-12''s 0-12.';

-- ── 4 · confirm ──────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wellbeing_results_threshold_matches_instrument'
      and conrelid = 'public.wellbeing_results'::regclass
  ) then
    raise exception 'the threshold rule was not installed';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'wellbeing_results_threshold_in_range'
      and conrelid = 'public.wellbeing_results'::regclass
  ) then
    raise exception 'the threshold range rule was not installed';
  end if;
  raise notice 'threshold rules installed: ghq12, ghq28, who5 carry one; disc360_wellbeing_v1 does not';
end;
$$;
