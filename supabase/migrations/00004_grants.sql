-- Table-level privileges. Row access is governed entirely by RLS; grants
-- expose tables to the API roles. anon gets no table access — every product
-- query runs as an authenticated user or the service role.

grant usage on schema public to authenticated, service_role, anon;

grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;

grant execute on all functions in schema public
  to authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;

alter default privileges in schema public
  grant execute on functions to authenticated, service_role;
