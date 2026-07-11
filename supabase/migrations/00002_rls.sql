-- Row Level Security for every table.
-- Principle: individuals own their rows; team/org scope resolves through
-- membership; assessment responses are NEVER readable beyond their owner.
-- Cross-member team reporting (with anonymization) happens exclusively in
-- server actions using the service role after explicit authorization checks.

-- ── helper functions (security definer, stable) ──────────────────────
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_super_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org and profile_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org
      and profile_id = auth.uid()
      and role in ('organization_admin', 'coach')
  );
$$;

create or replace function public.is_team_member(team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members
    where team_id = team and profile_id = auth.uid()
  );
$$;

create or replace function public.is_team_admin(team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members
    where team_id = team and profile_id = auth.uid() and role = 'team_admin'
  )
  or exists (
    select 1
    from public.teams t
    join public.organization_members om on om.organization_id = t.organization_id
    where t.id = team
      and om.profile_id = auth.uid()
      and om.role in ('organization_admin', 'coach')
  );
$$;

-- ── profiles ─────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.is_super_admin());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and is_super_admin = false);

-- ── organizations ────────────────────────────────────────────────────
alter table public.organizations enable row level security;
create policy organizations_select on public.organizations
  for select using (public.is_org_member(id) or public.is_super_admin());
create policy organizations_insert on public.organizations
  for insert with check (created_by = auth.uid());
create policy organizations_update on public.organizations
  for update using (public.is_org_admin(id));

-- ── organization_members ─────────────────────────────────────────────
alter table public.organization_members enable row level security;
create policy org_members_select on public.organization_members
  for select using (
    profile_id = auth.uid()
    or public.is_org_admin(organization_id)
    or public.is_super_admin()
  );
-- bootstrap: a user may add themself while creating the organization;
-- admins manage everyone else
create policy org_members_insert on public.organization_members
  for insert with check (
    (profile_id = auth.uid()
      and exists (
        select 1 from public.organizations o
        where o.id = organization_id and o.created_by = auth.uid()
      ))
    or public.is_org_admin(organization_id)
  );
create policy org_members_update on public.organization_members
  for update using (public.is_org_admin(organization_id));
create policy org_members_delete on public.organization_members
  for delete using (
    profile_id = auth.uid() or public.is_org_admin(organization_id)
  );

-- ── teams ────────────────────────────────────────────────────────────
alter table public.teams enable row level security;
create policy teams_select on public.teams
  for select using (
    public.is_team_member(id)
    or public.is_team_admin(id)
    or public.is_org_member(organization_id)
    or public.is_super_admin()
  );
create policy teams_insert on public.teams
  for insert with check (
    created_by = auth.uid() and public.is_org_member(organization_id)
  );
create policy teams_update on public.teams
  for update using (public.is_team_admin(id));

-- ── team_members ─────────────────────────────────────────────────────
alter table public.team_members enable row level security;
create policy team_members_select on public.team_members
  for select using (
    public.is_team_member(team_id)
    or public.is_team_admin(team_id)
    or public.is_super_admin()
  );
create policy team_members_insert on public.team_members
  for insert with check (public.is_team_admin(team_id));
create policy team_members_update on public.team_members
  for update using (public.is_team_admin(team_id));
create policy team_members_delete on public.team_members
  for delete using (public.is_team_admin(team_id));

-- ── invitations ──────────────────────────────────────────────────────
-- Acceptance-by-token is handled by a service-role server action; the
-- invitee has no row access before joining.
alter table public.invitations enable row level security;
create policy invitations_select on public.invitations
  for select using (public.is_team_admin(team_id));
create policy invitations_insert on public.invitations
  for insert with check (
    public.is_team_admin(team_id) and invited_by = auth.uid()
  );
create policy invitations_update on public.invitations
  for update using (public.is_team_admin(team_id));

-- ── assessment content (readable by any signed-in user) ─────────────
alter table public.assessment_versions enable row level security;
create policy versions_select on public.assessment_versions
  for select using (auth.uid() is not null);

alter table public.questions enable row level security;
create policy questions_select on public.questions
  for select using (auth.uid() is not null);

alter table public.question_options enable row level security;
create policy options_select on public.question_options
  for select using (auth.uid() is not null);

-- ── campaigns ────────────────────────────────────────────────────────
alter table public.assessment_campaigns enable row level security;
create policy campaigns_select on public.assessment_campaigns
  for select using (
    public.is_team_member(team_id) or public.is_team_admin(team_id)
  );
create policy campaigns_insert on public.assessment_campaigns
  for insert with check (
    public.is_team_admin(team_id) and created_by = auth.uid()
  );
create policy campaigns_update on public.assessment_campaigns
  for update using (public.is_team_admin(team_id));

alter table public.campaign_assignments enable row level security;
create policy assignments_select on public.campaign_assignments
  for select using (
    exists (
      select 1 from public.team_members tm
      where tm.id = team_member_id and tm.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.assessment_campaigns c
      where c.id = campaign_id and public.is_team_admin(c.team_id)
    )
  );
create policy assignments_insert on public.campaign_assignments
  for insert with check (
    exists (
      select 1 from public.assessment_campaigns c
      where c.id = campaign_id and public.is_team_admin(c.team_id)
    )
  );
create policy assignments_update on public.campaign_assignments
  for update using (
    exists (
      select 1 from public.team_members tm
      where tm.id = team_member_id and tm.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.assessment_campaigns c
      where c.id = campaign_id and public.is_team_admin(c.team_id)
    )
  );

-- ── assessment flow: strictly own-row ────────────────────────────────
alter table public.assessment_sessions enable row level security;
create policy sessions_all_own on public.assessment_sessions
  for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

alter table public.assessment_responses enable row level security;
create policy responses_all_own on public.assessment_responses
  for all using (
    exists (
      select 1 from public.assessment_sessions s
      where s.id = session_id and s.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.assessment_sessions s
      where s.id = session_id and s.profile_id = auth.uid()
    )
  );

alter table public.assessment_results enable row level security;
create policy results_select_own on public.assessment_results
  for select using (profile_id = auth.uid());
create policy results_insert_own on public.assessment_results
  for insert with check (profile_id = auth.uid());

alter table public.result_insights enable row level security;
create policy result_insights_select_own on public.result_insights
  for select using (
    exists (
      select 1 from public.assessment_results r
      where r.id = result_id and r.profile_id = auth.uid()
    )
  );
create policy result_insights_insert_own on public.result_insights
  for insert with check (
    exists (
      select 1 from public.assessment_results r
      where r.id = result_id and r.profile_id = auth.uid()
    )
  );

-- ── exports / notifications / audit ──────────────────────────────────
alter table public.report_exports enable row level security;
create policy exports_select_own on public.report_exports
  for select using (profile_id = auth.uid());
create policy exports_insert_own on public.report_exports
  for insert with check (profile_id = auth.uid());

alter table public.notification_preferences enable row level security;
create policy notification_prefs_all_own on public.notification_preferences
  for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- logs and audit are written by the service role only; users read their own logs
alter table public.notification_logs enable row level security;
create policy notification_logs_select_own on public.notification_logs
  for select using (profile_id = auth.uid());

alter table public.audit_logs enable row level security;
create policy audit_logs_select_admin on public.audit_logs
  for select using (public.is_super_admin());
