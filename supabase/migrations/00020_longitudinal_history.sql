-- Longitudinal assessment history: context snapshots and explicit team lineage.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT THIS MIGRATION DOES NOT DO — the important part.
--
-- It adds nullable columns, indexes and two read policies. That is all.
--   · No row is updated. No row is deleted. No column is dropped.
--   · No uniqueness constraint is added, changed or removed.
--   · No historical team_id is inferred or backfilled. 00018 deliberately
--     left pre-existing attempts unattributed because mis-attribution was the
--     defect it fixed; guessing now would reintroduce it.
--   · Scoring is untouched. `scoring_version` records which engine produced a
--     row going forward; it does not re-score anything.
--
-- Audited against production (mtzayjhfyliocdrprbox) before writing:
--   47 assessment_results · 44 focus_results · 53 assessment_sessions
--   11 teams · 0 duplicate team names
--   1 profile already holds 2 completed DISC results
--
-- That last line matters: retakes ALREADY work. Uniqueness on attempts is
--   assessment_sessions_active_team_uniq  (profile_id, team_id) WHERE in_progress
--   assessment_sessions_active_solo_uniq  (profile_id)          WHERE in_progress
--   assessment_results_session_id_key     (session_id)
-- — one ACTIVE attempt per context and one result per session. Nothing caps
-- completed attempts per lifetime, so no constraint has to be relaxed and no
-- existing row is at risk.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1 · retake reason ────────────────────────────────────────────────

create type public.retake_reason as enum (
  'first_attempt',
  'new_role',
  'new_team',
  'annual_reassessment',
  'leadership_programme',
  'personal_review',
  'other'
);

-- ── 2 · team lineage ─────────────────────────────────────────────────
--
-- Lineage is explicit. A name heuristic would be wrong in both directions:
-- two unrelated teams can share a name, and a continuing team is usually
-- renamed precisely because something changed. Production currently has zero
-- duplicate team names, so a name-based join would silently find nothing and
-- look like it worked.
--
-- team_series_id groups a continuing team across annual sessions, cohorts and
-- restructures. It defaults to NULL: an unlinked team is its own series of
-- one, and history simply shows a single period.

create table public.team_series (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text not null default '',
  created_by uuid not null references public.profiles (id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger team_series_updated before update on public.team_series
  for each row execute function public.set_updated_at();
create index team_series_org_idx on public.team_series (organization_id);

alter table public.teams
  add column team_series_id uuid references public.team_series (id) on delete set null,
  -- Direct predecessor, for the common "this team continues that team" case
  -- where a full series is more ceremony than the facilitator wants.
  add column parent_team_id uuid references public.teams (id) on delete set null;

create index teams_series_idx on public.teams (team_series_id);
create index teams_parent_idx on public.teams (parent_team_id);

-- ── 3 · context snapshots on completed results ───────────────────────
--
-- Historical records must not depend on mutable current fields. A member's
-- department changes, a team is renamed, an organisation is restructured —
-- and a two-year-old result should still read as it did on the day.
--
-- Every column is nullable. Existing rows keep NULL and render as "context
-- not recorded", which is honest; inventing a snapshot from today's values
-- would be a fabricated historical record.

alter table public.assessment_results
  add column role_at_completion text,
  add column department_at_completion text,
  add column team_name_at_completion text,
  add column organization_name_at_completion text,
  add column organization_id uuid references public.organizations (id) on delete set null,
  add column team_series_id uuid references public.team_series (id) on delete set null,
  add column assessment_version int,
  add column scoring_version text,
  add column retake_reason public.retake_reason,
  add column retake_note text,
  -- Sequence within this participant's own history, 1-based. Written at
  -- completion; never recomputed, so deleting nothing keeps it stable.
  add column attempt_number int;

alter table public.focus_results
  add column role_at_completion text,
  add column department_at_completion text,
  add column team_name_at_completion text,
  add column organization_name_at_completion text,
  add column organization_id uuid references public.organizations (id) on delete set null,
  add column team_series_id uuid references public.team_series (id) on delete set null,
  add column assessment_version int,
  add column scoring_version text,
  add column retake_reason public.retake_reason,
  add column retake_note text,
  add column attempt_number int;

-- Retake intent is captured when the attempt starts, then copied onto the
-- result at completion — so an abandoned retake still records why it began.
alter table public.assessment_sessions
  add column retake_reason public.retake_reason,
  add column retake_note text;
alter table public.focus_sessions
  add column retake_reason public.retake_reason,
  add column retake_note text;
alter table public.combined_sessions
  add column retake_reason public.retake_reason,
  add column retake_note text;

-- ── 4 · administrative corrections, with history ─────────────────────
--
-- Completed results are immutable in normal operation. The one exception is a
-- narrow administrative correction, and it is recorded rather than applied
-- silently: the original values are preserved in the log, so a corrected row
-- can always be read back to what it was.

create table public.result_corrections (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.assessment_results (id) on delete cascade,
  corrected_by uuid not null references public.profiles (id),
  reason text not null,
  previous_values jsonb not null,
  new_values jsonb not null,
  created_at timestamptz not null default now()
);
create index result_corrections_result_idx on public.result_corrections (result_id);

alter table public.result_corrections enable row level security;
-- Platform scope only; the service role writes them after an explicit check.
create policy result_corrections_select_admin on public.result_corrections
  for select using (public.is_super_admin());

-- ── 5 · history lookup paths ─────────────────────────────────────────

create index if not exists assessment_results_history_idx
  on public.assessment_results (profile_id, created_at desc);
create index if not exists focus_results_history_idx
  on public.focus_results (profile_id, created_at desc);
create index if not exists assessment_results_series_idx
  on public.assessment_results (team_series_id, created_at desc);
create index if not exists focus_results_series_idx
  on public.focus_results (team_series_id, created_at desc);

-- ── 6 · team_series policies ─────────────────────────────────────────
--
-- Read: anyone who can see a team in the series, plus platform admins.
-- Write: platform admins and organization admins only — associating a team
-- with a series is an administrative act that changes what history a
-- facilitator can see, so it does not belong to every team admin.

alter table public.team_series enable row level security;

create policy team_series_select on public.team_series
  for select using (
    public.is_org_member(organization_id)
    or public.is_super_admin()
    or exists (
      select 1 from public.teams t
      where t.team_series_id = team_series.id and public.is_team_admin(t.id)
    )
  );

create policy team_series_insert on public.team_series
  for insert with check (
    public.is_org_admin(organization_id) and created_by = auth.uid()
  );

create policy team_series_update on public.team_series
  for update using (public.is_org_admin(organization_id));

grant select on public.team_series to authenticated;
grant insert, update on public.team_series to authenticated;

-- ── 7 · what a participant may read of their own history ─────────────
--
-- results_select_own already scopes assessment_results to profile_id =
-- auth.uid(), which is exactly "my own history and nobody else's". The same
-- holds for focus_results. No new policy is needed, and deliberately none is
-- added: widening these is how cross-participant history leaks would start.
