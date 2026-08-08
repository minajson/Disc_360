-- Identity reconciliation: email history, auth↔profile sync, and a safe merge.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHAT THIS MIGRATION DOES NOT DO — the important part.
--
--   · It does not introduce a second "person" identity. profiles.id
--     ( = auth.users.id ) remains the one canonical identifier, and every RLS
--     policy in the schema keeps its existing `profile_id = auth.uid()` shape.
--     Not one policy is altered here.
--   · It does not DROP anything. No table, column, constraint, index, policy
--     or function is dropped or redefined out from under existing behaviour.
--   · It does not UPDATE or DELETE a single pre-existing row. The one write
--     to existing data is an INSERT into a brand-new table (§7 backfill).
--   · It does not touch scoring, results, sessions, questions, history,
--     team analytics or AI narratives. No score, date, team_id,
--     team_series_id, *_at_completion snapshot or attempt_number is read for
--     writing anywhere in this file.
--   · It never resolves a person from an email. Aliases exist for platform
--     admin search and audit only; authentication remains entirely
--     Supabase's job, which is what makes "no automatic merge" structural
--     rather than a matter of discipline.
--
-- The reconciliation function re-parents ownership pointers. It is an UPDATE
-- of profile_id, never an INSERT of a result — so a merge cannot duplicate
-- history, and it verifies exactly that before it will retire anything.
--
-- The FK graph is the reason the ordering in admin_reconcile_identity is not
-- negotiable: every person-scoped table is
--   references public.profiles (id) on delete cascade
-- and profiles cascades from auth.users. Deleting a duplicate auth user
-- destroys that user's assessment results. Nothing here deletes an auth user
-- or a profile; the duplicate is TOMBSTONED, and only after a full sweep
-- proves no row still references it.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1 · email / identity history ─────────────────────────────────────
--
-- One row per (person, address ever used). The active row always equals
-- auth.users.email and profiles.email; retired rows are what make an old
-- address still find its owner in admin search.
--
-- source_profile_id records the identity a row arrived from when a
-- reconciliation moved it, so the trail survives the merge that created it.

create table public.participant_identity_aliases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  email text not null,
  -- 'email' | 'google' | 'azure' — informational; never an authorization input.
  provider text not null default 'email',
  status text not null default 'active' check (status in ('active', 'retired')),
  -- how this address came to be known
  source text not null default 'signup'
    check (source in ('signup', 'backfill', 'auth_sync', 'admin_change', 'reconciliation')),
  -- the profile this alias belonged to before a reconciliation moved it
  source_profile_id uuid references public.profiles (id) on delete set null,
  reason text,
  first_seen_at timestamptz not null default now(),
  retired_at timestamptz,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- One alias row per (person, address): makes reactivation on re-use
-- deterministic instead of accumulating near-duplicates.
create unique index identity_aliases_profile_email_uniq
  on public.participant_identity_aliases (profile_id, lower(email));

-- Exactly one active address per person.
create unique index identity_aliases_one_active
  on public.participant_identity_aliases (profile_id)
  where status = 'active';

-- An address is the ACTIVE address of at most one person. Retired duplicates
-- are allowed and expected — that is the whole point of the history.
create unique index identity_aliases_active_email_uniq
  on public.participant_identity_aliases (lower(email))
  where status = 'active';

-- Admin search by any address the person has ever used.
create index identity_aliases_email_idx
  on public.participant_identity_aliases (lower(email));
create index identity_aliases_profile_idx
  on public.participant_identity_aliases (profile_id);

alter table public.participant_identity_aliases enable row level security;

-- Platform scope only. Participants get NO read access: an alias list is an
-- administrative artefact, and one person's address history is not another
-- person's business.
create policy identity_aliases_select_admin on public.participant_identity_aliases
  for select using (public.is_super_admin());

grant select on public.participant_identity_aliases to authenticated;

-- ── 2 · reconciliation record ────────────────────────────────────────
--
-- The structured evidence for every identity change: what the counts were
-- before, what they were after, which conflicts were resolved and by whom.
-- audit_logs carries the human-facing trail alongside it.

create table public.identity_reconciliations (
  id uuid primary key default gen_random_uuid(),
  canonical_profile_id uuid not null references public.profiles (id) on delete cascade,
  retired_profile_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('email_change', 'reconcile')),
  -- pending_auth: the database side is complete and consistent; the Auth
  -- mutation has not landed yet. The participant can still sign in with their
  -- existing address in this state — see the ordering note in §5.
  status text not null default 'pending_auth'
    check (status in ('pending_auth', 'completed', 'failed')),
  old_email text,
  new_email text,
  counts_before jsonb not null default '{}'::jsonb,
  counts_after jsonb not null default '{}'::jsonb,
  conflicts_resolved jsonb not null default '{}'::jsonb,
  note text,
  performed_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index identity_reconciliations_canonical_idx
  on public.identity_reconciliations (canonical_profile_id, created_at desc);
create index identity_reconciliations_status_idx
  on public.identity_reconciliations (status)
  where status = 'pending_auth';

alter table public.identity_reconciliations enable row level security;

create policy identity_reconciliations_select_admin on public.identity_reconciliations
  for select using (public.is_super_admin());

grant select on public.identity_reconciliations to authenticated;

-- ── 3 · auth.users.email → profiles.email sync ───────────────────────
--
-- The standing correctness bug this closes: handle_new_user() fires on INSERT
-- only, so an auth email could change while profiles.email stayed stale —
-- and profiles.email is the address a participant's own report is delivered
-- to. They could not silently diverge without misdelivering a report.
--
-- No recursion is possible: the function writes to public.profiles and
-- public.participant_identity_aliases and never back to auth.users.
--
-- A tombstoned address (the retired side of a reconciliation) syncs the
-- profile but deliberately records no active alias — a retired identity has
-- no current address, and giving it one would take an active-email slot.

create or replace function public.sync_profile_email_from_auth()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tombstone boolean := new.email like 'retired+%@identity.disc360.invalid';
begin
  update public.profiles set email = new.email where id = new.id;

  -- Retire whatever used to be current, unless it already is the new address.
  update public.participant_identity_aliases
     set status = 'retired', retired_at = now()
   where profile_id = new.id
     and status = 'active'
     and lower(email) is distinct from lower(new.email);

  if v_tombstone then
    return new;
  end if;

  -- Re-use the person's existing row for this address when there is one
  -- (a reconciliation moves the incoming identity's aliases across before
  -- the Auth mutation lands), otherwise record it for the first time.
  update public.participant_identity_aliases
     set status = 'active', retired_at = null
   where profile_id = new.id
     and lower(email) = lower(new.email);

  if not found then
    insert into public.participant_identity_aliases
      (profile_id, email, status, source, first_seen_at)
    values (new.id, new.email, 'active', 'auth_sync', now());
  end if;

  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email_from_auth();

-- New accounts get their first alias at creation, so every profile always has
-- exactly one active address from the moment it exists.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  insert into public.notification_preferences (profile_id) values (new.id);
  insert into public.participant_identity_aliases (profile_id, email, status, source)
  values (new.id, new.email, 'active', 'signup');
  return new;
end;
$$;

-- ── 4 · preflight: read-only conflict report ─────────────────────────
--
-- Returns everything the admin must see before any control that writes is
-- rendered. It writes nothing, by construction — a preflight that mutated
-- would defeat the point of asking first.

create or replace function public.admin_preflight_identity_reconciliation(
  p_actor uuid,
  p_canonical uuid,
  p_retiring uuid
)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  v_canonical public.profiles%rowtype;
  v_retiring public.profiles%rowtype;
  v_blockers text[] := '{}';
begin
  if not exists (select 1 from public.profiles where id = p_actor and is_super_admin) then
    raise exception 'identity: platform administrator scope required';
  end if;

  select * into v_canonical from public.profiles where id = p_canonical;
  select * into v_retiring from public.profiles where id = p_retiring;

  if v_canonical.id is null or v_retiring.id is null then
    raise exception 'identity: both profiles must exist';
  end if;
  if p_canonical = p_retiring then
    raise exception 'identity: canonical and retiring profiles must differ';
  end if;

  -- Hard blocks. An administrator account is never reconciled implicitly, and
  -- an already-retired identity is not a merge candidate.
  if v_canonical.is_super_admin or v_retiring.is_super_admin then
    v_blockers := v_blockers || 'super_admin_identity';
  end if;
  if v_retiring.deactivated_at is not null then
    v_blockers := v_blockers || 'retiring_already_deactivated';
  end if;
  if v_canonical.deactivated_at is not null then
    v_blockers := v_blockers || 'canonical_deactivated';
  end if;

  return jsonb_build_object(
    'blockers', to_jsonb(v_blockers),
    'canonical', public.identity_summary(p_canonical),
    'retiring', public.identity_summary(p_retiring),
    'shared_teams', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'team_id', t.id,
               'team_name', t.name,
               'canonical_role', ca.role,
               'retiring_role', re.role
             ) order by t.name), '[]'::jsonb)
      from public.team_members ca
      join public.team_members re
        on re.team_id = ca.team_id and re.profile_id = p_retiring
      join public.teams t on t.id = ca.team_id
      where ca.profile_id = p_canonical
    ),
    'shared_organizations', (
      select coalesce(jsonb_agg(ca.organization_id), '[]'::jsonb)
      from public.organization_members ca
      join public.organization_members re
        on re.organization_id = ca.organization_id and re.profile_id = p_retiring
      where ca.profile_id = p_canonical
    ),
    -- In-progress attempts on the retiring identity that would collide with
    -- the partial unique indexes from 00018. These are abandoned by the merge;
    -- an unfinished attempt is the only thing the operation discards.
    'attempts_to_abandon', jsonb_build_object(
      'disc', (select count(*) from public.assessment_sessions
                where profile_id = p_retiring and status = 'in_progress'),
      'focus', (select count(*) from public.focus_sessions
                 where profile_id = p_retiring and status = 'in_progress'),
      'combined', (select count(*) from public.combined_sessions
                    where profile_id = p_retiring and status = 'in_progress')
    ),
    'singletons', jsonb_build_object(
      'canonical_has_coach_profile',
        exists (select 1 from public.coach_profiles where profile_id = p_canonical),
      'retiring_has_coach_profile',
        exists (select 1 from public.coach_profiles where profile_id = p_retiring)
    ),
    'projected', jsonb_build_object(
      'disc_results',
        (select count(*) from public.assessment_results where profile_id in (p_canonical, p_retiring)),
      'focus_results',
        (select count(*) from public.focus_results where profile_id in (p_canonical, p_retiring)),
      'combined_sessions',
        (select count(*) from public.combined_sessions where profile_id in (p_canonical, p_retiring)),
      'team_memberships', (
        select count(distinct team_id) from public.team_members
        where profile_id in (p_canonical, p_retiring)
      )
    )
  );
end;
$$;

-- Per-identity counts, shared by the preflight, the admin panel and the
-- before/after evidence on the reconciliation record.
create or replace function public.identity_summary(p_profile uuid)
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'profile_id', p.id,
    'full_name', p.full_name,
    'preferred_name', p.preferred_name,
    'email', p.email,
    'created_at', p.created_at,
    'deactivated_at', p.deactivated_at,
    'is_super_admin', p.is_super_admin,
    'disc_results', (select count(*) from public.assessment_results where profile_id = p.id),
    'focus_results', (select count(*) from public.focus_results where profile_id = p.id),
    'combined_sessions', (select count(*) from public.combined_sessions where profile_id = p.id),
    'disc_sessions', (select count(*) from public.assessment_sessions where profile_id = p.id),
    'focus_sessions', (select count(*) from public.focus_sessions where profile_id = p.id),
    'report_exports', (select count(*) from public.report_exports where profile_id = p.id),
    'team_memberships', (select count(*) from public.team_members where profile_id = p.id),
    'teams', (
      select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'role', tm.role)
                                order by t.name), '[]'::jsonb)
      from public.team_members tm join public.teams t on t.id = tm.team_id
      where tm.profile_id = p.id
    ),
    'aliases', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'email', a.email, 'status', a.status, 'provider', a.provider,
               'source', a.source, 'first_seen_at', a.first_seen_at,
               'retired_at', a.retired_at
             ) order by a.status desc, a.first_seen_at), '[]'::jsonb)
      from public.participant_identity_aliases a where a.profile_id = p.id
    )
  )
  from public.profiles p where p.id = p_profile;
$$;

-- ── 5 · the reconciliation itself ────────────────────────────────────
--
-- One transaction. Every ownership pointer moves, conflicts are resolved to
-- exactly one row, and then a set of assertions has to pass before the
-- function will record anything. Any failure raises, which rolls back the
-- whole statement — there is no partially-merged state.
--
-- What this deliberately does NOT do:
--   · delete the retiring auth user or profile (cascade would take the
--     results with it) — it tombstones,
--   · renumber attempt_number — that value records what was true at
--     completion, and My History orders by created_at anyway,
--   · touch team_id, team_series_id or any *_at_completion snapshot, so a
--     result taken for Team D in May is still Team D's May result afterwards.
--
-- Ordering against the Auth mutation, which cannot join this transaction:
-- this runs FIRST and leaves status = 'pending_auth'. If the subsequent Auth
-- call fails, the canonical identity already owns everything and still signs
-- in with its existing address. The failure mode is a stale login, never
-- inaccessible history.

create or replace function public.admin_reconcile_identity(
  p_actor uuid,
  p_canonical uuid,
  p_retiring uuid,
  p_note text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_canonical public.profiles%rowtype;
  v_retiring public.profiles%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_conflicts jsonb := '{}'::jsonb;
  v_checksum_before text;
  v_checksum_after text;
  v_disc_before int; v_focus_before int; v_combined_before int;
  v_sessions_disc_before int; v_sessions_focus_before int;
  v_dropped_memberships int := 0;
  v_dropped_org int := 0;
  v_abandoned int := 0;
  v_row record;
  v_keep uuid;
  v_drop uuid;
  v_count bigint;
  v_reconciliation uuid;
begin
  if not exists (select 1 from public.profiles where id = p_actor and is_super_admin) then
    raise exception 'identity: platform administrator scope required';
  end if;

  -- Lock both identities for the duration; a concurrent second reconciliation
  -- naming the same pair must wait rather than interleave.
  select * into v_canonical from public.profiles where id = p_canonical for update;
  select * into v_retiring from public.profiles where id = p_retiring for update;

  if v_canonical.id is null or v_retiring.id is null then
    raise exception 'identity: both profiles must exist';
  end if;
  if p_canonical = p_retiring then
    raise exception 'identity: canonical and retiring profiles must differ';
  end if;
  if v_canonical.is_super_admin or v_retiring.is_super_admin then
    raise exception 'identity: a platform administrator account cannot be reconciled';
  end if;
  if v_retiring.deactivated_at is not null then
    raise exception 'identity: the retiring identity is already retired';
  end if;

  -- ── evidence, captured inside the transaction ──
  v_before := jsonb_build_object(
    'canonical', public.identity_summary(p_canonical),
    'retiring', public.identity_summary(p_retiring)
  );
  select count(*) into v_disc_before from public.assessment_results
    where profile_id in (p_canonical, p_retiring);
  select count(*) into v_focus_before from public.focus_results
    where profile_id in (p_canonical, p_retiring);
  select count(*) into v_combined_before from public.combined_sessions
    where profile_id in (p_canonical, p_retiring);
  select count(*) into v_sessions_disc_before from public.assessment_sessions
    where profile_id in (p_canonical, p_retiring);
  select count(*) into v_sessions_focus_before from public.focus_sessions
    where profile_id in (p_canonical, p_retiring);

  -- Scoring freeze: every value the product treats as historical fact, hashed
  -- before and after. If a single score, date, version or team attribution
  -- moves, the assertion at the end refuses the merge.
  select md5(string_agg(x, '|' order by x)) into v_checksum_before from (
    select concat_ws(':', r.id, r.score_d, r.score_i, r.score_s, r.score_c,
                     r.archetype_code, r.primary_dimension, r.secondary_dimension,
                     r.created_at, r.team_id, r.team_series_id, r.attempt_number,
                     r.assessment_version, r.scoring_version,
                     r.team_name_at_completion, r.department_at_completion) as x
    from public.assessment_results r where r.profile_id in (p_canonical, p_retiring)
    union all
    select concat_ws(':', f.id, f.automaticity, f.distraction, f.mental_load, f.recovery,
                     f.pattern_code, f.created_at, f.team_id, f.team_series_id,
                     f.attempt_number, f.assessment_version, f.scoring_version) as x
    from public.focus_results f where f.profile_id in (p_canonical, p_retiring)
  ) s;

  -- ── 5a · clear the partial-unique collisions from 00018 ──
  update public.assessment_sessions set status = 'abandoned'
   where profile_id = p_retiring and status = 'in_progress';
  get diagnostics v_count = row_count; v_abandoned := v_abandoned + v_count;
  update public.focus_sessions set status = 'abandoned'
   where profile_id = p_retiring and status = 'in_progress';
  get diagnostics v_count = row_count; v_abandoned := v_abandoned + v_count;
  update public.combined_sessions set status = 'abandoned'
   where profile_id = p_retiring and status = 'in_progress';
  get diagnostics v_count = row_count; v_abandoned := v_abandoned + v_count;

  -- ── 5b · team memberships: exactly one row per person per team ──
  --
  -- team_members is unique on (team_id, EMAIL), not (team_id, profile_id), so
  -- a bare re-parent would silently leave two roster rows for one person and
  -- double-count them in every team aggregate. Nothing in the schema would
  -- catch it. This resolves each overlap explicitly, strongest role winning,
  -- and moves the losing row's campaign assignments across first so completion
  -- status is not lost with it.
  for v_row in
    select ca.id as canonical_member, re.id as retiring_member, ca.team_id,
           ca.role as canonical_role, re.role as retiring_role,
           ca.created_at as canonical_created, re.created_at as retiring_created
    from public.team_members ca
    join public.team_members re
      on re.team_id = ca.team_id and re.profile_id = p_retiring
    where ca.profile_id = p_canonical
  loop
    if v_row.retiring_role = 'team_admin' and v_row.canonical_role <> 'team_admin' then
      v_keep := v_row.retiring_member; v_drop := v_row.canonical_member;
    elsif v_row.canonical_role = v_row.retiring_role
          and v_row.retiring_created < v_row.canonical_created then
      v_keep := v_row.retiring_member; v_drop := v_row.canonical_member;
    else
      v_keep := v_row.canonical_member; v_drop := v_row.retiring_member;
    end if;

    update public.campaign_assignments ca set team_member_id = v_keep
     where ca.team_member_id = v_drop
       and not exists (
         select 1 from public.campaign_assignments x
         where x.campaign_id = ca.campaign_id and x.team_member_id = v_keep
       );
    delete from public.campaign_assignments where team_member_id = v_drop;
    -- Invitations point at the roster row; keep them attached to the survivor
    -- so join history stays auditable.
    update public.invitations set team_member_id = v_keep where team_member_id = v_drop;
    delete from public.team_members where id = v_drop;
    v_dropped_memberships := v_dropped_memberships + 1;
  end loop;

  update public.team_members set profile_id = p_canonical where profile_id = p_retiring;

  -- ── 5c · organization memberships: unique (organization_id, profile_id) ──
  for v_row in
    select re.id as retiring_member
    from public.organization_members ca
    join public.organization_members re
      on re.organization_id = ca.organization_id and re.profile_id = p_retiring
    where ca.profile_id = p_canonical
  loop
    delete from public.organization_members where id = v_row.retiring_member;
    v_dropped_org := v_dropped_org + 1;
  end loop;
  update public.organization_members set profile_id = p_canonical where profile_id = p_retiring;

  -- ── 5d · ownership. UPDATE of a pointer — never an INSERT of a result ──
  update public.assessment_sessions  set profile_id = p_canonical where profile_id = p_retiring;
  update public.assessment_results   set profile_id = p_canonical where profile_id = p_retiring;
  update public.focus_sessions       set profile_id = p_canonical where profile_id = p_retiring;
  update public.focus_results        set profile_id = p_canonical where profile_id = p_retiring;
  update public.combined_sessions    set profile_id = p_canonical where profile_id = p_retiring;
  update public.report_exports       set profile_id = p_canonical where profile_id = p_retiring;
  update public.notification_logs    set profile_id = p_canonical where profile_id = p_retiring;
  update public.entitlements         set purchaser_id = p_canonical where purchaser_id = p_retiring;
  update public.team_creation_drafts set owner_profile_id = p_canonical
   where owner_profile_id = p_retiring;

  -- Singletons: one row per person by construction, so they are kept or
  -- dropped rather than moved.
  delete from public.notification_preferences where profile_id = p_retiring;
  if exists (select 1 from public.coach_profiles where profile_id = p_canonical) then
    delete from public.coach_profiles where profile_id = p_retiring;
  else
    update public.coach_profiles set profile_id = p_canonical where profile_id = p_retiring;
  end if;

  -- ── 5e · authorship. Who did a thing, not whose data it is ──
  update public.organizations        set created_by = p_canonical where created_by = p_retiring;
  update public.teams                set created_by = p_canonical where created_by = p_retiring;
  update public.team_series          set created_by = p_canonical where created_by = p_retiring;
  update public.assessment_campaigns set created_by = p_canonical where created_by = p_retiring;
  update public.invitations          set invited_by = p_canonical where invited_by = p_retiring;
  update public.invitations          set accepted_by = p_canonical where accepted_by = p_retiring;
  update public.result_corrections   set corrected_by = p_canonical where corrected_by = p_retiring;
  update public.audit_logs           set actor_id = p_canonical where actor_id = p_retiring;
  update public.ai_insight_narratives set generated_by = p_canonical where generated_by = p_retiring;
  update public.ai_insight_narratives set edited_by = p_canonical where edited_by = p_retiring;
  update public.ai_insight_narratives set shared_by = p_canonical where shared_by = p_retiring;
  update public.identity_reconciliations set canonical_profile_id = p_canonical
   where canonical_profile_id = p_retiring;

  -- ── 5f · address history follows the person ──
  --
  -- The retiring identity's addresses move to the canonical one as retired
  -- aliases, which is what lets admin search find the person by the old email
  -- afterwards. Rows the canonical identity already holds for the same address
  -- are redundant statements of the same fact and are dropped.
  delete from public.participant_identity_aliases a
   where a.profile_id = p_retiring
     and exists (
       select 1 from public.participant_identity_aliases b
       where b.profile_id = p_canonical and lower(b.email) = lower(a.email)
     );
  update public.participant_identity_aliases
     set profile_id = p_canonical,
         status = 'retired',
         retired_at = coalesce(retired_at, now()),
         source = 'reconciliation',
         source_profile_id = p_retiring,
         changed_by = p_actor
   where profile_id = p_retiring;

  -- ── 5g · tombstone. Never delete: the cascade would take the results ──
  update public.profiles
     set deactivated_at = now(),
         email = 'retired+' || p_retiring::text || '@identity.disc360.invalid'
   where id = p_retiring;

  -- ── 5h · assertions. Nothing is recorded until all of these hold ──

  -- Every foreign key that points at profiles, discovered from the catalog
  -- rather than hand-listed — a table added later without being re-parented
  -- fails here instead of silently stranding rows.
  --
  -- Two columns are excluded, and only these two: they are provenance, not
  -- ownership. Recording "this alias came from that identity" and "this
  -- reconciliation retired that identity" REQUIRES pointing at the retired
  -- profile — that is the audit trail the whole feature exists to leave. The
  -- exclusion is a hard-coded pair list rather than a pattern so a future
  -- ownership column cannot accidentally opt itself out.
  for v_row in
    select c.conrelid::regclass::text as tbl, a.attname as col
    from pg_constraint c
    join unnest(c.conkey) with ordinality k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f'
      and c.confrelid = 'public.profiles'::regclass
      and c.conrelid <> 'public.profiles'::regclass
      and (c.conrelid::regclass::text, a.attname) not in (
        ('participant_identity_aliases', 'source_profile_id'),
        ('identity_reconciliations', 'retired_profile_id')
      )
  loop
    execute format('select count(*) from %s where %I = $1', v_row.tbl, v_row.col)
      into v_count using p_retiring;
    if v_count > 0 then
      raise exception 'identity: % rows still reference the retiring identity via %.%',
        v_count, v_row.tbl, v_row.col;
    end if;
  end loop;

  -- Conservation: nothing gained, nothing lost.
  select count(*) into v_count from public.assessment_results where profile_id = p_canonical;
  if v_count <> v_disc_before then
    raise exception 'identity: DISC result count changed (% → %)', v_disc_before, v_count;
  end if;
  select count(*) into v_count from public.focus_results where profile_id = p_canonical;
  if v_count <> v_focus_before then
    raise exception 'identity: Focus result count changed (% → %)', v_focus_before, v_count;
  end if;
  select count(*) into v_count from public.combined_sessions where profile_id = p_canonical;
  if v_count <> v_combined_before then
    raise exception 'identity: combined session count changed (% → %)', v_combined_before, v_count;
  end if;
  select count(*) into v_count from public.assessment_sessions where profile_id = p_canonical;
  if v_count <> v_sessions_disc_before then
    raise exception 'identity: DISC session count changed';
  end if;
  select count(*) into v_count from public.focus_sessions where profile_id = p_canonical;
  if v_count <> v_sessions_focus_before then
    raise exception 'identity: Focus session count changed';
  end if;

  -- One roster row per team. The constraint that would have caught this
  -- does not exist, so the check does.
  select count(*) into v_count from (
    select team_id from public.team_members
    where profile_id = p_canonical group by team_id having count(*) > 1
  ) d;
  if v_count > 0 then
    raise exception 'identity: % team(s) hold more than one membership row', v_count;
  end if;

  -- Scores, dates, versions and team attribution, byte for byte.
  select md5(string_agg(x, '|' order by x)) into v_checksum_after from (
    select concat_ws(':', r.id, r.score_d, r.score_i, r.score_s, r.score_c,
                     r.archetype_code, r.primary_dimension, r.secondary_dimension,
                     r.created_at, r.team_id, r.team_series_id, r.attempt_number,
                     r.assessment_version, r.scoring_version,
                     r.team_name_at_completion, r.department_at_completion) as x
    from public.assessment_results r where r.profile_id = p_canonical
    union all
    select concat_ws(':', f.id, f.automaticity, f.distraction, f.mental_load, f.recovery,
                     f.pattern_code, f.created_at, f.team_id, f.team_series_id,
                     f.attempt_number, f.assessment_version, f.scoring_version) as x
    from public.focus_results f where f.profile_id = p_canonical
  ) s;
  if v_checksum_after is distinct from v_checksum_before then
    raise exception 'identity: historical result values changed during reconciliation';
  end if;

  -- ── 5i · record ──
  v_after := jsonb_build_object('canonical', public.identity_summary(p_canonical));
  v_conflicts := jsonb_build_object(
    'memberships_deduplicated', v_dropped_memberships,
    'organization_memberships_deduplicated', v_dropped_org,
    'in_progress_attempts_abandoned', v_abandoned
  );

  insert into public.identity_reconciliations
    (canonical_profile_id, retired_profile_id, action, status,
     old_email, new_email, counts_before, counts_after, conflicts_resolved,
     note, performed_by)
  values
    (p_canonical, p_retiring, 'reconcile', 'pending_auth',
     v_canonical.email, v_retiring.email, v_before, v_after, v_conflicts,
     p_note, p_actor)
  returning id into v_reconciliation;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor, 'identity.reconciled', 'profile', p_canonical::text,
          jsonb_build_object(
            'reconciliation_id', v_reconciliation,
            'retired_profile_id', p_retiring,
            'conflicts_resolved', v_conflicts));

  return jsonb_build_object(
    'reconciliation_id', v_reconciliation,
    'canonical_profile_id', p_canonical,
    'retired_profile_id', p_retiring,
    'new_email', v_retiring.email,
    'conflicts_resolved', v_conflicts,
    'counts_after', v_after
  );
end;
$$;

-- ── 6 · completing / recording the Auth side ─────────────────────────

create or replace function public.admin_complete_reconciliation(
  p_actor uuid,
  p_reconciliation uuid,
  p_status text,
  p_note text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = p_actor and is_super_admin) then
    raise exception 'identity: platform administrator scope required';
  end if;
  if p_status not in ('completed', 'failed') then
    raise exception 'identity: invalid completion status %', p_status;
  end if;

  update public.identity_reconciliations
     set status = p_status,
         completed_at = case when p_status = 'completed' then now() else completed_at end,
         note = coalesce(p_note, note)
   where id = p_reconciliation;
end;
$$;

-- An administrator-initiated email change that is awaiting the participant's
-- confirmation click. Recorded so the admin panel can show it as pending; the
-- alias itself is written by the auth sync trigger when the click lands.
create or replace function public.admin_record_email_change(
  p_actor uuid,
  p_profile uuid,
  p_new_email text,
  p_status text default 'pending_auth'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles%rowtype;
  v_id uuid;
begin
  if not exists (select 1 from public.profiles where id = p_actor and is_super_admin) then
    raise exception 'identity: platform administrator scope required';
  end if;
  select * into v_profile from public.profiles where id = p_profile;
  if v_profile.id is null then
    raise exception 'identity: profile not found';
  end if;

  insert into public.identity_reconciliations
    (canonical_profile_id, action, status, old_email, new_email,
     counts_before, performed_by, completed_at)
  values
    (p_profile, 'email_change', p_status, v_profile.email, p_new_email,
     public.identity_summary(p_profile), p_actor,
     case when p_status = 'completed' then now() end)
  returning id into v_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor, 'identity.email_change_requested', 'profile', p_profile::text,
          jsonb_build_object('reconciliation_id', v_id, 'status', p_status));

  return v_id;
end;
$$;

-- ── 7 · backfill: INSERT into the new table only ─────────────────────
--
-- Gives every existing profile the active alias it would have had if this
-- table had always existed. No pre-existing row is read for writing, updated
-- or deleted anywhere in this migration; this is the only statement that
-- touches data at all, and its target did not exist a moment ago.
--
-- `on conflict do nothing` keeps it safe to re-run.

insert into public.participant_identity_aliases (profile_id, email, status, source, first_seen_at)
select p.id, p.email, 'active', 'backfill', p.created_at
from public.profiles p
where p.email is not null and p.email <> ''
on conflict do nothing;

-- ── 8 · execution surface ────────────────────────────────────────────
--
-- Reached only from a server action that has already passed
-- requireSuperAdmin(), through the service-role client — and each function
-- re-checks the actor's platform scope independently. Two locks, not one.

revoke all on function public.admin_preflight_identity_reconciliation(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_reconcile_identity(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_complete_reconciliation(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_record_email_change(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.identity_summary(uuid) from public, anon, authenticated;

grant execute on function public.admin_preflight_identity_reconciliation(uuid, uuid, uuid) to service_role;
grant execute on function public.admin_reconcile_identity(uuid, uuid, uuid, text) to service_role;
grant execute on function public.admin_complete_reconciliation(uuid, uuid, text, text) to service_role;
grant execute on function public.admin_record_email_change(uuid, uuid, text, text) to service_role;
grant execute on function public.identity_summary(uuid) to service_role;
