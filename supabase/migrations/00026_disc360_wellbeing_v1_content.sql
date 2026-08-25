-- DISC360 Wellbeing Pulse V1 — original instrument content.
--
-- Generated from data/disc360-wellbeing-items.ts.
--
-- ─────────────────────────────────────────────────────────────────────
-- UNLIKE THE GHQ SEED, THIS SHIPS COMPLETE AND ACTIVE.
--
-- Every word here is original DISC360 material. There is no third-party
-- licence to wait for, so content_status is 'licensed', licence_holder is
-- DISC360 itself, and the version can be activated for participants
-- immediately.
--
-- This does NOT touch the GHQ version. GHQ stays 'structure_only' and stays
-- inactive; the one-active-version index is now per instrument, so activating
-- this one has no effect on it.
--
-- IMMUTABLE ONCE RELEASED. Item wording, item order and dimension mapping are
-- the version. Changing any of them re-interprets every historical result, so
-- a change means a new version row — never an edit to this file.
--
-- WHAT V1 DELIBERATELY OMITS: any threshold, any severity band, any cut-off.
-- The instrument has not been psychometrically validated, and the schema
-- enforces the omission — wellbeing_results_threshold_matches_instrument
-- refuses a threshold on a non-GHQ result.
-- ─────────────────────────────────────────────────────────────────────

insert into public.wellbeing_versions
  (id, name, version, questionnaire_code, instrument_key, content_status, item_count,
   licence_holder, licence_reference, licence_note, is_active)
values (
  '00000000-0000-4000-8000-0000000000d1'::uuid,
  'DISC360 Wellbeing Pulse V1',
  1,
  'disc360_wellbeing_v1',
  'disc360_wellbeing_v1',
  'licensed',
  12,
  'DISC360',
  'original-content',
  'Original DISC360 product content. Not GHQ-12 and not derived from it. '
  || 'Not a diagnostic instrument and not psychometrically validated: V1 carries '
  || 'no threshold and no severity bands.',
  true
);

-- ── the twelve items, in administration order ────────────────────────

insert into public.wellbeing_items
  (version_id, external_id, position, prompt, dimension_key, facet)
values
  ('00000000-0000-4000-8000-0000000000d1', 'dw_focus', 0,
   'I have been able to stay focused on the things that need my attention.',
   'capacity', 'Focus'),
  ('00000000-0000-4000-8000-0000000000d1', 'dw_recovery', 1,
   'I have been able to switch off and recover after demanding periods.',
   'recovery_demand', 'Recovery'),
  ('00000000-0000-4000-8000-0000000000d1', 'dw_energy', 2,
   'I have had enough energy to manage my usual daily activities.',
   'capacity', 'Energy'),
  ('00000000-0000-4000-8000-0000000000d1', 'dw_workload', 3,
   'The demands on me have felt manageable.',
   'recovery_demand', 'Workload'),
  ('00000000-0000-4000-8000-0000000000d1', 'dw_emotional_balance', 4,
   'I have felt emotionally steady, even when things became difficult.',
   'emotional_resilience', 'Emotional Balance'),
  ('00000000-0000-4000-8000-0000000000d1', 'dw_coping', 5,
   'When problems arose, I felt able to deal with them effectively.',
   'emotional_resilience', 'Coping'),
  ('00000000-0000-4000-8000-0000000000d1', 'dw_connection', 6,
   'I have felt supported and connected to people around me.',
   'connection_safety', 'Connection'),
  ('00000000-0000-4000-8000-0000000000d1', 'dw_purpose', 7,
   'What I do has felt worthwhile and meaningful to me.',
   'purpose_confidence', 'Purpose'),
  ('00000000-0000-4000-8000-0000000000d1', 'dw_confidence', 8,
   'I have felt confident in my ability to handle my responsibilities.',
   'purpose_confidence', 'Confidence'),
  ('00000000-0000-4000-8000-0000000000d1', 'dw_positive_experience', 9,
   'I have been able to experience enjoyment or satisfaction in my everyday life.',
   'everyday_wellbeing', 'Positive Experience'),
  ('00000000-0000-4000-8000-0000000000d1', 'dw_psychological_safety', 10,
   'I have felt comfortable speaking up when I needed help or support.',
   'connection_safety', 'Psychological Safety'),
  ('00000000-0000-4000-8000-0000000000d1', 'dw_overall', 11,
   'Overall, I have felt able to function well in my day-to-day life.',
   'everyday_wellbeing', 'Overall Wellbeing');

-- ── five response positions per item ─────────────────────────────────
--
-- Never → Almost always, scored 0-1-2-3-4. Every item is worded positively,
-- so a higher position always means stronger reported wellbeing and there is
-- no reverse-scoring anywhere in this instrument.
--
-- bimodal_score and likert_score stay NULL: those are GHQ's own scales and
-- carry no meaning here.

insert into public.wellbeing_item_options
  (item_id, position, label, points, bimodal_score, likert_score)
select i.id, o.position, o.label, o.points, null, null
from public.wellbeing_items i
cross join (
  values
    (0, 'Never',         0::smallint),
    (1, 'Rarely',        1::smallint),
    (2, 'Sometimes',     2::smallint),
    (3, 'Often',         3::smallint),
    (4, 'Almost always', 4::smallint)
) as o (position, label, points)
where i.version_id = '00000000-0000-4000-8000-0000000000d1';

-- ── confirm the seed is internally consistent ────────────────────────
--
-- A content migration that half-applied would produce a questionnaire that
-- scores wrongly rather than one that visibly fails, so it checks itself.

do $$
declare
  v_items int;
  v_options int;
  v_dimensions int;
begin
  select count(*) into v_items from public.wellbeing_items
    where version_id = '00000000-0000-4000-8000-0000000000d1';
  select count(*) into v_options from public.wellbeing_item_options o
    join public.wellbeing_items i on i.id = o.item_id
    where i.version_id = '00000000-0000-4000-8000-0000000000d1';
  select count(distinct i.dimension_key) into v_dimensions from public.wellbeing_items i
    where i.version_id = '00000000-0000-4000-8000-0000000000d1';

  if v_items <> 12 then
    raise exception 'DISC360 Wellbeing V1 seeded % items, expected 12', v_items;
  end if;
  if v_options <> 60 then
    raise exception 'DISC360 Wellbeing V1 seeded % options, expected 60', v_options;
  end if;
  if v_dimensions <> 6 then
    raise exception 'DISC360 Wellbeing V1 covers % dimensions, expected 6', v_dimensions;
  end if;

  -- Two items per dimension, exactly.
  if exists (
    select 1 from public.wellbeing_items i
    where i.version_id = '00000000-0000-4000-8000-0000000000d1'
    group by i.dimension_key having count(*) <> 2
  ) then
    raise exception 'DISC360 Wellbeing V1 has a dimension without exactly two items';
  end if;
end;
$$;
