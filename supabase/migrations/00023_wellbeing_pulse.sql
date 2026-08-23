-- Wellbeing Pulse — GHQ-12 screening as a third, strictly independent
-- instrument.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT THIS MIGRATION DOES NOT DO — the important part.
--
--   · It does not modify DISC or Focus. No existing table is altered except
--     to ADD two enum values (assessment_type += 'wellbeing', export_kind +=
--     'wellbeing_report') and one nullable column on report_exports. No
--     existing column, constraint, index, policy or function is dropped or
--     redefined.
--   · It does not UPDATE or DELETE a single pre-existing row.
--   · It does not touch scoring. No DISC or Focus score, archetype, snapshot,
--     attempt_number or scoring_version is read for writing anywhere here.
--   · It creates NO path by which a wellbeing score can meet a DISC or Focus
--     score. There is no shared table, no join column between the result
--     tables beyond profile_id, and no view that combines them.
--   · It grants NO ONE the ability to read another person's wellbeing result.
--     Not a team admin, not an organization admin, not a coach, and NOT a
--     platform super admin. See §9.
--
-- LICENSING — read before adding item text.
--
-- GHQ-12 item and response wording is copyright Goldberg & Williams and is
-- licensed commercially. No verbatim text is seeded here. What is seeded is
-- the STRUCTURE — twelve items, four ordered response positions each, and the
-- weight every position carries — which is what the scoring engine, the
-- threshold model, the history model and the analytics are built on.
--
-- `wellbeing_versions.content_status` starts at 'structure_only', and a CHECK
-- constraint forbids activating such a version. Licensed wording arrives as a
-- later content migration that fills the prompts and labels and flips the
-- status; nothing else in this schema changes when it does.
--
-- POPULATION VALIDITY. The default threshold of 4 implements the widely-used
-- 3/4 cut-off, but GHQ-12 cut-offs vary materially by population, setting and
-- language. `threshold_at_completion` is stamped on every result precisely so
-- that a later, locally-validated threshold does not retroactively re-read
-- historical rows. Reviewing the cut-off for the intended workforce is a
-- governance action, not a code change.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1 · enums ────────────────────────────────────────────────────────

-- 'structure_only' — item slots and weights exist, licensed wording does not.
-- 'licensed'       — wording is present and its use is evidenced.
-- 'retired'        — superseded; historical results still resolve against it.
create type public.wellbeing_content_status as enum
  ('structure_only', 'licensed', 'retired');

create type public.wellbeing_work_location as enum ('field_based', 'office_based');

-- Wellbeing access is its own privilege family. NEITHER value is implied by
-- team_admin, organization_admin, coach or is_super_admin — see §9.
create type public.wellbeing_access_role as enum
  ('wellbeing_governance', 'wellbeing_analyst');

-- Delivery lifecycle for an opt-in personal report. 'requested' exists so a
-- send that never dispatched cannot be mistaken for one that did.
create type public.wellbeing_delivery_status as enum
  ('requested', 'sent', 'failed', 'not_delivered');

-- Additive only. Existing values and every row using them are untouched.
alter type public.assessment_type add value if not exists 'wellbeing';
alter type public.export_kind add value if not exists 'wellbeing_report';

-- ── 2 · questionnaire content ────────────────────────────────────────

create table public.wellbeing_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version int not null unique,
  -- Which instrument this version implements, for the record.
  questionnaire_code text not null default 'ghq12',
  content_status public.wellbeing_content_status not null default 'structure_only',
  item_count int not null default 12 check (item_count = 12),
  -- Licence evidence, recorded where the content lives rather than in a doc
  -- that can drift away from the deployment it describes.
  licence_holder text,
  licence_reference text,
  licence_granted_at date,
  licence_expires_at date,
  licence_note text not null default '',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Unlicensed wording can never be put in front of a participant.
  constraint wellbeing_versions_active_requires_licence
    check (is_active = false or content_status = 'licensed')
);
create trigger wellbeing_versions_updated before update on public.wellbeing_versions
  for each row execute function public.set_updated_at();
create unique index wellbeing_versions_one_active
  on public.wellbeing_versions (is_active) where is_active;

create table public.wellbeing_items (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.wellbeing_versions (id) on delete cascade,
  external_id text not null,
  -- 0-based administration order. Also the index into
  -- wellbeing_results.item_positions, so it is part of the version contract.
  position int not null check (position between 0 and 11),
  -- NULL until licensed wording is seeded.
  prompt text,
  created_at timestamptz not null default now(),
  unique (version_id, position),
  unique (version_id, external_id)
);
create index wellbeing_items_version_idx on public.wellbeing_items (version_id);

create table public.wellbeing_item_options (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.wellbeing_items (id) on delete cascade,
  -- 0-based: 0 = first published option … 3 = fourth.
  position int not null check (position between 0 and 3),
  -- NULL until licensed wording is seeded.
  label text,
  -- Primary screening weight: 0-0-1-1 by position. Stored per row rather than
  -- derived, so a future version could carry a different published response
  -- set without the engine guessing.
  bimodal_score smallint not null check (bimodal_score in (0, 1)),
  -- Secondary continuous weight: 0-1-2-3 by position.
  likert_score smallint not null check (likert_score between 0 and 3),
  created_at timestamptz not null default now(),
  unique (item_id, position)
);
create index wellbeing_item_options_item_idx on public.wellbeing_item_options (item_id);

-- ── 3 · governed lookups ─────────────────────────────────────────────
--
-- Department / Function is NOT the existing teams.department column, which
-- the product calls "Sub Team" everywhere it appears. They are different
-- questions with different answer sets, so they get different storage.
-- organization_id NULL means a platform-level list every organisation sees.

create table public.wellbeing_departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  name text not null,
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger wellbeing_departments_updated before update on public.wellbeing_departments
  for each row execute function public.set_updated_at();
create unique index wellbeing_departments_org_name_uniq
  on public.wellbeing_departments (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'), lower(name));
create index wellbeing_departments_org_idx on public.wellbeing_departments (organization_id);

create table public.wellbeing_office_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  name text not null,
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger wellbeing_office_locations_updated before update on public.wellbeing_office_locations
  for each row execute function public.set_updated_at();
create unique index wellbeing_office_locations_org_name_uniq
  on public.wellbeing_office_locations (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'), lower(name));
create index wellbeing_office_locations_org_idx
  on public.wellbeing_office_locations (organization_id);

-- ── 4 · governance policy (append-only) ──────────────────────────────
--
-- The screening threshold and the confidentiality floor are policy, not
-- configuration: changing either changes how every subsequent result reads.
-- So this table is append-only — there is no UPDATE policy and no DELETE
-- policy at all. A change is a new row, and the previous row remains as the
-- record of what was in force before it.
--
-- organization_id NULL is the platform default. An organisation row overrides
-- it from its effective_from onward.

create table public.wellbeing_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  screening_threshold smallint not null default 4
    check (screening_threshold between 1 and 12),
  -- Minimum completed responses before ANY cohort figure may be reported.
  min_cohort_size smallint not null default 7 check (min_cohort_size >= 5),
  scoring_method text not null default 'ghq_bimodal_0011',
  effective_from timestamptz not null default now(),
  -- Why the policy is what it is: the population it was validated against,
  -- who approved it, what evidence was reviewed.
  rationale text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index wellbeing_policies_lookup_idx
  on public.wellbeing_policies (organization_id, effective_from desc);

-- ── 5 · wellbeing access roles ───────────────────────────────────────
--
-- Deliberately a separate table from organization_members. Putting these in
-- the existing role enum would make them reachable through every code path
-- that already resolves org membership, which is exactly the coupling the
-- privacy requirement forbids.
--
-- 'wellbeing_governance' — sets the threshold, the confidentiality floor and
--   the questionnaire version. Reads NO individual result.
-- 'wellbeing_analyst'    — reads aggregate analytics that have passed cohort
--   suppression. Reads NO individual result.
--
-- Note what is absent: there is no role in this migration that can read an
-- individual's wellbeing responses or score. That capability does not exist
-- in the schema, so it cannot be granted by mistake. If a clinical/occupational
-- health reader is ever required, it must be designed under clinical
-- governance as its own change, with its own audit trail.

create table public.wellbeing_role_grants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role public.wellbeing_access_role not null,
  granted_by uuid not null references public.profiles (id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id),
  note text not null default '',
  created_at timestamptz not null default now()
);
create unique index wellbeing_role_grants_active_uniq
  on public.wellbeing_role_grants (profile_id, organization_id, role)
  where revoked_at is null;
create index wellbeing_role_grants_profile_idx
  on public.wellbeing_role_grants (profile_id) where revoked_at is null;
create index wellbeing_role_grants_org_idx
  on public.wellbeing_role_grants (organization_id) where revoked_at is null;

-- ── 6 · participant flow ─────────────────────────────────────────────

create table public.wellbeing_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  version_id uuid not null references public.wellbeing_versions (id),
  -- Existing DISC360 team. There is no parallel wellbeing-team model.
  team_id uuid references public.teams (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  status public.session_status not null default 'in_progress',
  current_index int not null default 0,

  -- Consent. Voluntary participation is explicit and recorded; without it the
  -- session cannot reach 'completed'.
  consent_given boolean not null default false,
  consent_at timestamptz,

  -- Operational context (§5). Captured once per attempt.
  department_id uuid references public.wellbeing_departments (id) on delete set null,
  department_name text,
  work_location public.wellbeing_work_location,
  office_location_id uuid references public.wellbeing_office_locations (id) on delete set null,
  office_location_name text,
  job_title text,

  -- Self-reported, kept for operational reporting only. System behaviour NEVER
  -- consults it: whether previous results exist is answered by the database.
  self_reported_first_time boolean,

  -- Opt-in personal report delivery. An address present here is NOT consent to
  -- send; email_opt_in is.
  email_opt_in boolean not null default false,
  contact_email text,

  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Field-based work has no office location, and is never forced to pick one.
  constraint wellbeing_sessions_office_only_when_office_based
    check (work_location is distinct from 'field_based'
           or (office_location_id is null and office_location_name is null)),
  -- A completed attempt has consent, a department and a work location.
  constraint wellbeing_sessions_completed_is_complete
    check (
      status <> 'completed'
      or (consent_given and consent_at is not null
          and department_name is not null
          and work_location is not null
          and (work_location = 'field_based' or office_location_name is not null))
    )
);
create trigger wellbeing_sessions_updated before update on public.wellbeing_sessions
  for each row execute function public.set_updated_at();
create index wellbeing_sessions_profile_idx on public.wellbeing_sessions (profile_id);
create index wellbeing_sessions_team_idx on public.wellbeing_sessions (team_id);
create index wellbeing_sessions_org_idx on public.wellbeing_sessions (organization_id);
create index wellbeing_sessions_version_idx on public.wellbeing_sessions (version_id);
create index wellbeing_sessions_department_idx on public.wellbeing_sessions (department_id);
create index wellbeing_sessions_office_idx on public.wellbeing_sessions (office_location_id);

-- One ACTIVE attempt per (person, team); one active individual attempt.
-- Nothing caps COMPLETED attempts — retakes are expected and every one is kept.
create unique index wellbeing_sessions_active_team_uniq
  on public.wellbeing_sessions (profile_id, team_id)
  where status = 'in_progress' and team_id is not null;
create unique index wellbeing_sessions_active_solo_uniq
  on public.wellbeing_sessions (profile_id)
  where status = 'in_progress' and team_id is null;

create table public.wellbeing_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.wellbeing_sessions (id) on delete cascade,
  item_id uuid not null references public.wellbeing_items (id),
  -- The chosen response POSITION, 0–3. Storing the position rather than an
  -- option id keeps a response readable even if licensed wording is reseeded.
  option_position smallint not null check (option_position between 0 and 3),
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, item_id)
);
create trigger wellbeing_responses_updated before update on public.wellbeing_responses
  for each row execute function public.set_updated_at();
create index wellbeing_responses_session_idx on public.wellbeing_responses (session_id);

create table public.wellbeing_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.wellbeing_sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,

  -- ── scores ────────────────────────────────────────────────────────
  -- Primary screening score. Queryable column, never JSON-only.
  total_score smallint not null check (total_score between 0 and 12),
  -- Secondary continuous measure. Stored because the item positions make it
  -- free to derive, and because a later research question cannot be answered
  -- retrospectively if it was never computed. It is NOT shown to participants
  -- or to management analytics by default, and it never sets the threshold.
  likert_score smallint not null check (likert_score between 0 and 36),
  -- Per-item response positions, indexed by the item's position in the
  -- version. Kept on the result so aggregate item analytics (§19) can read
  -- results alone and never touch the response table.
  item_positions smallint[] not null
    check (array_length(item_positions, 1) = 12),

  -- ── engine + policy provenance ────────────────────────────────────
  scoring_method text not null default 'ghq_bimodal_0011',
  scoring_version text not null,
  questionnaire_version int not null,
  version_id uuid not null references public.wellbeing_versions (id),
  -- The cut-off in force when this attempt completed. Historical reports stay
  -- interpretable when policy later changes.
  threshold_at_completion smallint not null check (threshold_at_completion between 1 and 12),
  -- Stored rather than derived so a read never has to recompute policy.
  at_or_above_threshold boolean not null,

  -- ── context snapshot, frozen at completion (§6) ───────────────────
  team_id uuid references public.teams (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  team_series_id uuid references public.team_series (id) on delete set null,
  department_at_completion text,
  work_location_at_completion public.wellbeing_work_location,
  office_location_at_completion text,
  job_title_at_completion text,
  team_name_at_completion text,
  organization_name_at_completion text,
  -- 1-based within this participant's own wellbeing history. Written once.
  attempt_number int,

  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint wellbeing_results_threshold_matches_flag
    check (at_or_above_threshold = (total_score >= threshold_at_completion)),
  constraint wellbeing_results_office_only_when_office_based
    check (work_location_at_completion is distinct from 'field_based'
           or office_location_at_completion is null)
);
create index wellbeing_results_profile_idx on public.wellbeing_results (profile_id);
create index wellbeing_results_history_idx
  on public.wellbeing_results (profile_id, completed_at desc);
create index wellbeing_results_team_idx on public.wellbeing_results (team_id, completed_at desc);
create index wellbeing_results_org_idx
  on public.wellbeing_results (organization_id, completed_at desc);
create index wellbeing_results_series_idx
  on public.wellbeing_results (team_series_id, completed_at desc);
create index wellbeing_results_version_idx on public.wellbeing_results (version_id);
-- Analytics lookup paths: cohort slicing by context.
create index wellbeing_results_department_idx
  on public.wellbeing_results (organization_id, department_at_completion);
create index wellbeing_results_location_idx
  on public.wellbeing_results (organization_id, work_location_at_completion, office_location_at_completion);

-- ── 7 · opt-in report delivery log ───────────────────────────────────
--
-- notification_logs already records every send attempt. This table records the
-- REQUEST as well, so "the participant asked and nothing happened" is a state
-- the product can see. Nothing here stores a score or an item response — a
-- delivery record must never become a second, less-protected copy of the data.

create table public.wellbeing_report_deliveries (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.wellbeing_results (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.wellbeing_delivery_status not null default 'requested',
  -- Masked at write time (e.g. j••••n@example.com). The full address is
  -- already on the profile; duplicating it here would widen its exposure.
  masked_recipient text not null,
  notification_log_id uuid references public.notification_logs (id) on delete set null,
  error text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger wellbeing_report_deliveries_updated
  before update on public.wellbeing_report_deliveries
  for each row execute function public.set_updated_at();
create index wellbeing_report_deliveries_result_idx
  on public.wellbeing_report_deliveries (result_id);
create index wellbeing_report_deliveries_profile_idx
  on public.wellbeing_report_deliveries (profile_id, requested_at desc);

-- Wellbeing exports recorded alongside every other export. report_exports
-- .result_id is a FK into assessment_results, so wellbeing gets its own
-- nullable column rather than a widened, ambiguous one.
alter table public.report_exports
  add column wellbeing_result_id uuid references public.wellbeing_results (id) on delete set null;
create index report_exports_wellbeing_idx
  on public.report_exports (wellbeing_result_id);

-- ── 8 · helper functions ─────────────────────────────────────────────

-- Wellbeing access, and ONLY wellbeing access.
--
-- Note what this function does not contain: `or public.is_super_admin()`.
-- 00019 made is_team_admin() platform-wide for super admins, which is correct
-- for facilitation and wrong for health data. A platform administrator holds
-- no wellbeing role until one is granted to them explicitly and recorded in
-- wellbeing_role_grants — and even then the role reaches aggregates and
-- policy, never an individual row.
create or replace function public.has_wellbeing_role(
  org uuid,
  required public.wellbeing_access_role
)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.wellbeing_role_grants g
    where g.organization_id = org
      and g.profile_id = auth.uid()
      and g.role = required
      and g.revoked_at is null
  );
$$;

-- Either wellbeing role — the read scope for policy and lookup tables.
create or replace function public.has_any_wellbeing_role(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.wellbeing_role_grants g
    where g.organization_id = org
      and g.profile_id = auth.uid()
      and g.revoked_at is null
  );
$$;

-- The policy in force for an organisation: its own most recent effective row,
-- else the platform default. Returns both governed numbers together so a
-- caller cannot pick up a threshold from one policy and a floor from another.
create or replace function public.wellbeing_active_policy(org uuid)
returns table (screening_threshold smallint, min_cohort_size smallint)
language sql stable security definer set search_path = public as $$
  select p.screening_threshold, p.min_cohort_size
  from public.wellbeing_policies p
  where (p.organization_id = org or p.organization_id is null)
    and p.effective_from <= now()
  -- An organisation row outranks the platform default at equal recency.
  order by (p.organization_id is not null) desc, p.effective_from desc
  limit 1;
$$;

-- Whether the caller has any reason to see an organisation's wellbeing form
-- taxonomy: they belong to it, they run a team inside it, or they have an
-- attempt there. Keeps the department list off the open API without forcing
-- participants into organization_members.
create or replace function public.can_read_wellbeing_lookup(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select org is null
    or public.is_org_member(org)
    or public.has_any_wellbeing_role(org)
    or exists (
      select 1 from public.wellbeing_sessions s
      where s.organization_id = org and s.profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.profile_id = auth.uid() and t.organization_id = org
    );
$$;

-- ── 9 · RLS ──────────────────────────────────────────────────────────
--
-- The rule for this module is stricter than the rest of the platform:
--
--   Individual wellbeing sessions, responses and results are readable by
--   their owner and by NOBODY else — no team admin, no organization admin,
--   no coach, no wellbeing role, no platform super admin.
--
-- Every policy below on those three tables is `profile_id = auth.uid()` with
-- no disjunction. That is not an oversight to be "fixed" later by adding an
-- admin clause; it is the requirement. Management analytics are produced by
-- server-side aggregation that applies cohort suppression BEFORE any figure
-- is returned, and that path is authorised by has_wellbeing_role, not by RLS
-- on these tables.

-- Content: readable by any signed-in user, mirroring the DISC and Focus banks.
alter table public.wellbeing_versions enable row level security;
create policy wellbeing_versions_select on public.wellbeing_versions
  for select using (auth.uid() is not null);

alter table public.wellbeing_items enable row level security;
create policy wellbeing_items_select on public.wellbeing_items
  for select using (auth.uid() is not null);

alter table public.wellbeing_item_options enable row level security;
create policy wellbeing_item_options_select on public.wellbeing_item_options
  for select using (auth.uid() is not null);

-- Lookups: read for anyone with a reason; write for wellbeing governance only.
alter table public.wellbeing_departments enable row level security;
create policy wellbeing_departments_select on public.wellbeing_departments
  for select using (public.can_read_wellbeing_lookup(organization_id));
create policy wellbeing_departments_insert on public.wellbeing_departments
  for insert with check (
    organization_id is not null
    and public.has_wellbeing_role(organization_id, 'wellbeing_governance')
  );
create policy wellbeing_departments_update on public.wellbeing_departments
  for update using (
    organization_id is not null
    and public.has_wellbeing_role(organization_id, 'wellbeing_governance')
  );

alter table public.wellbeing_office_locations enable row level security;
create policy wellbeing_office_locations_select on public.wellbeing_office_locations
  for select using (public.can_read_wellbeing_lookup(organization_id));
create policy wellbeing_office_locations_insert on public.wellbeing_office_locations
  for insert with check (
    organization_id is not null
    and public.has_wellbeing_role(organization_id, 'wellbeing_governance')
  );
create policy wellbeing_office_locations_update on public.wellbeing_office_locations
  for update using (
    organization_id is not null
    and public.has_wellbeing_role(organization_id, 'wellbeing_governance')
  );

-- Policy: readable by anyone who can see the form (the threshold is disclosed
-- to participants on their own result, so it is not a secret); appendable by
-- governance only. There is deliberately NO update and NO delete policy.
alter table public.wellbeing_policies enable row level security;
create policy wellbeing_policies_select on public.wellbeing_policies
  for select using (public.can_read_wellbeing_lookup(organization_id));
create policy wellbeing_policies_insert on public.wellbeing_policies
  for insert with check (
    organization_id is not null
    and public.has_wellbeing_role(organization_id, 'wellbeing_governance')
    and created_by = auth.uid()
  );

-- Role grants: a person sees their own; governance sees its organisation's.
-- Granting is an administrative act performed by the service role after an
-- explicit check and an audit_logs row — there is no INSERT policy here, so
-- no one can grant themselves a wellbeing role through the API.
alter table public.wellbeing_role_grants enable row level security;
create policy wellbeing_role_grants_select on public.wellbeing_role_grants
  for select using (
    profile_id = auth.uid()
    or public.has_wellbeing_role(organization_id, 'wellbeing_governance')
    or public.is_super_admin()
  );

-- Individual flow: strictly own-row, no exceptions.
alter table public.wellbeing_sessions enable row level security;
create policy wellbeing_sessions_all_own on public.wellbeing_sessions
  for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

alter table public.wellbeing_responses enable row level security;
create policy wellbeing_responses_all_own on public.wellbeing_responses
  for all using (
    exists (
      select 1 from public.wellbeing_sessions s
      where s.id = session_id and s.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.wellbeing_sessions s
      where s.id = session_id and s.profile_id = auth.uid()
    )
  );

alter table public.wellbeing_results enable row level security;
create policy wellbeing_results_select_own on public.wellbeing_results
  for select using (profile_id = auth.uid());
create policy wellbeing_results_insert_own on public.wellbeing_results
  for insert with check (profile_id = auth.uid());
-- No update policy and no delete policy: a completed wellbeing result is
-- immutable, and a retake is a new row rather than an edit to an old one.

alter table public.wellbeing_report_deliveries enable row level security;
create policy wellbeing_report_deliveries_select_own on public.wellbeing_report_deliveries
  for select using (profile_id = auth.uid());

-- ── 10 · grants ──────────────────────────────────────────────────────
-- Default privileges from 00004 cover new tables; explicit for safety.
-- anon gets nothing: every wellbeing query runs as the authenticated owner or
-- as the service role after an authorization check.

grant select, insert, update, delete on
  public.wellbeing_versions, public.wellbeing_items, public.wellbeing_item_options,
  public.wellbeing_departments, public.wellbeing_office_locations,
  public.wellbeing_policies, public.wellbeing_role_grants,
  public.wellbeing_sessions, public.wellbeing_responses, public.wellbeing_results,
  public.wellbeing_report_deliveries
  to authenticated, service_role;

revoke all on function public.has_wellbeing_role(uuid, public.wellbeing_access_role) from public;
revoke all on function public.has_any_wellbeing_role(uuid) from public;
revoke all on function public.wellbeing_active_policy(uuid) from public;
revoke all on function public.can_read_wellbeing_lookup(uuid) from public;
grant execute on function public.has_wellbeing_role(uuid, public.wellbeing_access_role)
  to authenticated, service_role;
grant execute on function public.has_any_wellbeing_role(uuid) to authenticated, service_role;
grant execute on function public.wellbeing_active_policy(uuid) to authenticated, service_role;
grant execute on function public.can_read_wellbeing_lookup(uuid) to authenticated, service_role;
