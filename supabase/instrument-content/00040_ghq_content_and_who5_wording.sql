-- ─────────────────────────────────────────────────────────────────────
-- HELD OUT OF THE MIGRATION SET. NOT APPLIED TO PRODUCTION.
--
-- This file was `supabase/migrations/00040_ghq_content_and_who5_wording.sql` and has been moved
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
--     -v ON_ERROR_STOP=1 -f supabase/instrument-content/00040_ghq_content_and_who5_wording.sql
--
-- TO PROMOTE IT when governance approves: move it back into
-- `supabase/migrations/` with a NEW number (it must never reuse 00040, which
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

-- GHQ-12 and GHQ-28 questionnaire content; WHO-5 wording aligned to the supplied guide.
--
-- ─────────────────────────────────────────────────────────────────────
-- SOURCE, AND WHY IT IS THIS ONE.
--
-- Transcribed verbatim from three documents supplied by the product owner as
-- the authorised implementation source:
--
--   GHQ-12_Questionnaire_and_Assessment_Guide.pdf
--   GHQ-28_Questionnaire_and_Assessment_Guide.pdf
--   WHO-5_Well-Being_Index_and_Assessment_Guide.pdf
--
-- The authored banks are data/ghq12-content.ts, data/ghq28-content.ts and
-- data/who5-items.ts. THIS FILE WAS GENERATED FROM THOSE BANKS rather than
-- retyped, so the runtime source in Postgres cannot drift from the source the
-- tests assert against. A test re-derives both and compares them.
--
-- DISCREPANCIES CARRIED FORWARD, NOT SILENTLY RESOLVED.
--
--   · None of the three documents carries a copyright line, publisher or
--     attribution statement. GHQ-12 (Goldberg & Williams) and GHQ-28
--     (Goldberg & Hillier) are licensed through GL Assessment and normally
--     require attribution, which therefore cannot be populated from these
--     files. The columns are left as the licence recorded them.
--
--   · The GHQ-12 guide placed a score of 4 in two bands at once. Resolved by
--     the product owner to the 3/4 split: 0-3 and 4-12.
--
--   · The GHQ-28 guide states a cut-off of 4. The product owner confirmed 5,
--     which is what the registry already held and what remains in force.
--
--   · The WHO-5 guide's anchors differ from the WHO publication ("All the
--     time" vs "All of the time", and likewise for the two "half the time"
--     anchors), and its items carry trailing full stops. The supplied guide
--     wins, per the owner's instruction. WHO's CC BY-NC-SA attribution is
--     retained regardless, because a licence obligation is not questionnaire
--     wording and the supplied guide contains none.
--
-- WHAT ACTIVATION MEANS HERE, AND WHAT IT DOES NOT.
--
-- Two different switches have to agree before a participant sees anything:
--
--   · `wellbeing_versions.is_active` — WHICH version is served. That is a
--     content fact, so it is set here, alongside the wording it selects.
--   · the registry's `status` — WHETHER the instrument is offered at all.
--     That is a release decision and stays in TypeScript, where one word
--     governs it and a test can assert it.
--
-- This migration sets the first for GHQ-12 and GHQ-28. It does not touch
-- WHO-5's availability: WHO-5's version is already active, and it remains
-- withheld by the registry while its result path is completed.
-- ─────────────────────────────────────────────────────────────────────

-- ── 0 · refuse a database that is not in the expected shape ──────────

do $$
declare
  v_missing text;
begin
  select string_agg(k, ', ') into v_missing
  from (values
    ('ghq12', '00000000-0000-4000-8000-0000000000e1'::uuid),
    ('ghq28', '00000000-0000-4000-8000-0000000000c1'::uuid),
    ('who5',  '00000000-0000-4000-8000-0000000000b1'::uuid)
  ) as w (k, id)
  where not exists (
    select 1 from public.wellbeing_versions v where v.id = w.id and v.instrument_key = w.k
  );
  if v_missing is not null then
    raise exception 'missing structure row(s) for: % — refusing to guess at a version', v_missing;
  end if;
end;
$$;

-- ── 1 · GHQ-12 wording ───────────────────────────────────────────────

update public.wellbeing_items i
set prompt = w.prompt
from (values
    ('item_01', 'Been able to concentrate on whatever you''re doing?'),
    ('item_02', 'Lost much sleep over worry?'),
    ('item_03', 'Felt that you are playing a useful part in things?'),
    ('item_04', 'Felt capable of making decisions about things?'),
    ('item_05', 'Felt constantly under strain?'),
    ('item_06', 'Felt you couldn''t overcome your difficulties?'),
    ('item_07', 'Been able to enjoy your normal day-to-day activities?'),
    ('item_08', 'Been able to face up to your problems?'),
    ('item_09', 'Been feeling unhappy and depressed?'),
    ('item_10', 'Been losing confidence in yourself?'),
    ('item_11', 'Been thinking of yourself as a worthless person?'),
    ('item_12', 'Been feeling reasonably happy, all things considered?')
) as w (external_id, prompt)
where i.version_id = '00000000-0000-4000-8000-0000000000e1'
  and i.external_id = w.external_id;

-- Anchors differ PER ITEM in GHQ-12: a positively-worded item runs
-- "Better than usual -> Much less than usual" while a negatively-worded one
-- runs "Not at all -> Much more than usual". Reusing one set would silently
-- re-word two thirds of the questionnaire, so each is written explicitly.
update public.wellbeing_item_options o
set label = w.label
from public.wellbeing_items i, (values
    ('item_01', 0, 'Better than usual'),
    ('item_01', 1, 'Same as usual'),
    ('item_01', 2, 'Less than usual'),
    ('item_01', 3, 'Much less than usual'),
    ('item_02', 0, 'Not at all'),
    ('item_02', 1, 'No more than usual'),
    ('item_02', 2, 'Rather more than usual'),
    ('item_02', 3, 'Much more than usual'),
    ('item_03', 0, 'More so than usual'),
    ('item_03', 1, 'Same as usual'),
    ('item_03', 2, 'Less useful than usual'),
    ('item_03', 3, 'Much less useful'),
    ('item_04', 0, 'More so than usual'),
    ('item_04', 1, 'Same as usual'),
    ('item_04', 2, 'Less so than usual'),
    ('item_04', 3, 'Much less capable'),
    ('item_05', 0, 'Not at all'),
    ('item_05', 1, 'No more than usual'),
    ('item_05', 2, 'Rather more than usual'),
    ('item_05', 3, 'Much more than usual'),
    ('item_06', 0, 'Not at all'),
    ('item_06', 1, 'No more than usual'),
    ('item_06', 2, 'Rather more than usual'),
    ('item_06', 3, 'Much more than usual'),
    ('item_07', 0, 'More so than usual'),
    ('item_07', 1, 'Same as usual'),
    ('item_07', 2, 'Less so than usual'),
    ('item_07', 3, 'Much less than usual'),
    ('item_08', 0, 'More so than usual'),
    ('item_08', 1, 'Same as usual'),
    ('item_08', 2, 'Less so than usual'),
    ('item_08', 3, 'Much less than usual'),
    ('item_09', 0, 'Not at all'),
    ('item_09', 1, 'No more than usual'),
    ('item_09', 2, 'Rather more than usual'),
    ('item_09', 3, 'Much more than usual'),
    ('item_10', 0, 'Not at all'),
    ('item_10', 1, 'No more than usual'),
    ('item_10', 2, 'Rather more than usual'),
    ('item_10', 3, 'Much more than usual'),
    ('item_11', 0, 'Not at all'),
    ('item_11', 1, 'No more than usual'),
    ('item_11', 2, 'Rather more than usual'),
    ('item_11', 3, 'Much more than usual'),
    ('item_12', 0, 'More so than usual'),
    ('item_12', 1, 'About same as usual'),
    ('item_12', 2, 'Less so than usual'),
    ('item_12', 3, 'Much less happy')
) as w (external_id, position, label)
where o.item_id = i.id
  and i.version_id = '00000000-0000-4000-8000-0000000000e1'
  and i.external_id = w.external_id
  and o.position = w.position;

-- Licence metadata belongs ON THE ROW, because that is what the governance
-- invariant checks: wording may exist only where a licence is recorded
-- alongside it. `licence_note` states plainly that the formal attribution
-- string is still outstanding, so the gap is visible in the database rather
-- than only in a conversation.
update public.wellbeing_versions
set name = 'GHQ-12',
    content_status = 'licensed',
    licence_holder = 'Goldberg & Williams (GL Assessment)',
    licence_reference = 'GHQ-12_Questionnaire_and_Assessment_Guide.pdf',
    licence_note =
      'Digital-use licence confirmed by the product owner. Content transcribed verbatim from '
      || 'the supplied implementation guide, which carries no copyright line or attribution '
      || 'statement. The exact attribution wording required by the licensor is OUTSTANDING and '
      || 'must be confirmed with GL Assessment before external production release.',
    is_active = true,
    updated_at = now()
where id = '00000000-0000-4000-8000-0000000000e1';

-- ── 2 · GHQ-28 wording ───────────────────────────────────────────────

update public.wellbeing_items i
set prompt = w.prompt
from (values
    ('ghq28_item_01', 'Been feeling perfectly well and in good health?'),
    ('ghq28_item_02', 'Been feeling in need of a good tonic?'),
    ('ghq28_item_03', 'Been feeling run down and out of sorts?'),
    ('ghq28_item_04', 'Felt that you are ill at all?'),
    ('ghq28_item_05', 'Been getting any pains in your head?'),
    ('ghq28_item_06', 'Been getting a feeling of tightness or pressure in your head?'),
    ('ghq28_item_07', 'Been having hot or cold spells?'),
    ('ghq28_item_08', 'Lost much sleep over worry?'),
    ('ghq28_item_09', 'Had difficulty in staying asleep once you are off?'),
    ('ghq28_item_10', 'Felt constantly under strain?'),
    ('ghq28_item_11', 'Been getting edgy and bad-tempered?'),
    ('ghq28_item_12', 'Been getting scared or panicky for no good reason?'),
    ('ghq28_item_13', 'Found everything getting on top of you?'),
    ('ghq28_item_14', 'Been feeling nervous and strung-up all the time?'),
    ('ghq28_item_15', 'Been managing to keep yourself busy and occupied?'),
    ('ghq28_item_16', 'Been taking longer over the things you do?'),
    ('ghq28_item_17', 'Felt on the whole you are doing things well?'),
    ('ghq28_item_18', 'Been satisfied with the way you''ve carried out your tasks?'),
    ('ghq28_item_19', 'Felt that you are playing a useful part in things?'),
    ('ghq28_item_20', 'Felt capable of making decisions about things?'),
    ('ghq28_item_21', 'Been able to enjoy your normal day-to-day activities?'),
    ('ghq28_item_22', 'Thinking of yourself as a worthless person?'),
    ('ghq28_item_23', 'Felt that life is entirely hopeless?'),
    ('ghq28_item_24', 'Felt that life isn''t worth living?'),
    ('ghq28_item_25', 'Thought of the possibility of doing away with yourself?'),
    ('ghq28_item_26', 'Found at times you couldn''t do anything because your nerves were too bad?'),
    ('ghq28_item_27', 'Found yourself wishing you were dead and away from it all?'),
    ('ghq28_item_28', 'Found that the idea of taking your own life kept coming into your mind?')
) as w (external_id, prompt)
where i.version_id = '00000000-0000-4000-8000-0000000000c1'
  and i.external_id = w.external_id;

-- Anchors differ PER SECTION in GHQ-28, and sections A and C run in the
-- opposite direction to B and D.
update public.wellbeing_item_options o
set label = w.label
from public.wellbeing_items i, (values
    ('ghq28_item_01', 0, 'Better than usual'),
    ('ghq28_item_01', 1, 'Same as usual'),
    ('ghq28_item_01', 2, 'Worse than usual'),
    ('ghq28_item_01', 3, 'Much worse than usual'),
    ('ghq28_item_02', 0, 'Better than usual'),
    ('ghq28_item_02', 1, 'Same as usual'),
    ('ghq28_item_02', 2, 'Worse than usual'),
    ('ghq28_item_02', 3, 'Much worse than usual'),
    ('ghq28_item_03', 0, 'Better than usual'),
    ('ghq28_item_03', 1, 'Same as usual'),
    ('ghq28_item_03', 2, 'Worse than usual'),
    ('ghq28_item_03', 3, 'Much worse than usual'),
    ('ghq28_item_04', 0, 'Better than usual'),
    ('ghq28_item_04', 1, 'Same as usual'),
    ('ghq28_item_04', 2, 'Worse than usual'),
    ('ghq28_item_04', 3, 'Much worse than usual'),
    ('ghq28_item_05', 0, 'Better than usual'),
    ('ghq28_item_05', 1, 'Same as usual'),
    ('ghq28_item_05', 2, 'Worse than usual'),
    ('ghq28_item_05', 3, 'Much worse than usual'),
    ('ghq28_item_06', 0, 'Better than usual'),
    ('ghq28_item_06', 1, 'Same as usual'),
    ('ghq28_item_06', 2, 'Worse than usual'),
    ('ghq28_item_06', 3, 'Much worse than usual'),
    ('ghq28_item_07', 0, 'Better than usual'),
    ('ghq28_item_07', 1, 'Same as usual'),
    ('ghq28_item_07', 2, 'Worse than usual'),
    ('ghq28_item_07', 3, 'Much worse than usual'),
    ('ghq28_item_08', 0, 'Not at all'),
    ('ghq28_item_08', 1, 'No more than usual'),
    ('ghq28_item_08', 2, 'Rather more than usual'),
    ('ghq28_item_08', 3, 'Much more than usual'),
    ('ghq28_item_09', 0, 'Not at all'),
    ('ghq28_item_09', 1, 'No more than usual'),
    ('ghq28_item_09', 2, 'Rather more than usual'),
    ('ghq28_item_09', 3, 'Much more than usual'),
    ('ghq28_item_10', 0, 'Not at all'),
    ('ghq28_item_10', 1, 'No more than usual'),
    ('ghq28_item_10', 2, 'Rather more than usual'),
    ('ghq28_item_10', 3, 'Much more than usual'),
    ('ghq28_item_11', 0, 'Not at all'),
    ('ghq28_item_11', 1, 'No more than usual'),
    ('ghq28_item_11', 2, 'Rather more than usual'),
    ('ghq28_item_11', 3, 'Much more than usual'),
    ('ghq28_item_12', 0, 'Not at all'),
    ('ghq28_item_12', 1, 'No more than usual'),
    ('ghq28_item_12', 2, 'Rather more than usual'),
    ('ghq28_item_12', 3, 'Much more than usual'),
    ('ghq28_item_13', 0, 'Not at all'),
    ('ghq28_item_13', 1, 'No more than usual'),
    ('ghq28_item_13', 2, 'Rather more than usual'),
    ('ghq28_item_13', 3, 'Much more than usual'),
    ('ghq28_item_14', 0, 'Not at all'),
    ('ghq28_item_14', 1, 'No more than usual'),
    ('ghq28_item_14', 2, 'Rather more than usual'),
    ('ghq28_item_14', 3, 'Much more than usual'),
    ('ghq28_item_15', 0, 'More so than usual'),
    ('ghq28_item_15', 1, 'Same as usual'),
    ('ghq28_item_15', 2, 'Less so than usual'),
    ('ghq28_item_15', 3, 'Much less than usual'),
    ('ghq28_item_16', 0, 'More so than usual'),
    ('ghq28_item_16', 1, 'Same as usual'),
    ('ghq28_item_16', 2, 'Less so than usual'),
    ('ghq28_item_16', 3, 'Much less than usual'),
    ('ghq28_item_17', 0, 'More so than usual'),
    ('ghq28_item_17', 1, 'Same as usual'),
    ('ghq28_item_17', 2, 'Less so than usual'),
    ('ghq28_item_17', 3, 'Much less than usual'),
    ('ghq28_item_18', 0, 'More so than usual'),
    ('ghq28_item_18', 1, 'Same as usual'),
    ('ghq28_item_18', 2, 'Less so than usual'),
    ('ghq28_item_18', 3, 'Much less than usual'),
    ('ghq28_item_19', 0, 'More so than usual'),
    ('ghq28_item_19', 1, 'Same as usual'),
    ('ghq28_item_19', 2, 'Less so than usual'),
    ('ghq28_item_19', 3, 'Much less than usual'),
    ('ghq28_item_20', 0, 'More so than usual'),
    ('ghq28_item_20', 1, 'Same as usual'),
    ('ghq28_item_20', 2, 'Less so than usual'),
    ('ghq28_item_20', 3, 'Much less than usual'),
    ('ghq28_item_21', 0, 'More so than usual'),
    ('ghq28_item_21', 1, 'Same as usual'),
    ('ghq28_item_21', 2, 'Less so than usual'),
    ('ghq28_item_21', 3, 'Much less than usual'),
    ('ghq28_item_22', 0, 'Not at all'),
    ('ghq28_item_22', 1, 'No more than usual'),
    ('ghq28_item_22', 2, 'Rather more than usual'),
    ('ghq28_item_22', 3, 'Much more than usual'),
    ('ghq28_item_23', 0, 'Not at all'),
    ('ghq28_item_23', 1, 'No more than usual'),
    ('ghq28_item_23', 2, 'Rather more than usual'),
    ('ghq28_item_23', 3, 'Much more than usual'),
    ('ghq28_item_24', 0, 'Not at all'),
    ('ghq28_item_24', 1, 'No more than usual'),
    ('ghq28_item_24', 2, 'Rather more than usual'),
    ('ghq28_item_24', 3, 'Much more than usual'),
    ('ghq28_item_25', 0, 'Not at all'),
    ('ghq28_item_25', 1, 'No more than usual'),
    ('ghq28_item_25', 2, 'Rather more than usual'),
    ('ghq28_item_25', 3, 'Much more than usual'),
    ('ghq28_item_26', 0, 'Not at all'),
    ('ghq28_item_26', 1, 'No more than usual'),
    ('ghq28_item_26', 2, 'Rather more than usual'),
    ('ghq28_item_26', 3, 'Much more than usual'),
    ('ghq28_item_27', 0, 'Not at all'),
    ('ghq28_item_27', 1, 'No more than usual'),
    ('ghq28_item_27', 2, 'Rather more than usual'),
    ('ghq28_item_27', 3, 'Much more than usual'),
    ('ghq28_item_28', 0, 'Not at all'),
    ('ghq28_item_28', 1, 'No more than usual'),
    ('ghq28_item_28', 2, 'Rather more than usual'),
    ('ghq28_item_28', 3, 'Much more than usual')
) as w (external_id, position, label)
where o.item_id = i.id
  and i.version_id = '00000000-0000-4000-8000-0000000000c1'
  and i.external_id = w.external_id
  and o.position = w.position;

update public.wellbeing_versions
set name = 'GHQ-28',
    content_status = 'licensed',
    licence_holder = 'Goldberg & Hillier (GL Assessment)',
    licence_reference = 'GHQ-28_Questionnaire_and_Assessment_Guide.pdf',
    licence_note =
      'Digital-use licence confirmed by the product owner. Content transcribed verbatim from '
      || 'the supplied implementation guide, which carries no copyright line or attribution '
      || 'statement. The exact attribution wording required by the licensor is OUTSTANDING and '
      || 'must be confirmed with GL Assessment before external production release. Section D '
      || 'contains suicidality items; the participant-facing safeguard wording awaits '
      || 'Occupational Health approval.',
    is_active = true,
    updated_at = now()
where id = '00000000-0000-4000-8000-0000000000c1';

-- ── 3 · WHO-5 wording, aligned to the supplied guide ─────────────────

update public.wellbeing_items i
set prompt = w.prompt
from (values
    ('who5_item_01', 'I have felt cheerful and in good spirits.'),
    ('who5_item_02', 'I have felt calm and relaxed.'),
    ('who5_item_03', 'I have felt active and vigorous.'),
    ('who5_item_04', 'I woke up feeling fresh and rested.'),
    ('who5_item_05', 'My daily life has been filled with things that interest me.')
) as w (external_id, prompt)
where i.version_id = '00000000-0000-4000-8000-0000000000b1'
  and i.external_id = w.external_id;

update public.wellbeing_item_options o
set label = w.label
from public.wellbeing_items i, (values
    (0, 'At no time'),
    (1, 'Some of the time'),
    (2, 'Less than half the time'),
    (3, 'More than half the time'),
    (4, 'Most of the time'),
    (5, 'All the time')
) as w (position, label)
where o.item_id = i.id
  and i.version_id = '00000000-0000-4000-8000-0000000000b1'
  and o.position = w.position;

-- ── 4 · confirm every prompt and anchor landed ───────────────────────

do $$
declare
  r record;
begin
  for r in
    select v.instrument_key,
           v.item_count as expected_items,
           count(distinct i.id) as items,
           count(distinct i.id) filter (where i.prompt is not null) as worded,
           count(o.id) as options,
           count(o.id) filter (where o.label is not null) as labelled
    from public.wellbeing_versions v
    join public.wellbeing_items i on i.version_id = v.id
    join public.wellbeing_item_options o on o.item_id = i.id
    where v.instrument_key in ('ghq12', 'ghq28', 'who5')
    group by v.instrument_key, v.item_count
  loop
    if r.items <> r.expected_items then
      raise exception '% has % items, expected %', r.instrument_key, r.items, r.expected_items;
    end if;
    if r.worded <> r.items then
      raise exception '% left % of % items unworded', r.instrument_key, r.items - r.worded, r.items;
    end if;
    if r.labelled <> r.options then
      raise exception '% left % of % anchors unlabelled', r.instrument_key, r.options - r.labelled, r.options;
    end if;
    raise notice '% seeded: % items, % anchors', r.instrument_key, r.items, r.options;
  end loop;
end;
$$;

-- ── 5 · no anchor may be shared where the source varies it ───────────
--
-- A transcription that quietly collapsed GHQ-12's twelve anchor sets into one
-- would still satisfy every count above. This is the check that would catch
-- it: GHQ-12 must carry more than one distinct set of four labels.

do $$
declare
  v_sets int;
begin
  select count(distinct labels) into v_sets
  from (
    select i.external_id, string_agg(o.label, '|' order by o.position) as labels
    from public.wellbeing_items i
    join public.wellbeing_item_options o on o.item_id = i.id
    where i.version_id = '00000000-0000-4000-8000-0000000000e1'
    group by i.external_id
  ) s;
  if v_sets < 2 then
    raise exception 'GHQ-12 collapsed to % distinct anchor set(s) — the per-item wording was lost', v_sets;
  end if;
  raise notice 'GHQ-12 carries % distinct anchor sets', v_sets;
end;
$$;

-- ── 6 · exactly one active version per instrument ────────────────────
--
-- The unique index from 00038 already forbids two. This proves the other
-- direction: that each of the four instruments HAS one, so none is left
-- worded but unservable.

do $$
declare
  v_missing text;
begin
  select string_agg(k, ', ') into v_missing
  from (values ('ghq12'), ('ghq28'), ('who5'), ('disc360_wellbeing_v1')) as w (k)
  where not exists (
    select 1 from public.wellbeing_versions v
    where v.instrument_key = w.k and v.is_active
  );
  if v_missing is not null then
    raise exception 'no active version for: %', v_missing;
  end if;
  raise notice 'all four instruments have exactly one active version';
end;
$$;

-- ── 7 · wording exists only where a licence is recorded ──────────────
--
-- The governance invariant behind the whole gate, asserted at the point the
-- wording lands rather than only in the privacy harness. Third-party content
-- without a recorded licence on its own row is the state this product must
-- never be in.

do $$
declare
  v_bad text;
begin
  select string_agg(distinct v.instrument_key, ', ') into v_bad
  from public.wellbeing_versions v
  join public.wellbeing_items i on i.version_id = v.id
  where v.instrument_key in ('ghq12', 'ghq28', 'who5')
    and i.prompt is not null
    and (v.licence_holder is null or v.licence_reference is null);
  if v_bad is not null then
    raise exception 'third-party wording without a recorded licence: %', v_bad;
  end if;
  raise notice 'every worded third-party version records its licence';
end;
$$;
