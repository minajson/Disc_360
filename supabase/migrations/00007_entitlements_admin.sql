-- Entitlements (doubles as the payment ledger), account deactivation,
-- and secure report share tokens.

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  purchaser_id uuid not null references public.profiles (id) on delete cascade,
  product text not null default 'team' check (product in ('team')),
  amount_cents int not null default 800,
  status text not null default 'active' check (status in ('active', 'consumed', 'revoked')),
  team_id uuid references public.teams (id) on delete set null,
  simulated boolean not null default true,
  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger entitlements_updated before update on public.entitlements
  for each row execute function public.set_updated_at();
create index entitlements_purchaser_idx on public.entitlements (purchaser_id);
create index entitlements_status_idx on public.entitlements (status);

alter table public.entitlements enable row level security;
-- Owners see their own purchases; all writes go through server actions
-- (dev checkout / admin grants) using the service role after explicit checks.
create policy entitlements_select_own on public.entitlements
  for select using (purchaser_id = auth.uid());

grant select, insert, update, delete on public.entitlements
  to authenticated, service_role;

-- Account deactivation (admin action; guards reject deactivated accounts).
alter table public.profiles add column deactivated_at timestamptz;

-- Event/session label for facilitated team assessments.
alter table public.teams add column session_name text;

-- Secure share link token for individual reports.
alter table public.assessment_results
  add column share_token uuid not null unique default gen_random_uuid();
