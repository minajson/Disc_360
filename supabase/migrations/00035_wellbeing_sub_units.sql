-- Sub-unit / Team — an ORGANISATIONAL lookup, not an assessment team.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHY THIS IS NOT `public.teams`.
--
-- `teams` is the assessment entity. It carries a session state, a facilitator,
-- an invite token, a presentation mode, a campaign instrument and a product
-- type — everything about RUNNING something. A sub-unit carries none of that:
-- it is a name for a part of the workforce, used to group answers after the
-- fact.
--
-- Reusing `teams` for it would have three consequences, each worse than the
-- last. Every sub-unit would need a token and a session state it has no
-- meaning for. Adding a sub-unit would create something that looks like a
-- campaign to every surface that lists teams. And the participant's context
-- answer would become a foreign key into the campaign model, so renaming or
-- archiving a campaign would silently rewrite what people had already told us
-- about themselves.
--
-- So sub-units live beside Department / Function and Office Location, in the
-- same shape, under the same governance, with the same RLS helper.
--
-- WHAT THIS TABLE DOES NOT DO.
--
-- It grants no access to anything. It is a list of names. A participant's
-- membership of a sub-unit is recorded on their own session and copied onto
-- their own result as a text snapshot — exactly as department already is — so
-- that a later rename never rewrites history, and so that reading this table
-- tells you nothing about any person.
--
-- ADDITIVE AND REVERSIBLE.
--
-- One new table plus two nullable columns on `wellbeing_sessions` and
-- `wellbeing_results`. No existing row is read or written. Rolling back is
-- `drop table public.wellbeing_sub_units cascade;` plus dropping the two
-- column pairs; nothing else depends on them.
-- ─────────────────────────────────────────────────────────────────────

/* ── 1 · the catalogue ───────────────────────────────────────────────── */

create table public.wellbeing_sub_units (
  id uuid primary key default gen_random_uuid(),

  -- Always tenant-owned. Unlike departments and offices there is NO
  -- platform-level default: "Production" is a plausible function anywhere,
  -- but a sub-unit name is always somebody's own org chart, and a shipped
  -- catalogue of them would describe a real customer.
  organization_id uuid not null references public.organizations (id) on delete cascade,

  -- Optional parent. Where set, the participant form narrows the sub-unit
  -- list to the department they chose; where null the sub-unit is offered
  -- under any department, which is correct for cross-functional units.
  department_id uuid references public.wellbeing_departments (id) on delete set null,

  name text not null check (length(btrim(name)) between 1 and 120),

  -- Case- and spacing-insensitive identity, stored rather than computed in
  -- the index so the uniqueness rule is visible in the row itself and the
  -- same normalisation can be applied by the application when matching.
  normalized_name text generated always as (lower(btrim(name))) stored,

  -- Soft disable. A sub-unit that is retired must stop being offered on the
  -- form WITHOUT disappearing from the results that already reference it by
  -- name — deleting it would leave historical answers describing a unit the
  -- catalogue denies ever existed.
  is_active boolean not null default true,

  sort_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

create trigger wellbeing_sub_units_updated before update on public.wellbeing_sub_units
  for each row execute function public.set_updated_at();

-- One name per organisation. Deliberately NOT per (organisation, department):
-- two departments each owning a "Support" sub-unit would produce two
-- identical options on one form with no way for a participant to tell them
-- apart, and two indistinguishable cohorts in the analytics afterwards.
create unique index wellbeing_sub_units_org_name_uniq
  on public.wellbeing_sub_units (organization_id, normalized_name);

create index wellbeing_sub_units_org_idx
  on public.wellbeing_sub_units (organization_id, sort_order, name)
  where is_active;
create index wellbeing_sub_units_department_idx
  on public.wellbeing_sub_units (department_id)
  where department_id is not null;

comment on table public.wellbeing_sub_units is
  'Organisational Sub-unit / Team names for the Wellbeing participant context form. Metadata only — grants no access to any result, and is never an assessment team.';

/* ── 2 · a participant's answer, recorded like every other context ───── */
--
-- Both an id and a text snapshot, matching department and office exactly. The
-- id is the live link; the snapshot is what the result is reported under
-- forever, so renaming a sub-unit next year does not silently restate what
-- somebody said about themselves last year.

alter table public.wellbeing_sessions
  add column sub_unit_id uuid references public.wellbeing_sub_units (id) on delete set null,
  add column sub_unit_name text;

alter table public.wellbeing_results
  add column sub_unit_at_completion text;

create index wellbeing_sessions_sub_unit_idx on public.wellbeing_sessions (sub_unit_id);
-- The cohort lookup path, mirroring the department one.
create index wellbeing_results_sub_unit_idx
  on public.wellbeing_results (organization_id, instrument_key, sub_unit_at_completion);

comment on column public.wellbeing_results.sub_unit_at_completion is
  'The Sub-unit / Team the participant reported at completion. A snapshot — a later rename never rewrites it.';

/* ── 3 · RLS ─────────────────────────────────────────────────────────── */
--
-- Identical to Department / Function, and for the same reasons:
--
--  · READ follows `can_read_wellbeing_lookup` — anybody who might legitimately
--    fill in this form for this organisation. It is a list of names; refusing
--    it to a participant would leave them unable to answer.
--  · WRITE is wellbeing GOVERNANCE only. Adding to the catalogue changes what
--    every future participant can say about themselves and therefore what the
--    analytics can group by, which is a governance act.
--  · There is no DELETE policy. Retiring is `is_active = false`; removing the
--    row would orphan the results that name it.

alter table public.wellbeing_sub_units enable row level security;

create policy wellbeing_sub_units_select on public.wellbeing_sub_units
  for select to authenticated
  using (public.can_read_wellbeing_lookup(organization_id));

create policy wellbeing_sub_units_insert on public.wellbeing_sub_units
  for insert to authenticated
  with check (public.has_wellbeing_role(organization_id, 'wellbeing_governance'));

create policy wellbeing_sub_units_update on public.wellbeing_sub_units
  for update to authenticated
  using (public.has_wellbeing_role(organization_id, 'wellbeing_governance'))
  with check (public.has_wellbeing_role(organization_id, 'wellbeing_governance'));

/* ── 4 · the department a sub-unit hangs from must be its own tenant's ── */
--
-- A cross-tenant parent would let one organisation's form narrow by another
-- organisation's department. Enforced rather than trusted, because the parent
-- is chosen by a governance user through an ordinary UPDATE.

create or replace function public.wellbeing_sub_unit_parent_is_same_tenant()
returns trigger language plpgsql as $$
declare
  v_parent_org uuid;
begin
  if new.department_id is null then return new; end if;
  select organization_id into v_parent_org
  from public.wellbeing_departments where id = new.department_id;
  -- A platform-level department (organization_id null) is shared by every
  -- tenant and is a legitimate parent for any of them.
  if v_parent_org is not null and v_parent_org <> new.organization_id then
    raise exception
      'A sub-unit cannot hang from another organisation''s Department / Function';
  end if;
  return new;
end;
$$;

create trigger wellbeing_sub_units_parent_tenant
  before insert or update of department_id, organization_id on public.wellbeing_sub_units
  for each row execute function public.wellbeing_sub_unit_parent_is_same_tenant();
