-- Team-scoped attempts and results.
--
-- Root cause of cross-team report leakage: sessions and results carried no
-- team linkage, so every team surface resolved "the member's latest result"
-- from ANY context — an old team's report walked straight into a new team.
--
-- Every attempt now records the team (and thereby the facilitated session)
-- it was taken for; NULL team_id means a true individual attempt. Team
-- surfaces MUST scope by team_id. One active attempt per (user, team) — and
-- per user for individual attempts — is enforced by partial unique indexes.

alter table public.assessment_sessions
  add column team_id uuid references public.teams (id) on delete set null;
alter table public.focus_sessions
  add column team_id uuid references public.teams (id) on delete set null;
alter table public.combined_sessions
  add column team_id uuid references public.teams (id) on delete set null;

alter table public.assessment_results
  add column team_id uuid references public.teams (id) on delete set null;
alter table public.focus_results
  add column team_id uuid references public.teams (id) on delete set null;

create index assessment_sessions_team_idx on public.assessment_sessions (team_id);
create index focus_sessions_team_idx on public.focus_sessions (team_id);
create index combined_sessions_team_idx on public.combined_sessions (team_id);
create index assessment_results_team_idx on public.assessment_results (team_id);
create index focus_results_team_idx on public.focus_results (team_id);

-- One ACTIVE attempt per (user, team); one active individual attempt.
create unique index assessment_sessions_active_team_uniq
  on public.assessment_sessions (profile_id, team_id)
  where status = 'in_progress' and team_id is not null;
create unique index assessment_sessions_active_solo_uniq
  on public.assessment_sessions (profile_id)
  where status = 'in_progress' and team_id is null;

create unique index focus_sessions_active_team_uniq
  on public.focus_sessions (profile_id, team_id)
  where status = 'in_progress' and team_id is not null;
create unique index focus_sessions_active_solo_uniq
  on public.focus_sessions (profile_id)
  where status = 'in_progress' and team_id is null;

create unique index combined_sessions_active_team_uniq
  on public.combined_sessions (profile_id, team_id)
  where status = 'in_progress' and team_id is not null;
create unique index combined_sessions_active_solo_uniq
  on public.combined_sessions (profile_id)
  where status = 'in_progress' and team_id is null;

-- Existing rows keep NULL team_id deliberately: historical attempts cannot be
-- attributed to a team with confidence, and mis-attribution is exactly the
-- defect being fixed. scripts/audit-attempt-scope.mjs reports the population
-- for review; any backfill happens through a reviewed follow-up migration.
