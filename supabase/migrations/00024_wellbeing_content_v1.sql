-- Wellbeing Pulse — questionnaire structure v1, and the platform policy default.
--
-- Generated from data/wellbeing-items.ts. It seeds the twelve item slots, the
-- four ordered response positions per item, and the weight each position
-- carries under both scoring methods.
--
-- NO LICENSED WORDING IS SEEDED HERE. `prompt` and `label` stay NULL, and the
-- version stays 'structure_only', which the CHECK constraint in 00023 means
-- cannot be activated for participants. When electronic-use rights are
-- evidenced, a follow-up migration fills those two columns and flips
-- content_status to 'licensed' — no schema, no scoring and no history changes.

-- ── version ──────────────────────────────────────────────────────────

insert into public.wellbeing_versions
  (id, name, version, questionnaire_code, content_status, item_count, is_active, licence_note)
values (
  '00000000-0000-4000-8000-0000000000e1'::uuid,
  'Wellbeing Pulse v1',
  1,
  'ghq12',
  'structure_only',
  12,
  false,
  'Item and response wording is copyright Goldberg & Williams (GL Assessment). '
  || 'Structure only until DISC360 electronic-use rights are evidenced on this row.'
);

-- ── twelve item slots, in published administration order ─────────────

insert into public.wellbeing_items (version_id, external_id, position, prompt)
select
  '00000000-0000-4000-8000-0000000000e1'::uuid,
  'item_' || lpad(position::text, 2, '0'),
  position - 1,
  null
from generate_series(1, 12) as position;

-- ── four response positions per item ─────────────────────────────────
--
-- bimodal 0-0-1-1 is the primary screening weight; likert 0-1-2-3 is the
-- secondary continuous measure. Both are stored per row rather than derived,
-- so a future published response set cannot be mis-weighted by inference.
--
-- There is no per-item reversal. The published response sets already run from
-- "no worse than usual" toward "worse than usual" on every item, positively
-- worded ones included; reversing on top of that would double-count the
-- wording and corrupt the total.

insert into public.wellbeing_item_options (item_id, position, label, bimodal_score, likert_score)
select
  i.id,
  weights.position,
  null,
  weights.bimodal,
  weights.likert
from public.wellbeing_items i
cross join (
  values (0, 0::smallint, 0::smallint),
         (1, 0::smallint, 1::smallint),
         (2, 1::smallint, 2::smallint),
         (3, 1::smallint, 3::smallint)
) as weights (position, bimodal, likert)
where i.version_id = '00000000-0000-4000-8000-0000000000e1'::uuid;

-- ── platform policy default ──────────────────────────────────────────
--
-- The 3/4 cut-off, expressed as threshold = 4, and a confidentiality floor of
-- 7 completed responses. organization_id NULL makes this the platform
-- default; an organisation overrides it by appending its own row, which is a
-- governance action recorded with a rationale.
--
-- created_by is NULL because no person made this choice — it is the shipped
-- default. Every subsequent row must name its author.

insert into public.wellbeing_policies
  (organization_id, screening_threshold, min_cohort_size, scoring_method, rationale, created_by)
values (
  null,
  4,
  7,
  'ghq_bimodal_0011',
  'Platform default. Implements the widely-used GHQ-12 3/4 cut-off (0-3 below, '
  || '4-12 at or above) and a minimum reporting cohort of 7 completed responses. '
  || 'GHQ-12 cut-offs vary materially by population, setting and language: this '
  || 'threshold has NOT been validated against any specific workforce and should '
  || 'be reviewed by the responsible clinical or occupational-health governance '
  || 'role before an organisation relies on it. Every result stores the threshold '
  || 'in force when it completed, so revising this policy does not re-read history.',
  null
);
