-- Wellbeing campaign invariants — adversarial harness.
--
-- Runs inside one transaction that is ROLLED BACK, so it leaves nothing behind.
--
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f scripts/verify-wellbeing-campaigns.sql
--
-- Never point this at a hosted database. It writes (and rolls back) rows.
\set ON_ERROR_STOP on

do $$
begin
  if not (inet_server_addr() is null
          or inet_server_addr() <<= inet '127.0.0.0/8'
          or inet_server_addr() <<= inet '10.0.0.0/8'
          or inet_server_addr() <<= inet '172.16.0.0/12'
          or inet_server_addr() <<= inet '192.168.0.0/16') then
    raise exception 'Refusing to run the campaign harness against non-local host %',
      inet_server_addr();
  end if;
end $$;

begin;

create temporary table harness(n int, name text, ok boolean) on commit drop;
create or replace function pg_temp.check(n int, name text, ok boolean) returns void
language plpgsql as $$ begin insert into harness values (n, name, ok); end $$;

do $$
declare
  org uuid; gov uuid; p1 uuid; p2 uuid;
  disc_v uuid; who_v uuid;
  camp uuid; tok text := 'harness_' || replace(gen_random_uuid()::text,'-','');
  admits boolean; froze boolean := false; n int;
begin
  -- Profiles are created by trigger from auth.users, exactly as the privacy
  -- harness does it, so the fixture exercises the real row shape.
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
    'authenticated', 'campaign-gov@harness.invalid', 'NO-LOGIN', now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
  returning id into gov;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
    'authenticated', 'campaign-p1@harness.invalid', 'NO-LOGIN', now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
  returning id into p1;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
    'authenticated', 'campaign-p2@harness.invalid', 'NO-LOGIN', now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
  returning id into p2;

  insert into public.organizations (name, created_by)
  values ('Harness Org', gov) returning id into org;

  select id into disc_v from public.wellbeing_versions where questionnaire_code='disc360_wellbeing_v1';
  select id into who_v  from public.wellbeing_versions where questionnaire_code='who5';

  -- 1 · a campaign pins instrument AND version
  insert into public.wellbeing_campaigns
    (organization_id, instrument_key, version_id, created_by, name, join_token, participant_capacity)
  values (org,'disc360_wellbeing_v1',disc_v,gov,'Harness Campaign',left(tok,40),1)
  returning id into camp;
  perform pg_temp.check(1,'a campaign pins an instrument and a version', camp is not null);

  -- 2 · a version from a DIFFERENT instrument is refused by the composite FK
  begin
    insert into public.wellbeing_campaigns
      (organization_id, instrument_key, version_id, created_by, name, join_token)
    values (org,'disc360_wellbeing_v1',who_v,gov,'Mismatched',left(tok,39)||'z');
    perform pg_temp.check(2,'a version belonging to another instrument is refused', false);
  exception when foreign_key_violation then
    perform pg_temp.check(2,'a version belonging to another instrument is refused', true);
  end;

  -- 3 · the token resolves, and exposes no capacity or participant data
  perform pg_temp.check(3,'the join token resolves to its campaign',
    (select campaign_id from public.wellbeing_campaign_by_token(left(tok,40))) = camp);

  -- 4 · an unknown token resolves to nothing
  perform pg_temp.check(4,'an unknown token resolves to nothing',
    not exists (select 1 from public.wellbeing_campaign_by_token('no_such_token_'||left(tok,20))));

  -- 5 · capacity admits the first participant
  perform pg_temp.check(5,'capacity admits the first participant',
    public.wellbeing_campaign_admits(camp,p1));

  insert into public.wellbeing_sessions
    (profile_id, version_id, instrument_key, campaign_id, organization_id)
  values (p1, disc_v, 'disc360_wellbeing_v1', camp, org);

  -- 6 · capacity of 1 refuses a SECOND distinct participant
  perform pg_temp.check(6,'a full campaign refuses another distinct participant',
    public.wellbeing_campaign_admits(camp,p2) = false);

  -- 7 · the SAME participant is still admitted — a retake takes no new place
  perform pg_temp.check(7,'a retake does not consume another participant place',
    public.wellbeing_campaign_admits(camp,p1));

  -- 8 · the version is frozen now that somebody has answered
  begin
    update public.wellbeing_campaigns set version_id = who_v, instrument_key='who5' where id = camp;
  exception when check_violation then froze := true;
  end;
  perform pg_temp.check(8,'the questionnaire version freezes on the first session', froze);

  -- 9 · a closed campaign admits nobody
  update public.wellbeing_campaigns set status='closed', closed_at=now() where id=camp;
  perform pg_temp.check(9,'a closed campaign admits nobody',
    public.wellbeing_campaign_admits(camp,p2) = false);

  -- 10 · an expired campaign admits nobody
  update public.wellbeing_campaigns set status='active', closed_at=null,
         expires_at = now() - interval '1 hour' where id=camp;
  perform pg_temp.check(10,'an expired campaign admits nobody',
    public.wellbeing_campaign_admits(camp,p2) = false);

  -- 11 · RLS is enabled, and there is no DELETE policy
  perform pg_temp.check(11,'row level security is enabled on campaigns',
    (select relrowsecurity from pg_class where oid='public.wellbeing_campaigns'::regclass));
  select count(*) into n from pg_policies
   where schemaname='public' and tablename='wellbeing_campaigns' and cmd='DELETE';
  perform pg_temp.check(12,'campaigns can never be deleted through RLS', n = 0);

  -- 13 · writing requires governance, not merely a wellbeing role
  select count(*) into n from pg_policies
   where schemaname='public' and tablename='wellbeing_campaigns'
     and cmd in ('INSERT','UPDATE')
     -- INSERT policies carry no `qual`, only `with_check`; coalesce both or
     -- the concatenation is NULL and the count silently misses them.
     and coalesce(qual,'') || coalesce(with_check,'') like '%wellbeing_governance%';
  perform pg_temp.check(13,'insert and update both demand governance', n = 2);

  -- 14 · no policy on campaigns grants a super administrator anything
  select count(*) into n from pg_policies
   where schemaname='public' and tablename='wellbeing_campaigns'
     and coalesce(qual,'') || coalesce(with_check,'') like '%is_super_admin%';
  perform pg_temp.check(14,'no super-admin fallback reaches campaigns', n = 0);

  -- 15 · individual wellbeing rows stay owner-only
  select count(*) into n from pg_policies
   -- The session policy is declared FOR ALL, which covers SELECT; matching on
   -- cmd='SELECT' alone finds nothing and would read as a missing policy.
   where schemaname='public' and tablename='wellbeing_sessions'
     and cmd in ('SELECT','ALL')
     and qual like '%profile_id = auth.uid()%';
  perform pg_temp.check(15,'a participant session is readable only by its owner', n > 0);
end $$;

select n as "#", case when ok then 'PASS' else 'FAIL' end as result, name from harness order by n;
select count(*) filter (where ok) as passed,
       count(*) filter (where not ok) as failed,
       count(*) as total from harness;
select case when count(*) filter (where not ok) = 0
            then 'ALL CAMPAIGN CHECKS PASSED'
            else 'CAMPAIGN HARNESS FAILED' end as verdict from harness;

rollback;
