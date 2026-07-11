-- Fix: in the policy subquery, the unqualified `id` bound to invitations.id
-- (the closest relation) instead of teams.id, so invitees never saw the
-- team's name on their invitation card.
drop policy teams_select_invited on public.teams;
create policy teams_select_invited on public.teams
  for select using (
    exists (
      select 1 from public.invitations i
      where i.team_id = teams.id
        and i.email = (auth.jwt() ->> 'email')
        and i.status = 'pending'
    )
  );
