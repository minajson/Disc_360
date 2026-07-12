-- Coach profiles, media uploads (storage), team join controls, and
-- engagement metadata for coaching workspaces.

-- ── coach profiles ───────────────────────────────────────────────────
create table public.coach_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  title text,
  organization text,
  phone text,
  location text,
  bio text not null default '',
  credentials text[] not null default '{}',
  expertise text[] not null default '{}',
  specialties text[] not null default '{}',
  years_experience int,
  website text,
  linkedin text,
  photo_path text,
  banner_path text,
  logo_path text,
  show_in_presentation boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger coach_profiles_updated before update on public.coach_profiles
  for each row execute function public.set_updated_at();

alter table public.coach_profiles enable row level security;
create policy coach_profiles_all_own on public.coach_profiles
  for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
-- Client-facing identity: any signed-in user may read coach profiles.
create policy coach_profiles_select_authenticated on public.coach_profiles
  for select using (auth.uid() is not null);

grant select, insert, update, delete on public.coach_profiles
  to authenticated, service_role;

-- ── team join + engagement metadata ─────────────────────────────────
alter table public.teams add column cover_path text;
alter table public.teams add column client_organization text;
alter table public.teams add column engagement_starts_at date;
alter table public.teams add column join_enabled boolean not null default true;

alter table public.organizations add column description text not null default '';
alter table public.organizations add column logo_path text;
alter table public.organizations add column cover_path text;

alter table public.team_members add column reference_id text;

-- ── storage: public media bucket with owner-scoped writes ───────────
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy media_public_read on storage.objects
  for select using (bucket_id = 'media');

-- Writers own their folder: <kind>/<uid>/<file>
create policy media_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'media'
    and auth.uid() is not null
    and (storage.foldername(name))[2] = auth.uid()::text
  );
create policy media_owner_update on storage.objects
  for update using (
    bucket_id = 'media'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
create policy media_owner_delete on storage.objects
  for delete using (
    bucket_id = 'media'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
