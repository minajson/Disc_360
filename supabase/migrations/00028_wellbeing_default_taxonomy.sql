-- A NEUTRAL platform-level Department / Function and Office Location floor.
--
-- WHY THIS EXISTS. The lookup is governed per organisation, seeded only by an
-- administrator action. A deployment that had not run that action presented
-- participants with an empty Department / Function dropdown and an unusable
-- form — the field is required and the control is a strict <select>, so the
-- pulse could not be completed at all.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHY THESE VALUES AND NOT A REAL ORGANISATION'S.
--
-- Rows with organization_id = NULL are the platform default, and
-- `can_read_wellbeing_lookup()` returns true for NULL unconditionally — every
-- organisation on the platform sees them. That makes this migration the one
-- place where one customer's structure could become every customer's
-- structure, so nothing customer-specific may be seeded here: no business
-- units, operating units, asset names, site structure or office geography.
--
-- What is seeded is a neutral floor of widely-recognised business functions,
-- plus facility ROLES rather than places for offices. It exists so that a
-- brand-new organisation can run a pulse on day one, and it is meant to be
-- replaced by that organisation's own catalogue — which is created against its
-- own organization_id, where RLS scopes it to that tenant alone.
--
-- An organisation that installs or edits its own catalogue overrides these by
-- name, so nothing here overwrites customisation; it only removes the empty
-- state underneath it.
--
-- Additive: inserts only, and only where the entry is not already present.
-- ─────────────────────────────────────────────────────────────────────

insert into public.wellbeing_departments (organization_id, name, position)
select null, d.name, d.position
from (values
  ('Commercial', 0),
  ('Customer Operations', 1),
  ('Engineering', 2),
  ('Finance', 3),
  ('Health, Safety and Environment', 4),
  ('Human Resources', 5),
  ('Information Technology', 6),
  ('Legal', 7),
  ('Operations', 8),
  ('Procurement', 9),
  ('Sales and Marketing', 10),
  -- Last, and an honest answer rather than a forced mis-selection while an
  -- organisation is still building its own catalogue.
  ('Other', 11)
) as d (name, position)
where not exists (
  select 1 from public.wellbeing_departments w
  where w.organization_id is null and lower(w.name) = lower(d.name)
);

insert into public.wellbeing_office_locations (organization_id, name, position)
select null, l.name, l.position
from (values ('Head Office', 0), ('Regional Office', 1), ('Other', 2)) as l (name, position)
where not exists (
  select 1 from public.wellbeing_office_locations w
  where w.organization_id is null and lower(w.name) = lower(l.name)
);

-- The floor is usable, and it is only a floor.
do $$
declare
  v_departments int;
  v_offices int;
begin
  select count(*) into v_departments from public.wellbeing_departments where organization_id is null;
  select count(*) into v_offices from public.wellbeing_office_locations where organization_id is null;
  if v_departments < 12 then
    raise exception 'Neutral Department / Function floor seeded % entries, expected 12', v_departments;
  end if;
  if v_offices < 3 then
    raise exception 'Neutral office floor seeded % entries, expected 3', v_offices;
  end if;
end;
$$;
