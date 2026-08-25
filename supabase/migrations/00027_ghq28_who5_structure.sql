-- GHQ-28 and WHO-5 — registry entries, subscales and questionnaire STRUCTURE.
--
-- ─────────────────────────────────────────────────────────────────────
-- NO LICENSED WORDING IS SEEDED HERE.
--
-- GHQ-28 wording is copyright Goldberg & Hillier (GL Assessment); WHO-5
-- wording is © World Health Organization under CC BY-NC-SA 3.0 IGO. Neither
-- is committed: `prompt` and `label` stay NULL, exactly as for GHQ-12.
--
-- What IS seeded carries no copyright — item counts, response positions, the
-- weight each position carries, and which seven-item block each GHQ-28 item
-- belongs to. That is enough for the engines, the subscale profile, the
-- history model and the analytics to be built and fully tested.
--
-- Both versions are created INACTIVE. The application gate
-- (canServeToParticipants) is what decides whether an instrument may be
-- served, and neither of these can reach a participant in production.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1 · registry entries ─────────────────────────────────────────────

insert into public.wellbeing_instruments
  (key, name, descriptor, purpose, primary_score_label, primary_score_min, primary_score_max,
   score_direction, item_count, response_option_count, dimension_count, has_threshold,
   licensing, scoring_engine, scoring_method)
values
  ('ghq28', 'GHQ-28', 'GHQ-28 wellbeing screening',
   'Psychological distress screening with a four-part profile',
   'GHQ-28 screening score', 0, 28, 'higher_is_more_distress', 28, 4, 4, true,
   'external_rights_required', 'lib/scoring/ghq28.ts', 'ghq28_bimodal_0011'),
  ('who5', 'WHO-5', 'WHO-5 Well-Being Index',
   'Short self-reported measure of current wellbeing',
   'WHO-5 score', 0, 100, 'higher_is_stronger_wellbeing', 5, 6, 0, false,
   'open_licence', 'lib/scoring/who5.ts', 'who5_sum_x4');

-- ── 2 · GHQ-28 subscales ─────────────────────────────────────────────
--
-- Registered as dimensions so the profile can be stored and aggregated like
-- any other. They carry NO threshold of their own, here or anywhere: a
-- subscale is a profile dimension, and "severe depression: 5" is not a
-- finding about a person.

insert into public.wellbeing_dimensions (key, instrument_key, label, description, position)
values
  ('ghq28_somatic', 'ghq28', 'Somatic symptoms',
   'Items 1–7. A profile dimension only — it carries no threshold.', 0),
  ('ghq28_anxiety_insomnia', 'ghq28', 'Anxiety / insomnia',
   'Items 8–14. A profile dimension only — it carries no threshold.', 1),
  ('ghq28_social_dysfunction', 'ghq28', 'Social dysfunction',
   'Items 15–21. A profile dimension only — it carries no threshold.', 2),
  ('ghq28_severe_depression', 'ghq28', 'Severe depression',
   'Items 22–28. A profile dimension only — it carries no threshold.', 3);

-- ── 3 · GHQ-28 structure ─────────────────────────────────────────────

insert into public.wellbeing_versions
  (id, name, version, questionnaire_code, instrument_key, content_status, item_count,
   licence_note, is_active)
values (
  '00000000-0000-4000-8000-0000000000c1'::uuid,
  'GHQ-28 v1', 1, 'ghq28', 'ghq28', 'structure_only', 28,
  'Item and response wording is copyright Goldberg & Hillier (GL Assessment). '
  || 'Structure only until DISC360 digital-use rights are evidenced on this row.',
  false
);

insert into public.wellbeing_items (version_id, external_id, position, prompt, dimension_key)
select
  '00000000-0000-4000-8000-0000000000c1'::uuid,
  'ghq28_item_' || lpad(n::text, 2, '0'),
  n - 1,
  null,
  case
    when n between 1 and 7   then 'ghq28_somatic'
    when n between 8 and 14  then 'ghq28_anxiety_insomnia'
    when n between 15 and 21 then 'ghq28_social_dysfunction'
    else 'ghq28_severe_depression'
  end
from generate_series(1, 28) as n;

-- Four ordered positions, bimodal 0-0-1-1 and Likert 0-1-2-3.
insert into public.wellbeing_item_options
  (item_id, position, label, points, bimodal_score, likert_score)
select i.id, w.position, null, w.bimodal, w.bimodal, w.likert
from public.wellbeing_items i
cross join (
  values (0, 0::smallint, 0::smallint),
         (1, 0::smallint, 1::smallint),
         (2, 1::smallint, 2::smallint),
         (3, 1::smallint, 3::smallint)
) as w (position, bimodal, likert)
where i.version_id = '00000000-0000-4000-8000-0000000000c1';

-- ── 4 · WHO-5 structure ──────────────────────────────────────────────

insert into public.wellbeing_versions
  (id, name, version, questionnaire_code, instrument_key, content_status, item_count,
   licence_holder, licence_reference, licence_note, is_active)
values (
  '00000000-0000-4000-8000-0000000000b1'::uuid,
  'WHO-5 v1', 1, 'who5', 'who5', 'structure_only', 5,
  'World Health Organization',
  'CC BY-NC-SA 3.0 IGO',
  'WHO-5 Well-Being Index © World Health Organization, CC BY-NC-SA 3.0 IGO. '
  || 'Intended use here is internal and non-commercial. Structure only: the exact '
  || 'source version and its item wording are to be confirmed before publication. '
  || 'WHO does not endorse DISC360 or Wellbeing Pulse.',
  false
);

insert into public.wellbeing_items (version_id, external_id, position, prompt)
select
  '00000000-0000-4000-8000-0000000000b1'::uuid,
  'who5_item_' || lpad(n::text, 2, '0'),
  n - 1,
  null
from generate_series(1, 5) as n;

-- Six ordered positions scored 0–5. bimodal/likert stay NULL: those are the
-- GHQ scales and mean nothing here.
insert into public.wellbeing_item_options
  (item_id, position, label, points, bimodal_score, likert_score)
select i.id, p.position, null, p.position::smallint, null, null
from public.wellbeing_items i
cross join generate_series(0, 5) as p (position)
where i.version_id = '00000000-0000-4000-8000-0000000000b1';

-- ── 5 · self-check ───────────────────────────────────────────────────

do $$
declare
  v_ghq28_items int;
  v_ghq28_options int;
  v_who5_items int;
  v_who5_options int;
  v_wording int;
begin
  select count(*) into v_ghq28_items from public.wellbeing_items
    where version_id = '00000000-0000-4000-8000-0000000000c1';
  select count(*) into v_ghq28_options from public.wellbeing_item_options o
    join public.wellbeing_items i on i.id = o.item_id
    where i.version_id = '00000000-0000-4000-8000-0000000000c1';
  select count(*) into v_who5_items from public.wellbeing_items
    where version_id = '00000000-0000-4000-8000-0000000000b1';
  select count(*) into v_who5_options from public.wellbeing_item_options o
    join public.wellbeing_items i on i.id = o.item_id
    where i.version_id = '00000000-0000-4000-8000-0000000000b1';

  if v_ghq28_items <> 28 then raise exception 'GHQ-28 seeded % items, expected 28', v_ghq28_items; end if;
  if v_ghq28_options <> 112 then raise exception 'GHQ-28 seeded % options, expected 112', v_ghq28_options; end if;
  if v_who5_items <> 5 then raise exception 'WHO-5 seeded % items, expected 5', v_who5_items; end if;
  if v_who5_options <> 30 then raise exception 'WHO-5 seeded % options, expected 30', v_who5_options; end if;

  -- Each GHQ-28 block holds exactly seven items.
  if exists (
    select 1 from public.wellbeing_items
    where version_id = '00000000-0000-4000-8000-0000000000c1'
    group by dimension_key having count(*) <> 7
  ) then
    raise exception 'A GHQ-28 subscale does not hold exactly seven items';
  end if;

  -- The licensing invariant: no third-party instrument carries wording.
  select count(*) into v_wording
  from public.wellbeing_items i
  join public.wellbeing_versions v on v.id = i.version_id
  where v.instrument_key in ('ghq12', 'ghq28', 'who5') and i.prompt is not null;
  if v_wording > 0 then
    raise exception 'Licensed wording present on a third-party instrument (% items)', v_wording;
  end if;
end;
$$;
