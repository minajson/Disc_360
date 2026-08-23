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

do $$
begin
  -- Refuse to run anywhere that is not a local development database.
  if current_setting('server_version_num')::int > 0
     and coalesce(current_database(), '') <> 'postgres' then
    raise exception 'Refusing to seed smoke content into database %', current_database();
  end if;
  if inet_server_addr() is not null
     and host(inet_server_addr()) not in ('127.0.0.1', '::1', '172.17.0.1') then
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
insert into public.wellbeing_departments (organization_id, name, position)
select o.id, d.name, d.position
from public.organizations o
cross join (
  values ('Production', 0), ('Engineering and Major Project', 1), ('Wells', 2),
         ('Information Technology', 3), ('Legal', 4), ('Finance', 5),
         ('Human Resources', 6), ('Security', 7)
) as d (name, position)
where not exists (
  select 1 from public.wellbeing_departments w
  where w.organization_id = o.id and lower(w.name) = lower(d.name)
);

insert into public.wellbeing_office_locations (organization_id, name, position)
select o.id, l.name, l.position
from public.organizations o
cross join (
  values ('Abuja', 0), ('Lagos', 1), ('Port Harcourt', 2), ('Warri', 3)
) as l (name, position)
where not exists (
  select 1 from public.wellbeing_office_locations w
  where w.organization_id = o.id and lower(w.name) = lower(l.name)
);

commit;

select name, version, content_status, is_active,
       (select count(*) from public.wellbeing_items i where i.version_id = v.id) as items
from public.wellbeing_versions v order by version;
