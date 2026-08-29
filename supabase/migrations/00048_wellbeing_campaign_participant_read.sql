-- A participant may read the campaign they are taking part in.
--
-- ─────────────────────────────────────────────────────────────────────
-- THE DEFECT THIS FIXES.
--
-- 00044 gave `wellbeing_campaigns` one SELECT policy:
--
--   using (public.has_any_wellbeing_role(organization_id))
--
-- That was correct while the table was read only by facilitators — reading a
-- campaign was an organisational act, and the comment said so. It stopped
-- being correct the moment the PARTICIPANT journey started resolving through
-- the campaign, because an ordinary participant holds no wellbeing role
-- anywhere. `getMyWellbeingCampaigns` reads through the participant's own
-- RLS-scoped client, so it returned an empty list for every real participant,
-- the landing page could not name their questionnaire, and the check-in
-- offered no way to start.
--
-- It went unnoticed in the wellbeing suites because their participants happen
-- to hold analyst grants in the demo organisation. It surfaced only when a
-- fixture built its campaign in a DIFFERENT organisation — where the same
-- account had no grant — which is exactly the shape a real deployment has.
--
-- WHY A POLICY RATHER THAN THE SERVICE ROLE.
--
-- The alternative was to read the campaign with the admin client and filter by
-- the participant's own memberships. That works, and it makes the participant
-- journey depend on the service-role key for something a participant is
-- plainly entitled to see: the name and questionnaire of a campaign they are
-- already on the roster of. The DISC join route deliberately avoids that
-- dependency, and this route should too.
--
-- So the rule is stated as what it actually is — membership — and the database
-- enforces it.
--
-- WHAT THIS DOES NOT OPEN.
--
--  · Only SELECT. Insert and update remain governance-only, unchanged.
--  · Only campaigns whose ROSTER this participant is on. A campaign they have
--    not joined stays invisible, so this is not a way to enumerate an
--    organisation's campaigns.
--  · No result, response, score or other participant becomes readable. This
--    table holds none of those.
--
-- The row does contain `join_token`, and a member can now read their own
-- campaign's. That is the credential they already hold — it is how they got
-- onto the roster in the first place — so this discloses nothing they did not
-- arrive with, and it remains unreadable for any campaign they have not
-- joined.
-- ─────────────────────────────────────────────────────────────────────

create policy wellbeing_campaigns_read_own_membership on public.wellbeing_campaigns
  for select to authenticated
  using (
    exists (
      select 1
        from public.team_members m
       where m.team_id = wellbeing_campaigns.team_id
         and m.profile_id = auth.uid()
    )
  );

comment on policy wellbeing_campaigns_read_own_membership on public.wellbeing_campaigns is
  'A participant on a campaign''s roster may read that campaign. Facilitator '
  'access remains role-scoped via wellbeing_campaigns_read_with_role; writes '
  'remain governance-only.';

do $$ begin
  raise notice 'participants can now read the campaigns they belong to (select only, roster-scoped)';
end $$;
