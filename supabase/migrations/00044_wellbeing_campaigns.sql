-- Wellbeing campaigns become their own entity.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHY A TABLE RATHER THAN MORE COLUMNS ON `teams`.
--
-- Until now a "wellbeing campaign" was a `teams` row carrying
-- `wellbeing_instrument_key` and typed `assessment_type = 'wellbeing'`. That
-- worked while wellbeing was one pilot, and it has three faults that a QR
-- code makes fatal:
--
--   1 · A team has an `invite_token` that resolves to the DISC invitation
--       experience. A wellbeing participant scanning a wellbeing QR reached a
--       page offering the DISC360 assessment, because the token they held was
--       a TEAM token and the team join route is DISC's.
--   2 · A team has no questionnaire VERSION. The instrument was known; which
--       wording a participant answered was whatever happened to be active at
--       the time. Two participants in one campaign could answer different
--       content and be compared as if they had not.
--   3 · Campaign concerns (capacity, status, closure) were competing for room
--       with DISC team concerns on the same row.
--
-- This table owns the campaign. DISC keeps `teams` exactly as it is: no DISC
-- column is dropped, retyped or repurposed here, and no DISC route changes.
--
-- THE INVARIANT THIS EXISTS TO ENFORCE.
--
--   campaign → exact instrument → exact questionnaire version
--
-- The participant never chooses. `version_id` is pinned at creation and frozen
-- the moment anybody answers, so a campaign's results are always comparable.
-- ─────────────────────────────────────────────────────────────────────

create type public.wellbeing_campaign_status as enum
  ('draft', 'active', 'closed', 'archived');

-- A version belongs to exactly one instrument, and the campaign records both.
-- Rather than trust application code to keep them agreeing, make the database
-- refuse the disagreement: this unique index is what the composite foreign key
-- below points at.
create unique index wellbeing_versions_instrument_identity
  on public.wellbeing_versions (questionnaire_code, id);

create table public.wellbeing_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,

  -- Instrument and version together, so they cannot drift apart.
  instrument_key text not null references public.wellbeing_instruments (key),
  version_id uuid not null references public.wellbeing_versions (id),

  created_by uuid not null references public.profiles (id),
  name text not null check (length(btrim(name)) between 1 and 120),
  status public.wellbeing_campaign_status not null default 'active',

  -- DISTINCT participants, not attempts. NULL means uncapped. Enforced in
  -- `wellbeing_campaign_admits()` below, which counts distinct profiles so a
  -- participant retaking their own pulse never consumes a second place.
  participant_capacity int check (participant_capacity is null or participant_capacity > 0),

  -- The public identifier. Random, not derived from the id, so possessing a
  -- campaign id does not let anyone guess a join link.
  join_token text not null unique
    check (join_token ~ '^[A-Za-z0-9_-]{24,64}$'),

  expires_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The pairing above, enforced.
  constraint wellbeing_campaigns_version_matches_instrument
    foreign key (instrument_key, version_id)
    references public.wellbeing_versions (questionnaire_code, id),

  constraint wellbeing_campaigns_closed_has_timestamp
    check (status <> 'closed' or closed_at is not null)
);

create index wellbeing_campaigns_org_idx on public.wellbeing_campaigns (organization_id);
create index wellbeing_campaigns_creator_idx on public.wellbeing_campaigns (created_by);
create index wellbeing_campaigns_version_idx on public.wellbeing_campaigns (version_id);
create index wellbeing_campaigns_status_idx on public.wellbeing_campaigns (status)
  where status = 'active';

create trigger wellbeing_campaigns_updated before update on public.wellbeing_campaigns
  for each row execute function public.set_updated_at();

-- ── the participant's session belongs to a campaign ──────────────────
--
-- Nullable, because the existing pilot session predates campaigns and must not
-- be invented into one. New participant journeys always carry it.
alter table public.wellbeing_sessions
  add column campaign_id uuid references public.wellbeing_campaigns (id) on delete set null;
create index wellbeing_sessions_campaign_idx on public.wellbeing_sessions (campaign_id);

alter table public.wellbeing_results
  add column campaign_id uuid references public.wellbeing_campaigns (id) on delete set null;
create index wellbeing_results_campaign_idx on public.wellbeing_results (campaign_id);

-- ── version immutability once anybody has answered ───────────────────
--
-- Before the first response a facilitator may still correct a mis-selected
-- instrument. After it, changing the version would silently redefine what the
-- existing results mean, so the database refuses rather than trusting the UI
-- to hide the control.
create or replace function public.wellbeing_campaign_version_is_frozen()
returns trigger language plpgsql as $$
declare
  answered int;
begin
  if new.version_id is not distinct from old.version_id
     and new.instrument_key is not distinct from old.instrument_key then
    return new;
  end if;

  select count(*) into answered
  from public.wellbeing_sessions s
  where s.campaign_id = old.id;

  if answered > 0 then
    raise exception
      'Campaign % already has % participant session(s); its questionnaire '
      'version is frozen.', old.id, answered
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

create trigger wellbeing_campaigns_version_frozen
  before update on public.wellbeing_campaigns
  for each row execute function public.wellbeing_campaign_version_is_frozen();

-- ── capacity, counted in DISTINCT participants ───────────────────────
create or replace function public.wellbeing_campaign_admits(campaign uuid, participant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when c.status <> 'active' then false
    when c.expires_at is not null and c.expires_at <= now() then false
    when c.participant_capacity is null then true
    -- Already taking part: a retake never consumes another place.
    when exists (
      select 1 from public.wellbeing_sessions s
      where s.campaign_id = c.id and s.profile_id = participant
    ) then true
    else (
      select count(distinct s.profile_id)
      from public.wellbeing_sessions s
      where s.campaign_id = c.id
    ) < c.participant_capacity
  end
  from public.wellbeing_campaigns c
  where c.id = campaign;
$$;

-- ── RLS ──────────────────────────────────────────────────────────────
--
-- Reading a campaign is an organisational act, so it needs a wellbeing role in
-- that organisation. Writing one is governance only. Participants never read
-- this table directly — they arrive holding a token, which is resolved by the
-- security-definer function below and returns only what a join page needs.
alter table public.wellbeing_campaigns enable row level security;

create policy wellbeing_campaigns_read_with_role on public.wellbeing_campaigns
  for select to authenticated
  using (public.has_any_wellbeing_role(organization_id));

create policy wellbeing_campaigns_governance_inserts on public.wellbeing_campaigns
  for insert to authenticated
  with check (
    public.has_wellbeing_role(organization_id, 'wellbeing_governance')
    and created_by = auth.uid()
  );

create policy wellbeing_campaigns_governance_updates on public.wellbeing_campaigns
  for update to authenticated
  using (public.has_wellbeing_role(organization_id, 'wellbeing_governance'))
  with check (public.has_wellbeing_role(organization_id, 'wellbeing_governance'));

-- No DELETE policy. Campaigns are closed or archived, never removed, because
-- results reference them.

-- ── token resolution for the join page ───────────────────────────────
--
-- Security definer so an unauthenticated scanner can be shown the campaign's
-- name and instrument before signing in. It deliberately returns NO capacity
-- counts, NO participant list and NO facilitator identity beyond the
-- organisation's name — a scanned poster should not enumerate a workforce.
create or replace function public.wellbeing_campaign_by_token(token text)
returns table (
  campaign_id uuid,
  campaign_name text,
  organization_name text,
  instrument_key text,
  version_id uuid,
  status public.wellbeing_campaign_status,
  is_open boolean
)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, o.name, c.instrument_key, c.version_id, c.status,
         (c.status = 'active' and (c.expires_at is null or c.expires_at > now()))
  from public.wellbeing_campaigns c
  join public.organizations o on o.id = c.organization_id
  where c.join_token = token;
$$;

revoke all on function public.wellbeing_campaign_by_token(text) from public;
grant execute on function public.wellbeing_campaign_by_token(text) to anon, authenticated;
revoke all on function public.wellbeing_campaign_admits(uuid, uuid) from public;
grant execute on function public.wellbeing_campaign_admits(uuid, uuid) to authenticated, service_role;

do $$ begin
  raise notice 'wellbeing_campaigns installed: version pinned, frozen on first response, capacity counts distinct participants';
end $$;
