-- ─────────────────────────────────────────────────────────────────────
-- HELD OUT OF THE MIGRATION SET. NOT APPLIED TO PRODUCTION.
--
-- This file was `supabase/migrations/00038_who5_content.sql` and has been moved
-- here unchanged apart from this header. It is no longer a migration, because
-- `supabase db push` has no way to apply a SUBSET of pending migrations — it
-- applies every one it finds. So the only reliable way to keep licensed
-- questionnaire wording and instrument activation out of production is to keep
-- them out of `supabase/migrations/`.
--
-- WHAT IT DOES: loads third-party questionnaire wording and marks the affected
-- versions `licensed` + `is_active`. Content and activation, coupled.
--
-- WHY IT IS HELD: see supabase/instrument-content/README.md. In short —
-- GHQ-12's required GL Assessment attribution wording is unconfirmed, GHQ-28's
-- Section D support wording is unapproved by Occupational Health, and WHO-5 is
-- not being switched on this release. None of that is a technical readiness
-- question; the engines, scoring and tests are complete and certified.
--
-- HOW TO RUN IT LOCALLY (after `npx supabase db reset`):
--
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f supabase/instrument-content/00038_who5_content.sql
--
-- TO PROMOTE IT when governance approves: move it back into
-- `supabase/migrations/` with a NEW number (it must never reuse 00038, which
-- history records as unapplied), and delete this header including the guard —
-- a migration must be able to run against production, which is the whole point
-- of promoting it.
-- ─────────────────────────────────────────────────────────────────────

-- Abort on the FIRST error. Without this the local-host guard below is
-- decorative: `raise exception` inside a DO block ends that block, psql
-- reports it and then carries straight on — so a file that "refuses to run"
-- against the wrong database would load it anyway.
\set ON_ERROR_STOP on

do $guard$
begin
  -- Loopback, or a private (RFC1918 / Docker) address. A hosted Supabase
  -- instance is on neither, so this refuses anything reachable from outside.
  if inet_server_addr() is not null
     and not (inet_server_addr() <<= inet '127.0.0.0/8'
           or inet_server_addr() <<= inet '10.0.0.0/8'
           or inet_server_addr() <<= inet '172.16.0.0/12'
           or inet_server_addr() <<= inet '192.168.0.0/16') then
    raise exception
      'Refusing to load held instrument content into a non-local host %. '
      'This content is governance-held; promote it to a migration instead.',
      inet_server_addr();
  end if;
end;
$guard$;

-- WHO-5 Well-Being Index — questionnaire content.
--
-- ─────────────────────────────────────────────────────────────────────
-- SOURCE, VERIFIED BEFORE COMMITTING.
--
-- World Health Organization. The World Health Organization-Five Well-Being
-- Index (WHO-5). Geneva: World Health Organization; 2024.
-- Document WHO/UCN/MSD/MHE/2024.1. Licence: CC BY-NC-SA 3.0 IGO.
-- https://www.who.int/publications/m/item/WHO-UCN-MSD-MHE-2024.01
--
-- The wording below is reproduced VERBATIM from that publication. It is not
-- paraphrased, not drawn from a secondary website, and shares no wording with
-- GHQ-12, GHQ-28 or the DISC360 Wellbeing Pulse. `data/who5-items.ts` is the
-- authored source; Postgres is the runtime source, exactly as every other
-- instrument in this platform.
--
-- WHY THIS FILLS IN A ROW RATHER THAN CREATING ONE.
--
-- 00027 registered WHO-5's STRUCTURE and deliberately left the wording null,
-- because the exact source version and its licence had not been confirmed.
-- That confirmation has now happened, so this migration completes the row that
-- was left open — it does not insert a second version. Updating in place keeps
-- the item ids stable, which is what any stored response would reference.
--
-- LICENCE CONDITIONS THIS MIGRATION HONOURS.
--
--   · NonCommercial. Recorded as `internal_noncommercial` and enforced in
--     `canServeToParticipants` — WHO-5 does not reach a participant in an
--     organisation without that classification.
--   · ShareAlike. Applies to adaptations. This reproduces the instrument
--     exactly, which is not an adaptation. No item is ever edited in place.
--   · No WHO logo, anywhere. The publication forbids its use.
--   · No suggestion of endorsement. An explicit non-endorsement statement is
--     recorded here and in the instrument registry, and renders wherever
--     WHO-5 appears.
--
-- WHAT THIS MIGRATION DOES NOT DO.
--
-- It does not touch GHQ-12 or GHQ-28, whose wording remains null and awaits
-- separate licence confirmation. It does not touch the DISC360 Wellbeing
-- Pulse. It writes five prompts, thirty anchor labels, and one version row.
-- ─────────────────────────────────────────────────────────────────────

-- ── 0 · refuse a database that is not in the expected state ──────────

do $$
begin
  if not exists (
    select 1 from public.wellbeing_versions
    where id = '00000000-0000-4000-8000-0000000000b1'
      and instrument_key = 'who5'
  ) then
    raise exception
      'WHO-5 content: the structure row from 00027 is missing — refusing to guess at a version';
  end if;
end;
$$;

-- ── 1 · the version becomes licensed content ─────────────────────────

update public.wellbeing_versions
set
  name = 'WHO-5 Well-Being Index',
  content_status = 'licensed',
  licence_holder = 'World Health Organization',
  licence_reference = 'WHO/UCN/MSD/MHE/2024.1 · CC BY-NC-SA 3.0 IGO',
  licence_note =
    'Reproduced verbatim from the official WHO publication under CC BY-NC-SA 3.0 IGO. '
    || 'Intended use is internal and non-commercial. The World Health Organization does not '
    || 'endorse DISC360 or Wellbeing Pulse and is not responsible for any interpretation '
    || 'presented here. No WHO logo is used. Suggested citation: World Health Organization. '
    || 'The World Health Organization-Five Well-Being Index (WHO-5). Geneva: World Health '
    || 'Organization; 2024. Licence: CC BY-NC-SA 3.0 IGO.',
  is_active = true,
  updated_at = now()
where id = '00000000-0000-4000-8000-0000000000b1';

-- ── 2 · the five items, in the published order ───────────────────────
--
-- dimension_key and facet stay NULL. WHO-5 is a single scale with no
-- subscales, and inventing one to fill a column would be fabricating structure
-- the instrument does not have.

update public.wellbeing_items i
set prompt = w.prompt
from (
  values
    ('who5_item_01', 'I have felt cheerful and in good spirits'),
    ('who5_item_02', 'I have felt calm and relaxed'),
    ('who5_item_03', 'I have felt active and vigorous'),
    ('who5_item_04', 'I woke up feeling fresh and rested'),
    ('who5_item_05', 'My daily life has been filled with things that interest me')
) as w (external_id, prompt)
where i.version_id = '00000000-0000-4000-8000-0000000000b1'
  and i.external_id = w.external_id;

-- ── 3 · the six response anchors ─────────────────────────────────────
--
-- Stored in ASCENDING point order: position 0 is the lowest frequency and
-- scores 0. The publication's table prints the highest frequency leftmost;
-- that is layout, and the points attached to each anchor are the same either
-- way. Keeping position and points in step means a stored position can never
-- be read back as the wrong anchor.
--
-- bimodal_score and likert_score stay NULL — those are GHQ scoring columns and
-- carry no meaning for WHO-5, which sums `points` directly.

update public.wellbeing_item_options o
set label = a.label, points = a.points
from public.wellbeing_items i,
  (values
    (0, 'At no time',                 0::smallint),
    (1, 'Some of the time',           1::smallint),
    (2, 'Less than half of the time', 2::smallint),
    (3, 'More than half of the time', 3::smallint),
    (4, 'Most of the time',           4::smallint),
    (5, 'All of the time',            5::smallint)
  ) as a (position, label, points)
where o.item_id = i.id
  and i.version_id = '00000000-0000-4000-8000-0000000000b1'
  and o.position = a.position;

-- ── 4 · confirm the seed is internally consistent ────────────────────
--
-- A content migration that half-applied would produce a questionnaire that
-- scores wrongly rather than one that visibly fails, so it checks itself and
-- raises rather than warns.

do $$
declare
  v_items int;
  v_worded int;
  v_options int;
  v_labelled int;
  v_max_raw int;
begin
  select count(*) into v_items
  from public.wellbeing_items
  where version_id = '00000000-0000-4000-8000-0000000000b1';
  if v_items <> 5 then
    raise exception 'WHO-5 seed: expected 5 items, found %', v_items;
  end if;

  select count(*) into v_worded
  from public.wellbeing_items
  where version_id = '00000000-0000-4000-8000-0000000000b1' and prompt is not null;
  if v_worded <> 5 then
    raise exception 'WHO-5 seed: expected 5 worded items, found %', v_worded;
  end if;

  select count(*) into v_options
  from public.wellbeing_item_options o
  join public.wellbeing_items i on i.id = o.item_id
  where i.version_id = '00000000-0000-4000-8000-0000000000b1';
  if v_options <> 30 then
    raise exception 'WHO-5 seed: expected 30 options (5 items x 6), found %', v_options;
  end if;

  select count(*) into v_labelled
  from public.wellbeing_item_options o
  join public.wellbeing_items i on i.id = o.item_id
  where i.version_id = '00000000-0000-4000-8000-0000000000b1' and o.label is not null;
  if v_labelled <> 30 then
    raise exception 'WHO-5 seed: expected 30 labelled anchors, found %', v_labelled;
  end if;

  -- The published maximum: five items at five points each is a raw 25, which
  -- the x4 transform turns into 100. If this is not 25, the anchors are wrong.
  select sum(m.top) into v_max_raw
  from (
    select max(o.points) as top
    from public.wellbeing_item_options o
    join public.wellbeing_items i on i.id = o.item_id
    where i.version_id = '00000000-0000-4000-8000-0000000000b1'
    group by i.id
  ) m;
  if v_max_raw <> 25 then
    raise exception 'WHO-5 seed: maximum raw score is %, expected 25', v_max_raw;
  end if;

  raise notice 'WHO-5 content seeded: 5 worded items, 30 labelled anchors, raw max 25 (percentage 100)';
end;
$$;

-- ── 5 · the licence-gated instruments stay gated ─────────────────────
--
-- Asserted here rather than assumed. This migration is the first to publish
-- third-party wording, so it is the right place to prove it published only
-- its own — a GHQ prompt appearing now would mean content leaked in behind an
-- unrelated change.

do $$
declare
  v_leaked int;
begin
  select count(*) into v_leaked
  from public.wellbeing_items i
  join public.wellbeing_versions v on v.id = i.version_id
  where v.instrument_key in ('ghq12', 'ghq28') and i.prompt is not null;
  if v_leaked > 0 then
    raise exception
      'GHQ content is present (% worded item(s)) but its licence is not confirmed', v_leaked;
  end if;
end;
$$;

-- ── 6 · one active version per instrument ────────────────────────────
--
-- Added last so it validates the row just settled. Two active versions of one
-- instrument would make "which questionnaire did this person answer" depend on
-- row order, and a result is only reproducible if that question has one answer.

create unique index if not exists wellbeing_versions_one_active_per_instrument
  on public.wellbeing_versions (instrument_key)
  where is_active;
