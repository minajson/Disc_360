-- Team-creation drafts: one server-side home for wizard state.
--
-- Why this exists: the create-team journey crosses an authentication boundary
-- and a payment boundary. Anything the user typed before those boundaries used
-- to be discarded, so they retyped it afterwards. Holding the draft server-side
-- means the wizard can be restored on the far side of both.
--
-- Deliberately NOT a query string: team and organization names are customer
-- information and must not end up in browser history, referrer headers or
-- server access logs.

create table public.team_creation_drafts (
  id uuid primary key default gen_random_uuid(),
  -- Null only for a draft started before sign-in; claimed on authentication.
  owner_profile_id uuid references public.profiles (id) on delete cascade,
  -- Opaque bearer token for the pre-auth window. CSPRNG, carried in a
  -- short-lived HttpOnly cookie — never in a URL.
  draft_token uuid not null unique default gen_random_uuid(),

  -- Step 1 — team
  organization_name text not null default '',
  team_name text not null default '',
  session_name text,
  department text,
  approximate_size int check (approximate_size is null or approximate_size between 2 and 500),

  -- Step 2 — assessment settings
  timezone text,
  deadline_at timestamptz,
  results_named boolean not null default false,
  members_can_view_summary boolean not null default true,
  participant_limit int check (participant_limit is null or participant_limit between 1 and 1000),

  status text not null default 'draft' check (status in ('draft', 'claimed', 'completed', 'abandoned')),
  -- Drafts are disposable; a stale one must never resurface months later.
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index team_creation_drafts_owner_idx
  on public.team_creation_drafts (owner_profile_id, status);
create index team_creation_drafts_expiry_idx
  on public.team_creation_drafts (expires_at);

create trigger team_creation_drafts_updated
  before update on public.team_creation_drafts
  for each row execute function public.set_updated_at();

alter table public.team_creation_drafts enable row level security;

-- Owner-only, once claimed. An unclaimed draft is reachable exclusively
-- through the service role holding its token — RLS never exposes a draft with
-- a null owner, so a token cannot be used to enumerate other people's drafts.
create policy team_creation_drafts_select_own on public.team_creation_drafts
  for select using (owner_profile_id = auth.uid());
create policy team_creation_drafts_insert_own on public.team_creation_drafts
  for insert with check (owner_profile_id = auth.uid());
create policy team_creation_drafts_update_own on public.team_creation_drafts
  for update using (owner_profile_id = auth.uid())
  with check (owner_profile_id = auth.uid());
create policy team_creation_drafts_delete_own on public.team_creation_drafts
  for delete using (owner_profile_id = auth.uid());

grant select, insert, update, delete on public.team_creation_drafts to authenticated;
