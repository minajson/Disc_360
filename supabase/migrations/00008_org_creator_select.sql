-- Creators must be able to read the organization row they just inserted
-- (insert ... returning runs under SELECT policies, and membership is only
-- attached afterwards).
create policy organizations_select_own on public.organizations
  for select using (created_by = auth.uid());
