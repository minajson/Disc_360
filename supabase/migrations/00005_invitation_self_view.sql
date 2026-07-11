-- Invitees may see (only) their own pending invitations, so the app can
-- surface "you've been invited" without exposing team administration data.
create policy invitations_select_own_email on public.invitations
  for select using (
    email = (auth.jwt() ->> 'email')
  );

-- Invitee needs the team's name to render the invitation card.
create policy teams_select_invited on public.teams
  for select using (
    exists (
      select 1 from public.invitations i
      where i.team_id = id
        and i.email = (auth.jwt() ->> 'email')
        and i.status = 'pending'
    )
  );
