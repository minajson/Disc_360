-- Platform administrator: facilitator parity on every team, plus the second
-- bootstrap administrator.
--
-- Two things happen here, and both go through the RBAC that already exists
-- rather than adding a new privilege concept:
--
--  1. njntia@gmail.com joins the super-admin allowlist introduced in
--     00012_super_admin_bootstrap.sql. Nothing is hard-coded in application
--     code — the address lives in one table row, promotion still requires a
--     confirmed mailbox, and the "signs up later" case is already covered by
--     the zz_bootstrap_super_admin trigger on auth.users.
--
--  2. is_team_admin() now recognises platform administrators. Before this, a
--     super admin could see that a team existed (teams_select already carried
--     `or public.is_super_admin()`) but could not open the facilitator
--     dashboard, roster, campaigns or presentation for a team they did not
--     create — every one of those paths gates on is_team_admin(). Rather than
--     scattering `or is_super_admin()` across a dozen policies and every
--     server guard, the platform scope is expressed once, in the function
--     that already answers "may this person administer this team?".
--
-- SECURITY — what this deliberately does NOT open:
--   · assessment_responses stays strictly own-row (responses_all_own). Raw
--     answers remain unreadable by anyone but their author, platform admins
--     included. CLAUDE.md's rule is unchanged.
--   · assessment_results stays strictly own-row (results_select_own). Every
--     cross-member report still goes through the service role after an
--     explicit authorization check, and anonymization still happens in
--     lib/insights before anything reaches a page.
--   · Nothing here grants a login, a credential, or an unauthenticated path.
--
-- What it does open is exactly the facilitator surface: teams, team_members,
-- invitations, campaigns and campaign_assignments for any team — which is the
-- stated product requirement (a platform admin supports any facilitator's
-- session) and is already audit-logged for admin-area mutations.

-- ── 1 · second bootstrap administrator ───────────────────────────────

insert into public.super_admin_bootstrap (email, note)
values ('njntia@gmail.com', 'Platform administrator')
on conflict (email) do nothing;

-- Promotes now if the account already exists and is confirmed; a no-op
-- otherwise, because zz_bootstrap_super_admin handles the later signup.
select public.apply_super_admin_bootstrap();

-- ── 2 · platform administrators administer every team ────────────────

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
  )
  -- Platform scope. Kept last so the common membership paths short-circuit
  -- before this extra profiles lookup runs.
  or public.is_super_admin();
$$;

-- Team membership reads for platform admins. teams_select and
-- team_members_select already carried `or public.is_super_admin()`;
-- assessment_campaigns did not, so a platform admin opening a facilitator
-- dashboard saw an empty campaign list instead of the session.
drop policy if exists campaigns_select on public.assessment_campaigns;
create policy campaigns_select on public.assessment_campaigns
  for select using (
    public.is_team_member(team_id)
    or public.is_team_admin(team_id)
  );

-- ── 3 · indexes for the analytics surfaces ───────────────────────────
--
-- Executive analytics reads results by team over time, and the comparison
-- workspace filters a roster by department. Both are lookup paths now, so
-- both get an index (project rule: index every FK and lookup path).

create index if not exists assessment_results_team_created_idx
  on public.assessment_results (team_id, created_at desc);

create index if not exists focus_results_team_created_idx
  on public.focus_results (team_id, created_at desc);

create index if not exists team_members_department_idx
  on public.team_members (team_id, department);

create index if not exists teams_created_by_idx
  on public.teams (created_by);
