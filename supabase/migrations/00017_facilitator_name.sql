-- The displayed facilitator can differ from the signed-in account (the coach
-- may project from someone else's laptop, or an external facilitator runs
-- the room). A simple per-team display name; when set it overrides the
-- derived presenter identity everywhere the invitation is summarised.

alter table public.teams
  add column facilitator_name text;

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
    -- Explicit facilitator name wins; the creator's identity is the fallback.
    coalesce(
      nullif(trim(v_team.facilitator_name), ''),
      (select p.full_name from public.profiles p where p.id = v_team.created_by)
    ),
    -- The coach title belongs to the creator only when no override is set.
    case
      when nullif(trim(v_team.facilitator_name), '') is null then
        (select cp.title from public.coach_profiles cp where cp.profile_id = v_team.created_by)
      else null
    end,
    v_email,
    v_team.assessment_type::text,
    v_team.session_mode::text;
end;
$$;

revoke all on function public.resolve_join_token(uuid) from public;
grant execute on function public.resolve_join_token(uuid) to anon, authenticated;
