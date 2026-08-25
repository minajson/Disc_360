-- Default Department / Function and Office Location catalogue, at platform level.
--
-- WHY THIS EXISTS. The lookup was governed per organisation, seeded only by an
-- administrator action. A deployment that had not run that action presented
-- participants with an empty Department / Function dropdown and an unusable
-- form — the field is required, so the pulse could not be completed at all.
--
-- These rows carry organization_id = NULL, which the reader already treats as
-- the platform default alongside an organisation's own entries. An
-- organisation that installs or edits its own catalogue still overrides these
-- by name, so nothing here overwrites customisation; it only removes the empty
-- state underneath it.
--
-- Additive: inserts only, and only where the entry is not already present.

insert into public.wellbeing_departments (organization_id, name, position)
select null, d.name, d.position
from (values
  ('Business and Government Relations', 0),
  ('Commercial', 1),
  ('Contract and Procurement', 2),
  ('Country Chair Organization', 3),
  ('Development', 4),
  ('Engineering and Major Project', 5),
  ('Exploration', 6),
  ('External Relations', 7),
  ('Finance', 8),
  ('Geo Solutions', 9),
  ('Human Resources', 10),
  ('Information Technology', 11),
  ('Integrated Gas', 12),
  ('Legal', 13),
  ('Logistics', 14),
  ('Nigeria Real Estate', 15),
  ('Ogoni Restoration Team', 16),
  ('Pipelines', 17),
  ('Production', 18),
  ('PT Development Nigeria', 19),
  ('Renaissance Health', 20),
  ('Safety Environment', 21),
  ('Security', 22),
  ('Shell Nigeria Gas', 23),
  ('Transformation Team', 24),
  ('Wells', 25)
) as d (name, position)
where not exists (
  select 1 from public.wellbeing_departments w
  where w.organization_id is null and lower(w.name) = lower(d.name)
);

insert into public.wellbeing_office_locations (organization_id, name, position)
select null, l.name, l.position
from (values ('Abuja', 0), ('Lagos', 1), ('Port Harcourt', 2), ('Warri', 3)) as l (name, position)
where not exists (
  select 1 from public.wellbeing_office_locations w
  where w.organization_id is null and lower(w.name) = lower(l.name)
);

do $$
declare
  v_departments int;
  v_offices int;
begin
  select count(*) into v_departments from public.wellbeing_departments where organization_id is null;
  select count(*) into v_offices from public.wellbeing_office_locations where organization_id is null;
  if v_departments < 26 then
    raise exception 'Default Department / Function catalogue seeded % entries, expected 26', v_departments;
  end if;
  if v_offices < 4 then
    raise exception 'Default office catalogue seeded % entries, expected 4', v_offices;
  end if;
end;
$$;
