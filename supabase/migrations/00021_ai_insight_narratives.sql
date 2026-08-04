-- AI-written narrative drafts for facilitator insights.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT THIS MIGRATION DOES NOT DO — the important part.
--
--   · It stores no assessment response, no score, no member row and no name.
--     A draft holds prose and the provenance of that prose. Every figure a
--     card displays is recomputed from assessment_results at render time.
--   · It does not touch scoring, results, sessions, questions or history.
--     No existing table is altered; nothing is backfilled; nothing is dropped.
--   · It grants nothing to participants. A narrative is a facilitator's
--     working draft and is never auto-published to a team member — "shared"
--     here means shared with the people who already administer the team.
--
-- Provenance is a column, not an inference: `source` records whether the
-- prose came from a model or from the deterministic rules, so the UI can mark
-- AI-written text as AI-written without guessing, and an edited draft records
-- who edited it and when.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1 · provenance and lifecycle ─────────────────────────────────────

create type public.ai_narrative_source as enum ('model', 'rules', 'edited');

create type public.ai_narrative_status as enum ('draft', 'shared');

-- ── 2 · the draft ────────────────────────────────────────────────────
--
-- One current draft per team. Earlier versions are not kept here: every
-- generate, edit, save and share writes an audit_logs row, which is the
-- record of what happened, and a facilitator regenerating expects to replace
-- the draft rather than accumulate a pile of them.

create table public.ai_insight_narratives (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  status public.ai_narrative_status not null default 'draft',
  source public.ai_narrative_source not null default 'rules',
  -- Model that produced it, e.g. 'claude-opus-5'. Null for rule-written prose.
  model text,
  -- { cards: [...], brief: {...}, summary: {...} } — prose only, validated
  -- against lib/ai/schema.ts on both write and read.
  narrative jsonb not null default '{}'::jsonb,
  -- Completed/invited counts at the moment of generation. When the live counts
  -- move away from these, the surface says the prose predates the data rather
  -- than quietly pairing new figures with old sentences.
  sample_size integer not null default 0,
  population_size integer not null default 0,
  -- Parts that fell back to rule-written prose, e.g. ['brief'].
  fell_back text[] not null default '{}',
  generated_by uuid references public.profiles (id) on delete set null,
  generated_at timestamptz not null default now(),
  edited_by uuid references public.profiles (id) on delete set null,
  edited_at timestamptz,
  shared_by uuid references public.profiles (id) on delete set null,
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ai_insight_narratives_team_uniq
  on public.ai_insight_narratives (team_id);

create index ai_insight_narratives_generated_by_idx
  on public.ai_insight_narratives (generated_by);

create index ai_insight_narratives_generated_at_idx
  on public.ai_insight_narratives (generated_at desc);

create trigger ai_insight_narratives_updated
  before update on public.ai_insight_narratives
  for each row execute function public.set_updated_at();

-- ── 3 · policies ─────────────────────────────────────────────────────
--
-- Team admins only, in every direction. is_team_admin() already resolves
-- platform admins (00019), so no separate super-admin branch is needed and
-- there is exactly one definition of who may facilitate a team.
--
-- Note what is absent: no policy grants select to team members. A team member
-- reading their own team's row would be exactly the auto-publication the
-- product rules forbid.

alter table public.ai_insight_narratives enable row level security;

create policy ai_insight_narratives_select on public.ai_insight_narratives
  for select using (public.is_team_admin(team_id));

create policy ai_insight_narratives_insert on public.ai_insight_narratives
  for insert with check (public.is_team_admin(team_id));

create policy ai_insight_narratives_update on public.ai_insight_narratives
  for update using (public.is_team_admin(team_id));

create policy ai_insight_narratives_delete on public.ai_insight_narratives
  for delete using (public.is_team_admin(team_id));

grant select, insert, update, delete on public.ai_insight_narratives to authenticated;

-- ── 4 · rate limiting reads audit_logs ───────────────────────────────
--
-- The per-facilitator hourly limit counts audit_logs rows rather than keeping
-- a counter in process memory: this deploys to serverless functions, and an
-- in-memory bucket would be multiplied by however many instances happen to be
-- warm. This index is what makes that count cheap.

create index if not exists audit_logs_actor_action_time_idx
  on public.audit_logs (actor_id, action, created_at desc);
