-- ─────────────────────────────────────────────────────────────────────
-- Organisation support routes — EAP and Occupational Health, CONFIGURED.
--
-- WHY THIS TABLE EXISTS.
--
-- Employee Assistance Programme and Occupational Health access is a benefit an
-- organisation provides to EVERY employee. It is not a consequence of a
-- screening score, and the product must not present it as one: an employee who
-- only ever sees "support is available" after a high GHQ total learns that
-- support is for people the questionnaire has classified. That inference is
-- wrong, it is harmful, and it suppresses exactly the help-seeking the
-- programme exists to enable.
--
-- So the support card is shown on EVERY result for an organisation that has
-- configured one, at every score. What a score may change is prominence, never
-- availability.
--
-- WHY IT IS CONFIGURATION AND NOT COPY.
--
-- The platform is multi-organisation and multi-jurisdiction. A hard-coded
-- number is wrong for everybody except the organisation it was typed for, and
-- a wrong support number is worse than none — see the same reasoning in
-- data/ghq28-support-content.ts, which declines to guess a crisis line. The
-- organisation supplies its own route or the card is not shown.
--
-- WHAT IT DELIBERATELY DOES NOT DO.
--
-- No record is kept of who opened or clicked a support route. There is no
-- column here for it and no table elsewhere that receives it. Support use is
-- not analytics, is not reported to managers, and does not exist as data.
-- ─────────────────────────────────────────────────────────────────────

create table public.organization_support_settings (
  organization_id uuid primary key
    references public.organizations (id) on delete cascade,

  -- ── Employee Assistance Programme ──────────────────────────────────
  -- `*_enabled` is separate from "has a phone number" so an organisation can
  -- stage the configuration and still keep the card off a participant's screen
  -- until it is complete and approved.
  eap_enabled boolean not null default false,
  eap_provider_name text check (eap_provider_name is null or length(btrim(eap_provider_name)) between 1 and 120),
  eap_phone text check (eap_phone is null or length(btrim(eap_phone)) between 3 and 60),
  eap_email text check (eap_email is null or eap_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  eap_url text check (eap_url is null or eap_url ~* '^https://'),
  eap_hours text check (eap_hours is null or length(btrim(eap_hours)) between 1 and 200),

  -- ── Occupational Health ────────────────────────────────────────────
  oh_enabled boolean not null default false,
  oh_service_name text check (oh_service_name is null or length(btrim(oh_service_name)) between 1 and 120),
  oh_phone text check (oh_phone is null or length(btrim(oh_phone)) between 3 and 60),
  oh_email text check (oh_email is null or oh_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  oh_url text check (oh_url is null or oh_url ~* '^https://'),
  oh_hours text check (oh_hours is null or length(btrim(oh_hours)) between 1 and 200),

  -- One optional organisation-authored line, screened by
  -- lib/wellbeing/language.ts before it is stored. Not a place for clinical
  -- guidance; a place for "ask for the wellbeing team on reception".
  support_note text check (support_note is null or length(btrim(support_note)) <= 400),

  -- https:// only, so a URL cannot downgrade a participant to plaintext.
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A card that is switched on has to be reachable by at least one route, or
  -- the participant is shown a support panel with nothing in it.
  constraint organization_support_eap_reachable check (
    not eap_enabled or coalesce(eap_phone, eap_email, eap_url) is not null
  ),
  constraint organization_support_oh_reachable check (
    not oh_enabled or coalesce(oh_phone, oh_email, oh_url) is not null
  )
);

create trigger organization_support_settings_updated
  before update on public.organization_support_settings
  for each row execute function public.set_updated_at();

-- ── who may take part in this organisation ───────────────────────────
--
-- Wellbeing participants are deliberately NOT `organization_members` (00023):
-- joining a check-in must not make somebody a member of the organisation's
-- account. They are on the campaign's roster team instead, so that is what
-- membership means here.
--
-- SECURITY DEFINER for the usual reason — a policy that queried `team_members`
-- directly would re-enter that table's own policies.
create or replace function public.takes_part_in_org(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.team_members m
    join public.teams t on t.id = m.team_id
    where m.profile_id = auth.uid()
      and t.organization_id = org
  ) or exists (
    select 1
    from public.wellbeing_sessions s
    join public.wellbeing_campaigns c on c.id = s.campaign_id
    where s.profile_id = auth.uid()
      and c.organization_id = org
  );
$$;

revoke all on function public.takes_part_in_org(uuid) from public;
grant execute on function public.takes_part_in_org(uuid) to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────
--
-- READ is wide on purpose. These are the organisation's own published support
-- contacts; the entire point is that everybody taking part can reach them.
-- Nothing in this row describes a person.
--
-- WRITE is narrow: wellbeing governance in that organisation, its own
-- organisation admins, or platform administration. A team admin running a
-- campaign cannot publish a support number on the organisation's behalf.
alter table public.organization_support_settings enable row level security;

create policy organization_support_read on public.organization_support_settings
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    or public.has_any_wellbeing_role(organization_id)
    or public.takes_part_in_org(organization_id)
    or public.is_super_admin()
  );

create policy organization_support_write on public.organization_support_settings
  for insert to authenticated
  with check (
    public.has_wellbeing_role(organization_id, 'wellbeing_governance')
    or public.is_org_admin(organization_id)
    or public.is_super_admin()
  );

create policy organization_support_update on public.organization_support_settings
  for update to authenticated
  using (
    public.has_wellbeing_role(organization_id, 'wellbeing_governance')
    or public.is_org_admin(organization_id)
    or public.is_super_admin()
  )
  with check (
    public.has_wellbeing_role(organization_id, 'wellbeing_governance')
    or public.is_org_admin(organization_id)
    or public.is_super_admin()
  );

-- No DELETE policy: a support route is switched off, not erased, so the audit
-- trail of what participants were shown stays reconstructable.

do $$ begin
  raise notice 'organization_support_settings installed: EAP/OH routes are organisation configuration, available at every score';
end $$;
