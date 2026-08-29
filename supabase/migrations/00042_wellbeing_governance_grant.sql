-- The Occupational Health facilitator is granted Wellbeing Pulse governance.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHY A MIGRATION RATHER THAN A CODE CHANGE.
--
-- Campaign creation calls `requireWellbeingGovernance()`, which resolves
-- through `has_wellbeing_role()` — a function with deliberately NO
-- `or is_super_admin()` fallback (see 00023). That absence is the privacy
-- boundary for health data: 00019 made `is_team_admin()` true platform-wide
-- for super administrators, and reusing it here would have silently made
-- every platform administrator a reader of every organisation's wellbeing
-- reporting.
--
-- So "You do not hold Wellbeing Pulse governance here" was never a bug in the
-- authorisation code. It was the correct answer to a missing GRANT. The
-- facilitator held `wellbeing_analyst` and not `wellbeing_governance`, and
-- being a super administrator correctly did not help.
--
-- The fix is therefore data, and it belongs in a migration: it is auditable,
-- it is repeatable across environments, and it does not put an identity into
-- application logic. Nothing here weakens RLS, widens a policy, or adds a
-- fallback to `has_wellbeing_role()`.
--
-- WHY THE ACCOUNT IS RESOLVED BY EMAIL AND NOT PINNED BY UUID.
--
-- Profile ids differ between local, preview and production, so a literal uuid
-- would apply cleanly in exactly one database and silently grant nothing —
-- or, worse, grant to whoever happened to hold that id — everywhere else.
-- The email is the stable identifier of the engagement's authorised
-- facilitator. It appears HERE, in a data migration, and NOT in any
-- application code path: no component, action or guard branches on it.
-- ─────────────────────────────────────────────────────────────────────

do $$
declare
  facilitator uuid;
  canonical_org uuid;
begin
  select id into facilitator
  from public.profiles
  where lower(email) = lower('minajjumbo@gmail.com');

  select id into canonical_org
  from public.organizations
  where name = 'REN Africa Energy';

  -- Absent either side, do nothing and say so. A grant that silently targets
  -- nothing is worse than no grant: the facilitator is still blocked and the
  -- migration reports success. Local and preview databases legitimately lack
  -- both rows, so this is a notice rather than an exception.
  if facilitator is null then
    raise notice 'wellbeing governance grant skipped: no profile for the authorised facilitator';
    return;
  end if;

  if canonical_org is null then
    raise notice 'wellbeing governance grant skipped: organisation "REN Africa Energy" not present';
    return;
  end if;

  -- `granted_by` is the facilitator themselves: this grant originates from the
  -- engagement's authorisation, not from another user's action in the product.
  -- The partial unique index (profile, org, role) WHERE revoked_at is null
  -- makes the insert idempotent, so re-running is safe.
  insert into public.wellbeing_role_grants
    (profile_id, organization_id, role, granted_by, note)
  values
    (facilitator, canonical_org, 'wellbeing_governance', facilitator,
     'Occupational Health facilitator for the REN Africa Energy engagement. '
     'Granted by migration 00042 so the authorisation is auditable rather than '
     'implicit in application code.')
  on conflict (profile_id, organization_id, role) where revoked_at is null
  do nothing;

  raise notice 'wellbeing_governance granted on REN Africa Energy (idempotent)';
end $$;
