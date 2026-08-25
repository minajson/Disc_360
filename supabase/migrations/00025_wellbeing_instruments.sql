-- Wellbeing Pulse becomes a multi-instrument platform.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHY THIS IS A NEW MIGRATION RATHER THAN AN EDIT TO 00023.
--
-- 00023/00024 have not been applied to hosted Supabase, so editing them in
-- place would produce a tidier schema. They have, however, been committed and
-- pushed, and rewriting a migration that exists on a shared branch is exactly
-- the practice this project forbids: anyone who has already applied them
-- locally would silently diverge, and the difference would not show up until
-- something failed in production. Widening forward is auditable and works
-- whether or not 00023 was ever applied anywhere.
--
-- WHAT THIS MIGRATION DOES NOT DO.
--
--   · It does not touch DISC, Focus or Combined. No table, column, policy or
--     function belonging to them is read for writing.
--   · It does not change GHQ-12 scoring, its 0–12 range, its threshold model,
--     its history or its analytics. GHQ results already written keep every
--     value they hold, including their NOT NULL threshold.
--   · It does not drop a table, a column, an index or a policy. The only
--     constraints dropped are ones 00023 created, and every replacement is
--     strictly WIDER — no row that was valid before is invalid after.
--   · It does not insert GHQ-12 wording, and it does not activate the GHQ
--     version. GHQ content_status stays 'structure_only'.
--
-- WHAT IT ADDS: an instrument key on versions and results, a dimension model,
-- room for instruments whose scales are not GHQ's, and the DISC360 Wellbeing
-- Pulse V1 content — which is original DISC360 material and therefore ships
-- complete and active.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1 · the instrument registry ──────────────────────────────────────
--
-- A table rather than an enum: instrument metadata is reference data a
-- governance role may extend, and adding an enum value cannot be done inside
-- a transaction that also uses it.

create table public.wellbeing_instruments (
  key text primary key,
  name text not null,
  descriptor text not null default '',
  purpose text not null,
  -- The primary score's own scale. The two instruments do NOT share one.
  primary_score_label text not null,
  primary_score_min smallint not null,
  primary_score_max smallint not null,
  -- 'higher_is_more_distress' | 'higher_is_stronger_wellbeing'. Recorded
  -- because the two run in OPPOSITE directions, which is one more reason
  -- their numbers must never meet.
  score_direction text not null
    check (score_direction in ('higher_is_more_distress', 'higher_is_stronger_wellbeing')),
  item_count smallint not null,
  response_option_count smallint not null,
  dimension_count smallint not null default 0,
  has_threshold boolean not null default false,
  -- 'external_rights_required' — third-party content, rights being pursued.
  -- 'open_licence'             — third-party content under a recorded licence.
  -- 'original_content'         — DISC360's own material.
  licensing text not null
    check (licensing in ('external_rights_required', 'open_licence', 'original_content')),
  scoring_engine text not null,
  scoring_method text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger wellbeing_instruments_updated before update on public.wellbeing_instruments
  for each row execute function public.set_updated_at();

insert into public.wellbeing_instruments
  (key, name, descriptor, purpose, primary_score_label, primary_score_min, primary_score_max,
   score_direction, item_count, response_option_count, dimension_count, has_threshold,
   licensing, scoring_engine, scoring_method)
values
  ('ghq12', 'GHQ-12', 'GHQ-12 wellbeing screening', 'Psychological distress screening',
   'GHQ-12 screening score', 0, 12, 'higher_is_more_distress', 12, 4, 0, true,
   'external_rights_required', 'lib/scoring/wellbeing.ts', 'ghq_bimodal_0011'),
  ('disc360_wellbeing_v1', 'DISC360 Wellbeing Pulse', 'Workplace wellbeing reflection',
   'Workplace wellbeing monitoring and reflection', 'Wellbeing Index', 0, 100,
   'higher_is_stronger_wellbeing', 12, 5, 6, false,
   'original_content', 'lib/scoring/disc360-wellbeing.ts', 'disc360_wellbeing_sum_0_48');

-- The six DISC360 Wellbeing dimensions. GHQ has none, by design: grouping its
-- items into named constructs would assert a factor structure this product has
-- not validated and is not licensed to claim.
create table public.wellbeing_dimensions (
  key text primary key,
  instrument_key text not null references public.wellbeing_instruments (key) on delete cascade,
  label text not null,
  description text not null default '',
  position smallint not null,
  created_at timestamptz not null default now(),
  unique (instrument_key, position)
);
create index wellbeing_dimensions_instrument_idx
  on public.wellbeing_dimensions (instrument_key, position);

insert into public.wellbeing_dimensions (key, instrument_key, label, description, position)
values
  ('capacity', 'disc360_wellbeing_v1', 'Capacity',
   'Attention and energy available for the day.', 0),
  ('recovery_demand', 'disc360_wellbeing_v1', 'Recovery & Demand',
   'Switching off after demanding periods, and how manageable demands feel.', 1),
  ('emotional_resilience', 'disc360_wellbeing_v1', 'Emotional Resilience',
   'Steadiness under difficulty, and dealing with problems as they arise.', 2),
  ('connection_safety', 'disc360_wellbeing_v1', 'Connection & Safety',
   'Feeling supported by people around you, and able to ask for help.', 3),
  ('purpose_confidence', 'disc360_wellbeing_v1', 'Purpose & Confidence',
   'Finding the work worthwhile, and feeling able to handle it.', 4),
  ('everyday_wellbeing', 'disc360_wellbeing_v1', 'Everyday Wellbeing',
   'Enjoyment in ordinary life, and functioning day to day.', 5);

-- ── 2 · versions become instrument-scoped ────────────────────────────

alter table public.wellbeing_versions
  add column instrument_key text not null default 'ghq12'
    references public.wellbeing_instruments (key);

-- Existing rows are GHQ; the default already recorded that. Drop it so a new
-- version has to name its instrument rather than inheriting one silently.
alter table public.wellbeing_versions alter column instrument_key drop default;

create index wellbeing_versions_instrument_idx
  on public.wellbeing_versions (instrument_key);

-- One active version PER INSTRUMENT, not one platform-wide. Both instruments
-- must be able to be live at once; the old index made that impossible.
drop index if exists public.wellbeing_versions_one_active;
create unique index wellbeing_versions_one_active_per_instrument
  on public.wellbeing_versions (instrument_key) where is_active;

-- Version numbers are per INSTRUMENT, not global. Both instruments have a
-- version 1, and there is no sense in which DISC360 Wellbeing V1 is "after"
-- GHQ-12 V1 — they are separate lineages that happen to share a platform.
alter table public.wellbeing_versions drop constraint wellbeing_versions_version_key;
alter table public.wellbeing_versions
  add constraint wellbeing_versions_instrument_version_key unique (instrument_key, version);

-- Item counts differ between instruments in future versions.
alter table public.wellbeing_versions
  drop constraint wellbeing_versions_item_count_check;
alter table public.wellbeing_versions
  add constraint wellbeing_versions_item_count_check check (item_count between 1 and 50);

-- ── 3 · items gain a dimension, options gain a point value ───────────

alter table public.wellbeing_items
  -- Null for GHQ, which has no dimensions.
  add column dimension_key text references public.wellbeing_dimensions (key) on delete set null,
  -- Short internal label ("Focus", "Recovery"), for dimension breakdowns.
  add column facet text;
create index wellbeing_items_dimension_idx on public.wellbeing_items (dimension_key);

alter table public.wellbeing_items drop constraint wellbeing_items_position_check;
alter table public.wellbeing_items
  add constraint wellbeing_items_position_check check (position between 0 and 49);

-- Five response positions for DISC360 Wellbeing, four for GHQ.
alter table public.wellbeing_item_options drop constraint wellbeing_item_options_position_check;
alter table public.wellbeing_item_options
  add constraint wellbeing_item_options_position_check check (position between 0 and 9);

-- The generic primary weight. For GHQ this equals bimodal_score (0/1); for
-- DISC360 Wellbeing it is the 0–4 point value. Backfilled below, so no row is
-- ever without one.
alter table public.wellbeing_item_options add column points smallint;

update public.wellbeing_item_options set points = bimodal_score where points is null;

alter table public.wellbeing_item_options alter column points set not null;
alter table public.wellbeing_item_options
  add constraint wellbeing_item_options_points_check check (points between 0 and 10);

-- bimodal/likert are GHQ's own scales and are meaningless for another
-- instrument, so they become optional rather than being forced to zero.
alter table public.wellbeing_item_options alter column bimodal_score drop not null;
alter table public.wellbeing_item_options alter column likert_score drop not null;

-- ── 4 · responses accept a wider scale ───────────────────────────────

alter table public.wellbeing_responses drop constraint wellbeing_responses_option_position_check;
alter table public.wellbeing_responses
  add constraint wellbeing_responses_option_position_check
  check (option_position between 0 and 9);

-- ── 5 · results become instrument-aware ──────────────────────────────
--
-- Every widening below keeps existing GHQ rows valid and unchanged. Nothing
-- is recomputed, and no stored value moves.

alter table public.wellbeing_results
  add column instrument_key text not null default 'ghq12'
    references public.wellbeing_instruments (key),
  -- 0–100 for instruments that normalise one. Null for GHQ, which does not.
  add column index_score smallint check (index_score between 0 and 100);

alter table public.wellbeing_results alter column instrument_key drop default;
create index wellbeing_results_instrument_idx
  on public.wellbeing_results (instrument_key, organization_id, completed_at desc);

-- total_score is now the instrument's RAW score, and each instrument keeps its
-- OWN bound rather than sharing a loose one. A single `between 0 and 1000`
-- would have quietly stopped the database from rejecting a GHQ-12 score of 13
-- — the widening must not cost the guarantee it replaces.
alter table public.wellbeing_results drop constraint wellbeing_results_total_score_check;
alter table public.wellbeing_results
  add constraint wellbeing_results_total_score_check check (
    total_score >= 0
    and case instrument_key
      when 'ghq12' then total_score <= 12
      when 'ghq28' then total_score <= 28
      when 'who5' then total_score <= 25          -- WHO-5 raw, before the x4
      when 'disc360_wellbeing_v1' then total_score <= 48
      else total_score <= 1000
    end
  );

-- The GHQ secondary continuous measure does not exist for other instruments.
alter table public.wellbeing_results alter column likert_score drop not null;

-- V1 of DISC360 Wellbeing has NO threshold, deliberately — it has not been
-- psychometrically validated, so it must not grade anyone. The threshold
-- columns therefore become optional, and the consistency rule is rewritten to
-- hold for both shapes: either a threshold and its flag are both present and
-- agree, or both are absent.
alter table public.wellbeing_results alter column threshold_at_completion drop not null;
alter table public.wellbeing_results alter column at_or_above_threshold drop not null;

alter table public.wellbeing_results drop constraint wellbeing_results_threshold_matches_flag;
alter table public.wellbeing_results
  add constraint wellbeing_results_threshold_matches_flag check (
    (threshold_at_completion is null and at_or_above_threshold is null)
    or (threshold_at_completion is not null
        and at_or_above_threshold is not null
        and at_or_above_threshold = (total_score >= threshold_at_completion))
  );

-- An instrument that declares a threshold must record one; an instrument that
-- does not must not invent one. This is what stops a future edit from quietly
-- applying GHQ's cut-off to an unvalidated instrument.
alter table public.wellbeing_results
  add constraint wellbeing_results_threshold_matches_instrument check (
    (instrument_key = 'ghq12' and threshold_at_completion is not null)
    or (instrument_key <> 'ghq12' and threshold_at_completion is null)
  );

-- Item counts differ between instruments, so each keeps its own — a loose
-- `between 1 and 50` would have stopped the database from rejecting a GHQ-12
-- result carrying three answers, which is exactly the guarantee 00023 had.
alter table public.wellbeing_results drop constraint wellbeing_results_item_positions_check;
alter table public.wellbeing_results
  add constraint wellbeing_results_item_positions_check check (
    case instrument_key
      when 'ghq12' then array_length(item_positions, 1) = 12
      when 'ghq28' then array_length(item_positions, 1) = 28
      when 'who5' then array_length(item_positions, 1) = 5
      when 'disc360_wellbeing_v1' then array_length(item_positions, 1) = 12
      else array_length(item_positions, 1) between 1 and 50
    end
  );

-- ── 5b · sessions know their instrument ──────────────────────────────
--
-- The runner, the resume path and the analytics all need "which instrument is
-- this attempt?" without joining through the version, and the brief requires
-- the system to always know it. It also fixes a latent limitation: the active
-- attempt indexes were scoped per (person, team), so a participant could not
-- hold an in-progress GHQ pulse and an in-progress DISC360 Wellbeing pulse at
-- the same time even though the two are unrelated questionnaires.
--
-- Backfilled from the version, so no row is ever without one.

alter table public.wellbeing_sessions
  add column instrument_key text references public.wellbeing_instruments (key);

update public.wellbeing_sessions s
set instrument_key = v.instrument_key
from public.wellbeing_versions v
where v.id = s.version_id and s.instrument_key is null;

-- Any row that somehow predates a version row defaults to GHQ, which is the
-- only instrument that existed before this migration.
update public.wellbeing_sessions set instrument_key = 'ghq12' where instrument_key is null;
alter table public.wellbeing_sessions alter column instrument_key set not null;

create index wellbeing_sessions_instrument_idx
  on public.wellbeing_sessions (instrument_key, profile_id);

-- One ACTIVE attempt per (person, team, instrument), and per (person,
-- instrument) for solo attempts. Strictly more permissive than before: every
-- combination that was legal remains legal.
drop index if exists public.wellbeing_sessions_active_team_uniq;
drop index if exists public.wellbeing_sessions_active_solo_uniq;

create unique index wellbeing_sessions_active_team_uniq
  on public.wellbeing_sessions (profile_id, team_id, instrument_key)
  where status = 'in_progress' and team_id is not null;
create unique index wellbeing_sessions_active_solo_uniq
  on public.wellbeing_sessions (profile_id, instrument_key)
  where status = 'in_progress' and team_id is null;

-- ── 6 · dimension scores ─────────────────────────────────────────────
--
-- A normalised table rather than six columns on wellbeing_results or a JSONB
-- blob. Six columns would hard-code one instrument's dimensions into a shared
-- table; JSONB would put a queryable figure somewhere the project rule says it
-- must not live. Aggregate analytics reads this table directly, and it carries
-- no identity of its own.

create table public.wellbeing_result_dimensions (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.wellbeing_results (id) on delete cascade,
  dimension_key text not null references public.wellbeing_dimensions (key),
  -- Raw points for this dimension (0–8 in V1).
  raw_score smallint not null check (raw_score >= 0),
  -- Normalised 0–100.
  index_score smallint not null check (index_score between 0 and 100),
  created_at timestamptz not null default now(),
  unique (result_id, dimension_key)
);
create index wellbeing_result_dimensions_result_idx
  on public.wellbeing_result_dimensions (result_id);
create index wellbeing_result_dimensions_key_idx
  on public.wellbeing_result_dimensions (dimension_key);

-- ── 7 · instrument selection for a session ───────────────────────────
--
-- Reuses the existing team model rather than adding a parallel campaign
-- entity. Null means "not chosen yet"; the participant flow refuses to start
-- rather than guessing, so one instrument is never silently substituted for
-- another.

alter table public.teams
  add column wellbeing_instrument_key text
    references public.wellbeing_instruments (key);
create index teams_wellbeing_instrument_idx
  on public.teams (wellbeing_instrument_key);

alter table public.team_creation_drafts
  add column wellbeing_instrument_key text;

-- ── 8 · RLS ──────────────────────────────────────────────────────────
--
-- Instrument and dimension definitions are reference data, readable by any
-- signed-in user (a participant's own result page names its dimensions).
-- Dimension SCORES follow their parent result exactly: own-row, and readable
-- by nobody else — no team admin, no organization admin, no wellbeing role,
-- no platform super admin.

alter table public.wellbeing_instruments enable row level security;
create policy wellbeing_instruments_select on public.wellbeing_instruments
  for select using (auth.uid() is not null);

alter table public.wellbeing_dimensions enable row level security;
create policy wellbeing_dimensions_select on public.wellbeing_dimensions
  for select using (auth.uid() is not null);

alter table public.wellbeing_result_dimensions enable row level security;
create policy wellbeing_result_dimensions_select_own on public.wellbeing_result_dimensions
  for select using (
    exists (
      select 1 from public.wellbeing_results r
      where r.id = result_id and r.profile_id = auth.uid()
    )
  );
create policy wellbeing_result_dimensions_insert_own on public.wellbeing_result_dimensions
  for insert with check (
    exists (
      select 1 from public.wellbeing_results r
      where r.id = result_id and r.profile_id = auth.uid()
    )
  );
-- No update and no delete policy: a completed result's dimensions are as
-- immutable as the result itself.

grant select, insert, update, delete on
  public.wellbeing_instruments, public.wellbeing_dimensions,
  public.wellbeing_result_dimensions
  to authenticated, service_role;
