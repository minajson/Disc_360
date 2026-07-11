-- DISC360 core schema
-- Conventions: uuid PKs, created_at/updated_at maintained by trigger,
-- soft archival via archived_at, FKs indexed, scores in queryable columns.

create extension if not exists pgcrypto;

-- ── enums ────────────────────────────────────────────────────────────
create type public.org_member_role as enum ('member', 'coach', 'organization_admin');
create type public.team_member_role as enum ('member', 'team_admin');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
create type public.campaign_status as enum ('draft', 'scheduled', 'active', 'closed', 'archived');
create type public.assignment_status as enum ('invited', 'started', 'completed');
create type public.session_status as enum ('in_progress', 'completed', 'abandoned');
create type public.dimension as enum ('D', 'I', 'S', 'C');
create type public.archetype_code as enum
  ('D','DI','ID','I','IS','SI','S','SC','CS','C','CD','DC','BAL');
create type public.export_kind as enum ('individual_report', 'team_report', 'presentation');
create type public.notification_status as enum ('queued', 'sent', 'failed', 'skipped', 'logged');
create type public.onboarding_intent as enum
  ('understand_myself', 'create_team', 'join_team', 'manage_clients', 'setup_organization');

-- ── updated_at trigger ───────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles ─────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  preferred_name text not null default '',
  profession text,
  country text,
  timezone text,
  is_super_admin boolean not null default false,
  onboarding_intent public.onboarding_intent,
  consented_at timestamptz,
  onboarded_at timestamptz,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- auto-provision a profile row for every new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  insert into public.notification_preferences (profile_id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── organizations ────────────────────────────────────────────────────
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  created_by uuid not null references public.profiles (id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_updated before update on public.organizations
  for each row execute function public.set_updated_at();
create index organizations_created_by_idx on public.organizations (created_by);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_member_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_id)
);
create trigger organization_members_updated before update on public.organization_members
  for each row execute function public.set_updated_at();
create index organization_members_profile_idx on public.organization_members (profile_id);
create index organization_members_org_idx on public.organization_members (organization_id);

-- ── teams ────────────────────────────────────────────────────────────
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text not null default '',
  department text,
  logo_url text,
  timezone text,
  -- short human code for joining (e.g. ATLAS-4921)
  team_code text not null unique,
  -- rotatable token behind the reusable invitation link
  invite_token uuid not null default gen_random_uuid(),
  results_named boolean not null default false,
  members_can_view_summary boolean not null default true,
  approx_size int,
  deadline_at timestamptz,
  created_by uuid not null references public.profiles (id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger teams_updated before update on public.teams
  for each row execute function public.set_updated_at();
create index teams_org_idx on public.teams (organization_id);
create unique index teams_invite_token_idx on public.teams (invite_token);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  -- null until the person creates an account and joins
  profile_id uuid references public.profiles (id) on delete set null,
  display_name text not null,
  email text not null,
  department text,
  role public.team_member_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, email)
);
create trigger team_members_updated before update on public.team_members
  for each row execute function public.set_updated_at();
create index team_members_team_idx on public.team_members (team_id);
create index team_members_profile_idx on public.team_members (profile_id);

-- ── invitations (personal email invitations) ─────────────────────────
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  team_member_id uuid references public.team_members (id) on delete cascade,
  email text not null,
  token uuid not null unique default gen_random_uuid(),
  status public.invitation_status not null default 'pending',
  message text,
  invited_by uuid not null references public.profiles (id),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_by uuid references public.profiles (id),
  accepted_at timestamptz,
  last_sent_at timestamptz not null default now(),
  send_count int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger invitations_updated before update on public.invitations
  for each row execute function public.set_updated_at();
create index invitations_team_idx on public.invitations (team_id);
create index invitations_email_idx on public.invitations (email);

-- ── assessment content ───────────────────────────────────────────────
create table public.assessment_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version int not null unique,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.assessment_versions (id) on delete cascade,
  external_id text not null,
  position int not null,
  prompt text not null,
  unique (version_id, position),
  unique (version_id, external_id)
);
create index questions_version_idx on public.questions (version_id);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  external_id text not null,
  position int not null,
  label text not null,
  dimension public.dimension not null,
  unique (question_id, position),
  unique (question_id, external_id)
);
create index question_options_question_idx on public.question_options (question_id);

-- ── campaigns ────────────────────────────────────────────────────────
create table public.assessment_campaigns (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  version_id uuid not null references public.assessment_versions (id),
  name text not null,
  invitation_message text not null default '',
  status public.campaign_status not null default 'draft',
  starts_at timestamptz,
  deadline_at timestamptz,
  created_by uuid not null references public.profiles (id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger assessment_campaigns_updated before update on public.assessment_campaigns
  for each row execute function public.set_updated_at();
create index campaigns_team_idx on public.assessment_campaigns (team_id);

create table public.campaign_assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.assessment_campaigns (id) on delete cascade,
  team_member_id uuid not null references public.team_members (id) on delete cascade,
  status public.assignment_status not null default 'invited',
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, team_member_id)
);
create trigger campaign_assignments_updated before update on public.campaign_assignments
  for each row execute function public.set_updated_at();
create index assignments_campaign_idx on public.campaign_assignments (campaign_id);
create index assignments_member_idx on public.campaign_assignments (team_member_id);

-- ── assessment flow ──────────────────────────────────────────────────
create table public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  version_id uuid not null references public.assessment_versions (id),
  campaign_id uuid references public.assessment_campaigns (id) on delete set null,
  status public.session_status not null default 'in_progress',
  current_index int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger assessment_sessions_updated before update on public.assessment_sessions
  for each row execute function public.set_updated_at();
create index sessions_profile_idx on public.assessment_sessions (profile_id);
create index sessions_campaign_idx on public.assessment_sessions (campaign_id);

create table public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  most_option_id uuid not null references public.question_options (id),
  least_option_id uuid not null references public.question_options (id),
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, question_id),
  check (most_option_id <> least_option_id)
);
create trigger assessment_responses_updated before update on public.assessment_responses
  for each row execute function public.set_updated_at();
create index responses_session_idx on public.assessment_responses (session_id);

create table public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.assessment_sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- normalized 0–100 scores in queryable columns (never JSON-only)
  score_d smallint not null check (score_d between 0 and 100),
  score_i smallint not null check (score_i between 0 and 100),
  score_s smallint not null check (score_s between 0 and 100),
  score_c smallint not null check (score_c between 0 and 100),
  archetype_code public.archetype_code not null,
  primary_dimension public.dimension not null,
  secondary_dimension public.dimension,
  intensity jsonb not null,
  raw_most jsonb not null,
  raw_least jsonb not null,
  net jsonb not null,
  created_at timestamptz not null default now()
);
create index results_profile_idx on public.assessment_results (profile_id);
create index results_created_idx on public.assessment_results (profile_id, created_at desc);

create table public.result_insights (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null unique references public.assessment_results (id) on delete cascade,
  -- frozen snapshot of the archetype insight content at computation time,
  -- so reports remain stable if copy evolves
  insight_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

-- ── exports / notifications / audit ──────────────────────────────────
create table public.report_exports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  result_id uuid references public.assessment_results (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  kind public.export_kind not null,
  created_at timestamptz not null default now()
);
create index exports_profile_idx on public.report_exports (profile_id);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  assessment_reminders boolean not null default true,
  team_updates boolean not null default true,
  report_notifications boolean not null default true,
  product_updates boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger notification_preferences_updated before update on public.notification_preferences
  for each row execute function public.set_updated_at();

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  email text not null,
  template text not null,
  subject text not null,
  status public.notification_status not null,
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);
create index notification_logs_profile_idx on public.notification_logs (profile_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_actor_idx on public.audit_logs (actor_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
