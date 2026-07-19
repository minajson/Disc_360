-- Facilitator-led sessions: the coach controls which assessment a team runs,
-- when the presentation and assessment are open, and whether participants can
-- review the deck afterwards. Participants read session state through their
-- existing member RLS on teams — no anonymous exposure is added.

create type public.session_mode as enum ('self_paced', 'facilitator_led');
create type public.session_state as enum
  ('draft', 'presentation', 'assessment_open', 'assessment_closed', 'results', 'ended');
create type public.presentation_access as enum
  ('live_only', 'live_and_review', 'review_after_session');

alter table public.teams
  add column session_mode public.session_mode not null default 'facilitator_led',
  add column session_state public.session_state not null default 'draft',
  add column active_slide integer,
  add column presentation_access public.presentation_access not null default 'live_and_review';

-- Optional communications consent captured at onboarding (processing consent
-- already lives in consented_at).
alter table public.profiles
  add column communications_opt_in boolean not null default false;

-- Existing teams keep working exactly as before this feature: participants
-- could join and assess immediately, so any team that already has members
-- opens in assessment_open. New teams start in draft under coach control.
update public.teams t
set session_state = 'assessment_open'
where exists (select 1 from public.team_members m where m.team_id = t.id);

-- resolve_join_token now also returns the participant-safe session summary
-- (which assessment this session runs, and who controls it) so onboarding
-- can present "Today's session" without any broader table access.
drop function public.resolve_join_token(uuid);
create or replace function public.resolve_join_token(p_token uuid)
returns table (
  state text,
  team_id uuid,
  team_name text,
  organization_name text,
  session_name text,
  client_organization text,
  cover_path text,
  deadline_at timestamptz,
  presenter_name text,
  presenter_title text,
  invited_email text,
  assessment_type text,
  session_mode text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_team public.teams%rowtype;
  v_inv record;
  v_email text := null;
begin
  select t.* into v_team from public.teams t where t.invite_token = p_token;

  if v_team.id is null then
    select i.email, i.status, i.expires_at, i.team_id
      into v_inv
      from public.invitations i
      where i.token = p_token;

    if v_inv.team_id is null then
      return query select 'not_found', null::uuid, null::text, null::text, null::text,
        null::text, null::text, null::timestamptz, null::text, null::text, null::text,
        null::text, null::text;
      return;
    end if;
    if v_inv.status = 'revoked' then
      return query select 'revoked', null::uuid, null::text, null::text, null::text,
        null::text, null::text, null::timestamptz, null::text, null::text, null::text,
        null::text, null::text;
      return;
    end if;
    if v_inv.status in ('pending', 'expired') and v_inv.expires_at < now() then
      return query select 'expired', null::uuid, null::text, null::text, null::text,
        null::text, null::text, null::timestamptz, null::text, null::text, null::text,
        null::text, null::text;
      return;
    end if;

    v_email := v_inv.email;
    select t.* into v_team from public.teams t where t.id = v_inv.team_id;
    if v_team.id is null then
      return query select 'not_found', null::uuid, null::text, null::text, null::text,
        null::text, null::text, null::timestamptz, null::text, null::text, null::text,
        null::text, null::text;
      return;
    end if;
  end if;

  if v_team.archived_at is not null then
    return query select 'team_inactive', null::uuid, null::text, null::text, null::text,
      null::text, null::text, null::timestamptz, null::text, null::text, null::text,
      null::text, null::text;
    return;
  end if;
  if not v_team.join_enabled then
    return query select 'join_disabled', null::uuid, null::text, null::text, null::text,
      null::text, null::text, null::timestamptz, null::text, null::text, null::text,
      null::text, null::text;
    return;
  end if;

  return query select
    'ok',
    v_team.id,
    v_team.name,
    (select o.name from public.organizations o where o.id = v_team.organization_id),
    v_team.session_name,
    v_team.client_organization,
    v_team.cover_path,
    v_team.deadline_at,
    (select p.full_name from public.profiles p where p.id = v_team.created_by),
    (select cp.title from public.coach_profiles cp where cp.profile_id = v_team.created_by),
    v_email,
    v_team.assessment_type::text,
    v_team.session_mode::text;
end;
$$;

revoke all on function public.resolve_join_token(uuid) from public;
grant execute on function public.resolve_join_token(uuid) to anon, authenticated;
