-- Join resolution as SECURITY DEFINER RPCs.
--
-- The public join flow (QR link, personal invitation, manual team code) must
-- not depend on the service-role key, and anonymous visitors must be able to
-- resolve ONLY the minimum safe context needed to join — never memberships,
-- emails of others, or administrative data. These functions validate token
-- existence, expiry, revocation, team active status and join_enabled inside
-- the database and return a single-row result with an explicit state, so the
-- application can show precise, honest error messages.
--
-- The token (or human team code) IS the authorization: possessing it grants
-- exactly the ability to see the join page and join. resolve_team_code
-- returns the team's invite token for state='ok' only — code and token are
-- credentials of equal power, so this conversion adds no capability.

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
  invited_email text
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
    -- Not a team link — try a personal invitation.
    select i.email, i.status, i.expires_at, i.team_id
      into v_inv
      from public.invitations i
      where i.token = p_token;

    if v_inv.team_id is null then
      return query select 'not_found', null::uuid, null::text, null::text, null::text,
        null::text, null::text, null::timestamptz, null::text, null::text, null::text;
      return;
    end if;
    if v_inv.status = 'revoked' then
      return query select 'revoked', null::uuid, null::text, null::text, null::text,
        null::text, null::text, null::timestamptz, null::text, null::text, null::text;
      return;
    end if;
    if v_inv.status in ('pending', 'expired') and v_inv.expires_at < now() then
      return query select 'expired', null::uuid, null::text, null::text, null::text,
        null::text, null::text, null::timestamptz, null::text, null::text, null::text;
      return;
    end if;

    v_email := v_inv.email;
    select t.* into v_team from public.teams t where t.id = v_inv.team_id;
    if v_team.id is null then
      return query select 'not_found', null::uuid, null::text, null::text, null::text,
        null::text, null::text, null::timestamptz, null::text, null::text, null::text;
      return;
    end if;
  end if;

  if v_team.archived_at is not null then
    return query select 'team_inactive', null::uuid, null::text, null::text, null::text,
      null::text, null::text, null::timestamptz, null::text, null::text, null::text;
    return;
  end if;
  if not v_team.join_enabled then
    return query select 'join_disabled', null::uuid, null::text, null::text, null::text,
      null::text, null::text, null::timestamptz, null::text, null::text, null::text;
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
    v_email;
end;
$$;

create or replace function public.resolve_team_code(p_code text)
returns table (
  state text,
  invite_token uuid,
  team_name text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_norm text := upper(trim(coalesce(p_code, '')));
  v_team public.teams%rowtype;
begin
  if length(v_norm) < 4 or length(v_norm) > 24 then
    return query select 'not_found', null::uuid, null::text;
    return;
  end if;

  -- Codes are stored uppercase; compare case-insensitively anyway so a
  -- hand-typed lowercase code still resolves.
  select t.* into v_team from public.teams t where upper(t.team_code) = v_norm;

  if v_team.id is null then
    return query select 'not_found', null::uuid, null::text;
    return;
  end if;
  if v_team.archived_at is not null then
    return query select 'team_inactive', null::uuid, null::text;
    return;
  end if;
  if not v_team.join_enabled then
    return query select 'join_disabled', null::uuid, null::text;
    return;
  end if;

  return query select 'ok', v_team.invite_token, v_team.name;
end;
$$;

-- Case-insensitive code lookups stay indexed.
create unique index if not exists teams_team_code_upper_idx
  on public.teams (upper(team_code));

-- Narrow execution surface: exactly the join audience, nothing broader.
revoke all on function public.resolve_join_token(uuid) from public;
revoke all on function public.resolve_team_code(text) from public;
grant execute on function public.resolve_join_token(uuid) to anon, authenticated;
grant execute on function public.resolve_team_code(text) to anon, authenticated;
