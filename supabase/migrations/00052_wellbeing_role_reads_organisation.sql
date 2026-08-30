-- ─────────────────────────────────────────────────────────────────────
-- A wellbeing role can read the NAME of the organisation it governs.
--
-- WHAT WAS BROKEN.
--
-- `organizations` is readable by its own members (`is_org_member`) and by
-- platform administration. A wellbeing role is deliberately NOT organisation
-- membership — 00023 kept them apart so that granting somebody aggregate
-- reporting does not make them a member of the customer's account — and the
-- consequence had never been followed through: every screen that embedded
-- `organizations (name)` through a wellbeing role holder's own client got NULL
-- and fell back to the literal word "Organisation".
--
-- So the campaign-creation form offered a dropdown reading
--
--     Organisation
--     Organisation
--
-- and a facilitator holding roles in two organisations could not tell which
-- one they were about to create a campaign in. Analytics headed its figures
-- "Organisation" too.
--
-- WHY THIS IS THE RIGHT FIX AND NOT A WIDENING.
--
-- The organisation's own name is already shown to an UNAUTHENTICATED scanner
-- by `wellbeing_campaign_by_token`, which is security definer and returns it
-- so somebody can tell whose check-in they are being asked to take. A name is
-- not confidential to the people running that organisation's wellbeing
-- programme. This policy grants exactly SELECT, exactly to a role held in that
-- organisation, and grants nothing else about it.
-- ─────────────────────────────────────────────────────────────────────

create policy organizations_read_with_wellbeing_role on public.organizations
  for select to authenticated
  using (public.has_any_wellbeing_role(id));

do $$ begin
  raise notice 'wellbeing role holders can now read their organisation''s name';
end $$;
