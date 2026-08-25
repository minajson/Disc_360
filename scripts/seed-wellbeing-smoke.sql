-- Wellbeing Pulse — LOCAL SMOKE-TEST CONTENT. Never for a hosted database.
--
-- ─────────────────────────────────────────────────────────────────────
-- THIS IS NOT GHQ-12, AND IT IS NOT A REWRITE OF GHQ-12.
--
-- The items below are deliberately CONTENT-FREE. They are numbered
-- placeholders — "Smoke test item 1" with options "Option A…D" — chosen so
-- that they neither reproduce the GHQ-12 wording nor paraphrase its themes,
-- and so that nobody can mistake them for a wellbeing questionnaire.
--
-- An earlier draft of this file used plausible wellbeing-sounding prompts.
-- That was wrong: tracking the instrument's themes in its published order is
-- a rewrite of copyrighted items in all but name, and the build brief rules it
-- out explicitly. The scoring engine only ever sees response POSITIONS, so
-- placeholder text exercises the machinery exactly as well.
--
-- What this file is for: proving the participant flow, the scoring engine, the
-- history model and the analytics work end to end BEFORE GHQ-12
-- electronic-use rights are evidenced.
--
-- This is not a migration. It is never applied by `supabase db reset` and must
-- never be copied into supabase/migrations/.
--
-- Run:
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--     -f scripts/seed-wellbeing-smoke.sql
--
-- Undo: `npx supabase db reset`.
-- ─────────────────────────────────────────────────────────────────────

-- Abort on the FIRST error. Without this the local-host guard below is
-- decorative: `raise exception` inside a DO block ends that block, psql
-- reports it and then carries straight on to the next statement — so a script
-- that "refuses to run" against the wrong database would seed it anyway.
-- ─────────────────────────────────────────────────────────────────────
-- ⚠ THIS SCRIPT DOES NOT CURRENTLY RUN. It needs a decision, not a patch.
--
-- Migration 00025 (four-instrument registry) replaced the unique constraint
-- on wellbeing_versions.version with a unique on (instrument_key, version),
-- and made instrument_key NOT NULL with no default. The version insert below
-- therefore fails twice over: its `on conflict (version)` names a constraint
-- that no longer exists, and it supplies no instrument_key.
--
-- It cannot simply be given one. instrument_key is a foreign key into
-- wellbeing_instruments, so the only candidates are the four real
-- instruments, and every choice is wrong:
--
--   ghq12 / ghq28 / who5 — would publish an ACTIVE third-party version
--     carrying item prompts, which is precisely what the licensing gate and
--     privacy checks 27 and 30 exist to prevent.
--   disc360_wellbeing_v1 — collides with the real active version under
--     wellbeing_versions_one_active_per_instrument, and would substitute
--     placeholder text for shipped licensed content.
--
-- The honest options are to register a fifth, explicitly non-clinical
-- "smoke_test" instrument, or to retire this script. Note that the wellbeing
-- e2e suite passes 24/24 without it: DISC360 Wellbeing V1 is real runnable
-- content, which is the gap this script was written to fill.
--
-- Until that is decided the script aborts on its first error rather than
-- half-seeding, which is what it used to do silently.
-- ─────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

do $$
begin
  -- Refuse to run anywhere that is not a local development database.
  if current_setting('server_version_num')::int > 0
     and coalesce(current_database(), '') <> 'postgres' then
    raise exception 'Refusing to seed smoke content into database %', current_database();
  end if;
  -- Loopback, or a private (RFC1918 / Docker) address. A hosted Supabase
  -- instance is on neither, so this refuses anything reachable from outside.
  if inet_server_addr() is not null
     and not (inet_server_addr() <<= inet '127.0.0.0/8'
           or inet_server_addr() <<= inet '10.0.0.0/8'
           or inet_server_addr() <<= inet '172.16.0.0/12'
           or inet_server_addr() <<= inet '192.168.0.0/16') then
    raise exception 'Refusing to seed smoke content into a non-local host %', inet_server_addr();
  end if;
end;
$$;

begin;

insert into public.wellbeing_versions
  (id, name, version, questionnaire_code, content_status, item_count, is_active, licence_note)
values (
  '00000000-0000-4000-8000-00000000e999'::uuid,
  'SMOKE TEST — not GHQ-12',
  999,
  'smoke_test',
  'licensed',
  12,
  true,
  'LOCAL SMOKE-TEST CONTENT. Generic placeholder items written for this repository. '
  || 'NOT the GHQ-12 instrument and carries no GHQ wording. Never for production use.'
)
on conflict (version) do nothing;

-- Twelve numbered placeholders, in a fixed order. No wellbeing content.
insert into public.wellbeing_items (version_id, external_id, position, prompt)
select '00000000-0000-4000-8000-00000000e999',
       'item_' || lpad(n::text, 2, '0'),
       n - 1,
       'Smoke test item ' || n || ' — placeholder prompt, not a questionnaire item'
from generate_series(1, 12) as n
on conflict (version_id, external_id) do nothing;

-- Four response positions per item, carrying the real 0-0-1-1 / 0-1-2-3 weights.
insert into public.wellbeing_item_options (item_id, position, label, bimodal_score, likert_score)
select i.id, weights.position, weights.label, weights.bimodal, weights.likert
from public.wellbeing_items i
cross join (
  values
    (0, 'Option A (position 1)', 0::smallint, 0::smallint),
    (1, 'Option B (position 2)', 0::smallint, 1::smallint),
    (2, 'Option C (position 3)', 1::smallint, 2::smallint),
    (3, 'Option D (position 4)', 1::smallint, 3::smallint)
) as weights (position, label, bimodal, likert)
where i.version_id = '00000000-0000-4000-8000-00000000e999'
on conflict (item_id, position) do nothing;

-- Only one version may be active; retire any other.
update public.wellbeing_versions
set is_active = false
where version <> 999 and is_active;

-- Department / Function and Office Location for every local organisation.
--
-- Organisation-scoped (o.id), never platform-level, and drawn from the neutral
-- catalogue: a local seed must not put one customer's structure in front of
-- every tenant either.
insert into public.wellbeing_departments (organization_id, name, position)
select o.id, d.name, d.position
from public.organizations o
cross join (
  values ('Operations', 0), ('Engineering', 1), ('Commercial', 2),
         ('Information Technology', 3), ('Legal', 4), ('Finance', 5),
         ('Human Resources', 6), ('Procurement', 7)
) as d (name, position)
where not exists (
  select 1 from public.wellbeing_departments w
  where w.organization_id = o.id and lower(w.name) = lower(d.name)
);

insert into public.wellbeing_office_locations (organization_id, name, position)
select o.id, l.name, l.position
from public.organizations o
cross join (
  values ('Head Office', 0), ('Regional Office', 1), ('Other', 2)
) as l (name, position)
where not exists (
  select 1 from public.wellbeing_office_locations w
  where w.organization_id = o.id and lower(w.name) = lower(l.name)
);

commit;

select name, version, content_status, is_active,
       (select count(*) from public.wellbeing_items i where i.version_id = v.id) as items
from public.wellbeing_versions v order by version;
