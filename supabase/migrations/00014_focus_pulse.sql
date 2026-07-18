-- Focus & Digital Dopamine Pulse — a second, first-class assessment product.
--
-- Structurally distinct from DISC (single-select + one 1–10 scale, not
-- MOST/LEAST forced choice), so it gets its own tables rather than being
-- shoehorned into the DISC bank. Scoring is computed server-side and stored in
-- focus_results — never only in the browser. Deliberately non-clinical: no
-- column names or values reference dopamine, addiction or diagnosis.

create type public.assessment_type as enum ('disc', 'focus', 'combined');
create type public.focus_question_kind as enum ('single', 'scale');

-- ── content: versions / questions / options ──────────────────────────

create table public.focus_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version int not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.focus_questions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.focus_versions (id) on delete cascade,
  external_id text not null,
  position int not null,
  prompt text not null,
  kind public.focus_question_kind not null default 'single',
  scale_min int,
  scale_max int,
  unique (version_id, external_id),
  unique (version_id, position)
);

create table public.focus_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.focus_questions (id) on delete cascade,
  external_id text not null,
  position int not null,
  label text not null,
  unique (question_id, external_id)
);
create index focus_options_question_idx on public.focus_options (question_id);

-- ── participant flow: sessions / responses / results ─────────────────

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  version_id uuid not null references public.focus_versions (id),
  campaign_id uuid references public.assessment_campaigns (id) on delete set null,
  status public.session_status not null default 'in_progress',
  current_index int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger focus_sessions_updated before update on public.focus_sessions
  for each row execute function public.set_updated_at();
create index focus_sessions_profile_idx on public.focus_sessions (profile_id);
create index focus_sessions_campaign_idx on public.focus_sessions (campaign_id);

create table public.focus_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.focus_sessions (id) on delete cascade,
  question_id uuid not null references public.focus_questions (id),
  -- single-select answers set option_id; the one 1–10 scale sets scale_value.
  option_id uuid references public.focus_options (id),
  scale_value int,
  answered_at timestamptz not null default now(),
  unique (session_id, question_id),
  check (option_id is not null or scale_value is not null)
);

create table public.focus_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.focus_sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- four non-clinical 0–100 dimensions, queryable columns (never JSON-only)
  automaticity smallint not null check (automaticity between 0 and 100),
  distraction smallint not null check (distraction between 0 and 100),
  mental_load smallint not null check (mental_load between 0 and 100),
  recovery smallint not null check (recovery between 0 and 100),
  -- derived pattern + descriptors (text keys resolved to labels in the app)
  pattern_code text not null,
  primary_loop text not null,
  notification_pattern text not null,
  energy_pattern text not null,
  preferred_reset text not null,
  raw jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index focus_results_profile_idx on public.focus_results (profile_id);
create index focus_results_created_idx on public.focus_results (profile_id, created_at desc);

-- ── combined linkage: one DISC session + one Focus session ───────────

create table public.combined_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  disc_session_id uuid references public.assessment_sessions (id) on delete set null,
  focus_session_id uuid references public.focus_sessions (id) on delete set null,
  campaign_id uuid references public.assessment_campaigns (id) on delete set null,
  status public.session_status not null default 'in_progress',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger combined_sessions_updated before update on public.combined_sessions
  for each row execute function public.set_updated_at();
create index combined_sessions_profile_idx on public.combined_sessions (profile_id);

-- ── team assessment type ─────────────────────────────────────────────

alter table public.teams
  add column assessment_type public.assessment_type not null default 'disc';
alter table public.team_creation_drafts
  add column assessment_type public.assessment_type not null default 'disc';

-- ── RLS ──────────────────────────────────────────────────────────────
-- Content is readable by any authenticated user (mirrors the DISC bank).
-- Sessions/responses/results are strictly own-row.

alter table public.focus_versions enable row level security;
create policy focus_versions_select on public.focus_versions
  for select using (auth.uid() is not null);

alter table public.focus_questions enable row level security;
create policy focus_questions_select on public.focus_questions
  for select using (auth.uid() is not null);

alter table public.focus_options enable row level security;
create policy focus_options_select on public.focus_options
  for select using (auth.uid() is not null);

alter table public.focus_sessions enable row level security;
create policy focus_sessions_all_own on public.focus_sessions
  for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

alter table public.focus_responses enable row level security;
create policy focus_responses_all_own on public.focus_responses
  for all using (
    exists (
      select 1 from public.focus_sessions s
      where s.id = session_id and s.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.focus_sessions s
      where s.id = session_id and s.profile_id = auth.uid()
    )
  );

alter table public.focus_results enable row level security;
create policy focus_results_select_own on public.focus_results
  for select using (profile_id = auth.uid());
create policy focus_results_insert_own on public.focus_results
  for insert with check (profile_id = auth.uid());

alter table public.combined_sessions enable row level security;
create policy combined_sessions_all_own on public.combined_sessions
  for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Grants (default privileges from 00004 cover new tables; explicit for safety).
grant select, insert, update, delete on
  public.focus_versions, public.focus_questions, public.focus_options,
  public.focus_sessions, public.focus_responses, public.focus_results,
  public.combined_sessions
  to authenticated, service_role;

-- ── content seed (generated from data/focus-questions.ts) ──────────

insert into public.focus_versions (id, name, version, is_active)
values ('00000000-0000-4000-8000-0000000000f1', 'Focus Pulse v1', 1, true);

-- q1_pickup
insert into public.focus_questions (version_id, external_id, position, prompt, kind, scale_min, scale_max)
values ('00000000-0000-4000-8000-0000000000f1', 'q1_pickup', 0, 'How often do you pick up your phone without consciously deciding to?', 'single', null, null);
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q1_never', 0, 'Almost never' from public.focus_questions where external_id = 'q1_pickup' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q1_few', 1, 'A few times a day' from public.focus_questions where external_id = 'q1_pickup' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q1_several', 2, 'Several times a day' from public.focus_questions where external_id = 'q1_pickup' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q1_frequent', 3, 'Very frequently' from public.focus_questions where external_id = 'q1_pickup' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q1_automatic', 4, 'It feels almost automatic' from public.focus_questions where external_id = 'q1_pickup' and version_id = '00000000-0000-4000-8000-0000000000f1';

-- q2_difficult
insert into public.focus_questions (version_id, external_id, position, prompt, kind, scale_min, scale_max)
values ('00000000-0000-4000-8000-0000000000f1', 'q2_difficult', 1, 'When a work task becomes difficult or uncomfortable, what do you usually do first?', 'single', null, null);
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q2_social', 0, 'Open social media, news or another browser tab' from public.focus_questions where external_id = 'q2_difficult' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q2_messages', 1, 'Check messages or email' from public.focus_questions where external_id = 'q2_difficult' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q2_movement', 2, 'Get food, coffee or leave the desk' from public.focus_questions where external_id = 'q2_difficult' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q2_easier', 3, 'Switch to a smaller, easier task' from public.focus_questions where external_id = 'q2_difficult' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q2_stay', 4, 'Stay with the task until I make progress' from public.focus_questions where external_id = 'q2_difficult' and version_id = '00000000-0000-4000-8000-0000000000f1';

-- q3_notification
insert into public.focus_questions (version_id, external_id, position, prompt, kind, scale_min, scale_max)
values ('00000000-0000-4000-8000-0000000000f1', 'q3_notification', 2, 'When a notification appears while you are concentrating, what usually happens?', 'single', null, null);
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q3_immediate', 0, 'I check it immediately' from public.focus_questions where external_id = 'q3_notification' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q3_finish', 1, 'I finish my current thought, then check' from public.focus_questions where external_id = 'q3_notification' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q3_planned', 2, 'I wait until a planned break' from public.focus_questions where external_id = 'q3_notification' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q3_disabled', 3, 'Most notifications are disabled' from public.focus_questions where external_id = 'q3_notification' and version_id = '00000000-0000-4000-8000-0000000000f1';

-- q4_energy
insert into public.focus_questions (version_id, external_id, position, prompt, kind, scale_min, scale_max)
values ('00000000-0000-4000-8000-0000000000f1', 'q4_energy', 3, 'When does your concentration usually decline most sharply?', 'single', null, null);
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q4_morning', 0, 'Before midday' from public.focus_questions where external_id = 'q4_energy' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q4_lunch', 1, 'Just after lunch' from public.focus_questions where external_id = 'q4_energy' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q4_afternoon', 2, 'Late afternoon' from public.focus_questions where external_id = 'q4_energy' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q4_evening', 3, 'Evening' from public.focus_questions where external_id = 'q4_energy' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q4_steady', 4, 'My energy is generally steady' from public.focus_questions where external_id = 'q4_energy' and version_id = '00000000-0000-4000-8000-0000000000f1';

-- q5_noise
insert into public.focus_questions (version_id, external_id, position, prompt, kind, scale_min, scale_max)
values ('00000000-0000-4000-8000-0000000000f1', 'q5_noise', 4, 'How noisy does your mind feel right now?', 'scale', 1, 10);

-- q6_reset
insert into public.focus_questions (version_id, external_id, position, prompt, kind, scale_min, scale_max)
values ('00000000-0000-4000-8000-0000000000f1', 'q6_reset', 5, 'What helps you regain focus most effectively?', 'single', null, null);
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q6_movement', 0, 'A short walk or physical movement' from public.focus_questions where external_id = 'q6_reset' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q6_quiet', 1, 'Quiet time without notifications' from public.focus_questions where external_id = 'q6_reset' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q6_priorities', 2, 'A clear priority list' from public.focus_questions where external_id = 'q6_reset' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q6_talking', 3, 'Talking the problem through with someone' from public.focus_questions where external_id = 'q6_reset' and version_id = '00000000-0000-4000-8000-0000000000f1';
insert into public.focus_options (question_id, external_id, position, label)
select id, 'q6_deadline', 4, 'A deadline or external pressure' from public.focus_questions where external_id = 'q6_reset' and version_id = '00000000-0000-4000-8000-0000000000f1';
