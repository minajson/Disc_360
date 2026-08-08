# DISC360 — Identity reconciliation: audit and design

**Status:** design only. Nothing in this document has been implemented, no
migration has been written or applied, no Auth record has been touched.
**Baseline:** commit `ecb2bef` (participant report access), which this design
must not regress.

---

## 0. Summary of findings

The good news first, because it determines everything else:

**DISC360 already has a stable canonical identity, and it is already the thing
every row points at.** `profiles.id` is `auth.users.id`, and every
person-scoped table references `profiles(id)`. Every RLS predicate in the
schema is `profile_id = auth.uid()`. Not one authorization decision anywhere in
the database is made on an email address.

So this is **not** a re-architecture. The canonical model is correct. What is
missing is three narrower things:

1. **No email history.** `profiles.email` is a single mutable string with no
   alias table, so a changed address erases the old one and admin search loses
   the person.
2. **No sync between `auth.users.email` and `profiles.email`.** The
   `handle_new_user` trigger fires on INSERT only. Change the auth email today
   and `profiles.email` silently goes stale — which matters because
   `profiles.email` is the address the participant report is delivered to
   ([reports.ts](../lib/actions/reports.ts)).
3. **Email is used as a *join key* in the roster layer**, which is where
   duplicate identities are actually born.

The dangerous edge is not the design — it is the **FK cascade**. Every
person-scoped table is `references public.profiles (id) on delete cascade`, and
`profiles.id` cascades from `auth.users`. Deleting a duplicate auth user
**destroys that user's assessment results**. Any reconciliation that deletes
before it re-parents is a data-loss incident. The ordering rules in §9 exist
entirely because of this.

---

## 1. Canonical identity

| Question | Answer |
|---|---|
| Canonical person identifier | **`profiles.id`**, which is `auth.users.id` (`id uuid primary key references auth.users (id) on delete cascade`, [00001](../supabase/migrations/00001_schema.sql)) |
| Is email ever the identifier? | Never in RLS, never in a foreign key. Only in the roster/invitation layer (§4) |
| Can the UUID be preserved across an email change? | **Yes** — `auth.users.id` is immutable and independent of email |
| Can the UUID be preserved across a *merge*? | Only one of the two survives. `auth.users.id` cannot be reassigned |

That last row is the single constraint the whole reconciliation design bends
around: **Supabase gives us no way to move an identity's UUID.** So a merge is
always "pick a survivor and re-parent the other's rows to it", never "rename an
id".

---

## 2. The identity graph

Everything below hangs off `profiles.id`.

### 2.1 Direct owner references (`profile_id`, cascade on delete)

| Table | Column | Notes |
|---|---|---|
| `organization_members` | `profile_id` | `unique (organization_id, profile_id)` |
| `team_members` | `profile_id` **nullable**, `on delete set null` | `unique (team_id, email)` — the roster key is the **email**, not the profile |
| `assessment_sessions` | `profile_id` | partial-unique on active attempts (§2.4) |
| `assessment_results` | `profile_id` | the historical record; also carries `team_id`, `team_series_id` and `*_at_completion` snapshots |
| `focus_sessions` / `focus_results` | `profile_id` | same shape |
| `combined_sessions` | `profile_id` | links one DISC + one Focus session |
| `report_exports` | `profile_id` | PDF/print export log |
| `notification_preferences` | `profile_id` | **`unique`** — one row per person |
| `notification_logs` | `profile_id`, `on delete set null` | also stores a denormalised `email` string |
| `coach_profiles` | `profile_id` **primary key** | one row per person |
| `entitlements` | `purchaser_id` | purchases |
| `team_creation_drafts` | `owner_profile_id` | |

### 2.2 Actor / authorship references (`on delete set null`, not ownership)

`teams.created_by` · `organizations.created_by` · `assessment_campaigns.created_by` ·
`invitations.invited_by` / `accepted_by` · `team_series.created_by` ·
`result_corrections.corrected_by` · `audit_logs.actor_id` ·
`ai_insight_narratives.generated_by` / `edited_by` / `shared_by`

These record *who did a thing*, not *whose data this is*. A reconciliation
should re-parent them too (so authorship survives), but a failure to do so is
cosmetic, not a data-integrity problem.

### 2.3 Derived surfaces — none introduce a second identity

| Surface | How it resolves a person |
|---|---|
| **My History** ([individual.ts](../lib/history/individual.ts)) | `.eq("profile_id", user.id)` under RLS. No profile-id parameter exists, so it cannot be asked for someone else's history |
| **Team history / analytics** ([team.ts](../lib/insights/team.ts)) | `team_members` → `profile_id[]` → results filtered by `team_id` |
| **Individual report / PDF** ([loader.ts](../lib/reports/loader.ts), `ecb2bef`) | `profile_id === user.id`, explicit, on top of RLS |
| **AI narratives** | `team_id`-scoped. Person columns are authorship only |
| **Audit records** | `actor_id` + free-form `metadata` jsonb |

**Consequence: a correct re-parent of `profile_id` automatically fixes every one
of these.** There is no second index of "who owns what" to keep in step.

### 2.4 Uniqueness constraints a merge can violate

These are the collision points, and the reason a merge needs a conflict
preflight rather than a bare `UPDATE`:

```
organization_members            unique (organization_id, profile_id)
team_members                    unique (team_id, email)        ← NOT (team_id, profile_id)
notification_preferences        unique (profile_id)
coach_profiles                  primary key (profile_id)
assessment_sessions_active_solo_uniq  (profile_id) WHERE in_progress AND team_id IS NULL
assessment_sessions_active_team_uniq  (profile_id, team_id) WHERE in_progress
focus_sessions_active_*_uniq          (same shape)
combined_sessions_active_*_uniq       (same shape)
```

Note the second line carefully. `team_members` has **no** unique constraint on
`(team_id, profile_id)`. Re-parenting will not error — it will silently produce
**two roster rows for the same person on the same team**, which then
double-counts that person in every team aggregate. This is the most likely way
to get a wrong number out of a merge, and it must be deduplicated explicitly.

---

## 3. What happens today in each scenario

| Scenario | Current behaviour | Verdict |
|---|---|---|
| Existing participant signs in with a different email | Supabase treats it as a new user → `on_auth_user_created` fires → **new `profiles` row, new UUID, empty history** | Root cause of duplicates |
| Google/Microsoft returns a different email | Identical. [callback/route.ts](../app/auth/callback/route.ts) only reads `profiles` by `user.id`; it never looks for an existing person | Root cause of duplicates |
| New email already has an `auth.users` row | Two independent identities coexist. Nothing links or detects them | Needs reconciliation |
| New email has a profile but no results | Same, but the merge is trivial (§7 simple path) | Low risk |
| Both identities contain results | Both hold real history. No tooling exists | The hard case, §8 |
| Identities belong to different teams | Both memberships are real and both must survive | Handled by union + dedupe |

**Root cause, stated plainly:** DISC360 never asks *"is this person already
known to us?"* at authentication time. Supabase's unit of identity is
`(provider, email)`; DISC360's unit of identity is `profiles.id`; nothing
bridges them. That gap is by design correct (auto-bridging on email is a
security hazard, §7 of the brief) — it just means the bridge has to be an
explicit, audited administrative action.

---

## 4. Where email is treated as identity today

Every one of these is in the **roster/invitation** layer, and every one is a
place where a changed email creates or strands a person.

| Location | Use | Risk after an email change |
|---|---|---|
| `team_members.unique (team_id, email)` | The roster's primary key in practice | The same person on one team under two addresses = two rows, double-counted |
| [join.ts:80](../lib/actions/join.ts) | `profiles.email` lookup to block duplicate sign-up | Misses the person if they now use a different address → new account |
| [join.ts:139](../lib/actions/join.ts), [onboarding.ts:146](../lib/actions/onboarding.ts), [invitations.ts:72,177](../lib/actions/invitations.ts) | Claim a pre-created roster entry **by email** | New address doesn't match the roster row → orphan roster entry + duplicate membership |
| [teams.ts:563](../lib/actions/teams.ts) | Find a pending invitation by email | Reminder goes to the retired address |
| [invitations/page.tsx:28](<../app/app/(shell)/invitations/page.tsx>) | "My invitations" matched on `profile.email` | Invitations sent to the old address disappear from the participant's view |
| [admin/submissions/[resultId]:48](../app/admin/submissions/[resultId]/page.tsx) | Delivery history joined on `notification_logs.email` | Report history splits across addresses |
| [admin/users:36](../app/admin/users/page.tsx) | Admin search `email ILIKE` | Old address finds nobody |
| **Team Summary recipients** (proposed feature) | Would read `team_members.email` | Would mail retired addresses. See §16 |

Two structural facts make this worse than it looks:

- **`profiles.email` has no unique constraint.** Two profiles may legitimately
  carry the same string today. Only `auth.users.email` is unique.
- **Nothing syncs `auth.users.email` → `profiles.email`.** Any email change
  must update both, in one operation, or report delivery breaks.

---

## 5. Proposed canonical identity model

Keep the canonical id exactly as it is. Add a **contact/credential layer**
beside it.

```
                    ┌──────────────────────────────────┐
                    │  profiles.id  ( = auth.users.id ) │   ← canonical, immutable
                    │  THE person. Never changes.      │
                    └───────────────┬──────────────────┘
                                    │ 1
                ┌───────────────────┼───────────────────────┐
                │ n                 │ n                     │ n
   ┌────────────▼──────────┐  ┌─────▼──────────┐   ┌────────▼─────────┐
   │ participant_identity_ │  │  results,      │   │ team_members,    │
   │ aliases               │  │  sessions,     │   │ org_members      │
   │  email                │  │  history       │   │                  │
   │  provider             │  └────────────────┘   └──────────────────┘
   │  status active|retired│
   │  retired_at, changed_by│      ownership — already correct today
   └───────────────────────┘
```

**Invariants**

1. `profiles.id` is the only identity. It never changes and never merges *into*
   anything — one of two ids survives, the other is retired.
2. Exactly one alias per profile has `status = 'active'`; it always equals
   `auth.users.email` and `profiles.email`. Enforced by a partial unique index.
3. A retired alias keeps pointing at the same profile forever. That is what
   makes old-email search work and what makes the trail auditable.
4. Nothing in the request path ever *resolves* a person from an alias. Aliases
   are for **admin search and audit only**. Authentication stays 100% Supabase's
   job. This is what keeps §7's "never auto-merge" guarantee structural rather
   than a matter of discipline.

### 5.1 Proposed tables (additive; not yet written)

```sql
-- Email/provider history for one canonical person.
create table public.participant_identity_aliases (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  email         text not null,
  provider      text not null default 'email',   -- email | google | azure
  status        text not null default 'active'   check (status in ('active','retired')),
  source        text not null default 'signup'   -- signup | admin_change | reconciliation | backfill
  created_at    timestamptz not null default now(),
  retired_at    timestamptz,
  changed_by    uuid references public.profiles (id) on delete set null
);
-- exactly one active address per person
create unique index identity_aliases_one_active
  on public.participant_identity_aliases (profile_id) where status = 'active';
-- an address may appear at most once as somebody's ACTIVE address
create unique index identity_aliases_active_email
  on public.participant_identity_aliases (lower(email)) where status = 'active';
create index identity_aliases_email_idx on public.participant_identity_aliases (lower(email));

-- One row per reconciliation, with the before/after evidence.
create table public.identity_reconciliations (
  id                     uuid primary key default gen_random_uuid(),
  canonical_profile_id   uuid not null references public.profiles (id) on delete cascade,
  retired_profile_id     uuid references public.profiles (id) on delete set null,
  action                 text not null,  -- email_change | reconcile
  status                 text not null default 'pending_auth',
                                         -- pending_auth | completed | failed | rolled_back
  old_email              text,
  new_email              text,
  counts_before          jsonb not null default '{}',
  counts_after           jsonb not null default '{}',
  conflicts_resolved     jsonb not null default '{}',
  performed_by           uuid not null references public.profiles (id),
  created_at             timestamptz not null default now(),
  completed_at           timestamptz
);
```

RLS on both: **super-admin select only**, no insert/update/delete from any
client. Writes happen exclusively inside the `security definer` functions of
§9. Participants never read these tables — an alias list is an admin artefact.

---

## 6. Simple email change (target address unused)

Preconditions checked server-side before anything is written:

- caller passes `requireSuperAdmin()`
- new email is valid + normalised (`lower(trim())`)
- new email has **no** `auth.users` row and **no** active alias
- new email ≠ current email

Then, in order:

1. `auth.admin.updateUserById(id, { email: new })` — **without**
   `email_confirm`, so Supabase sends a confirmation link and the auth email
   does not change until the participant clicks it (§10 option A).
2. On confirmation, a small callback updates `profiles.email`, retires the old
   alias and inserts the new active one.

Nothing about ownership moves. `profiles.id` is untouched; results, history,
memberships and reports are unaffected **by construction**, not by careful
copying.

> **Why verification here and not for reconciliation:** nobody has proven
> control of a never-before-seen address. Requiring the click costs nothing —
> if it is never clicked, the participant simply keeps their old login, which
> is a safe state.

---

## 7. Reconciliation — the second-account case

The participant has already signed in with the new address, so a second
`auth.users` + `profiles` pair exists.

**Crucially, control of the new address is already proven** — Supabase would
not have a confirmed account for it otherwise. That is what justifies
`email_confirm: true` here where §6 required a click.

### 7.1 Canonical choice

The admin chooses, always. The UI *recommends* the identity holding established
history (more results, older `created_at`) and shows the evidence for both, but
there is no default that fires without a selection and no automatic path.

### 7.2 Preflight (read-only, no writes)

`admin_preflight_identity_reconciliation(canonical uuid, retiring uuid)`
returns a full conflict report:

- counts per table for both identities (DISC / Focus / combined / memberships /
  exports / entitlements)
- **team overlap** — teams where both identities hold a `team_members` row
- **active-attempt collisions** — in-progress sessions that would violate the
  partial unique indexes
- **singleton collisions** — `notification_preferences`, `coach_profiles`
- whether either identity is `is_super_admin` (block: never merge an admin
  account implicitly)
- whether either is already `deactivated_at`
- a plain-English list of exactly what will change

The admin sees this before any button that writes exists on screen.

---

## 8. The hard case, worked through

```
Identity A (canonical)          Identity B (retiring)
  old.email@company.com           new.email@company.com
  3 DISC results                  1 DISC result
  2 Focus results                 0 Focus
  3 team memberships              1 team membership (Team D)
```

The reconciled end state is **one profile — A's UUID — owning 4 DISC results,
2 Focus results and 4 memberships**, signing in as `new.email@company.com`.

### 8.1 The operation is an UPDATE of a pointer, never an INSERT

```sql
update public.assessment_results set profile_id = A where profile_id = B;
update public.focus_results       set profile_id = A where profile_id = B;
-- …sessions, combined_sessions, report_exports, notification_logs, entitlements
```

That is the whole mechanism, and it satisfies the constraints one by one:

| Requirement | Why it holds |
|---|---|
| **No duplicated results** | `UPDATE`, not `INSERT`. Row count is conserved exactly; the preflight records it and the post-check asserts it |
| **No lost team attribution** | `assessment_results.team_id`, `team_series_id` and the `*_at_completion` snapshot columns are **not touched**. B's result stays attributed to Team D on the date it was taken. Team D's report still contains it |
| **No changed scores** | No score column appears in any statement. Enforceable as a post-condition: checksum of `(id, score_d, score_i, score_s, score_c, archetype_code, created_at)` over both identities' rows must be byte-identical before and after |
| **No changed dates** | `created_at` is never in the SET list |
| **No exposure of another person** | The merge is admin-initiated on two explicitly named UUIDs; nothing is inferred |
| **No RLS corruption** | RLS is `profile_id = auth.uid()`. After the update, `auth.uid()` for the surviving user equals A, and every re-parented row now reads `profile_id = A`. B's auth record is tombstoned so nobody can ever be B again |

### 8.2 Conflict resolution rules

| Conflict | Rule |
|---|---|
| Both on the same team (`team_members`) | Keep **one** row. Survivor = the stronger role (`team_admin` > `member`), tie broken by earlier `created_at`. Delete the other. Recorded in `conflicts_resolved`. *This is mandatory — there is no unique index to catch it* |
| Team only B is on (Team D) | Re-parent the row. `team_members.email` is also updated to the canonical address so the roster key stops pointing at a retired alias |
| Both `organization_members` in one org | Same rule; `unique (organization_id, profile_id)` would otherwise raise |
| Both hold an in-progress session in the same scope | The **retiring** identity's session is marked `abandoned` before the re-parent, so the partial unique index is satisfied. An unfinished attempt is the only thing this operation discards, and it is surfaced in the preflight |
| `notification_preferences` | Keep A's. Delete B's (do not move) |
| `coach_profiles` | Keep A's if present; otherwise re-parent B's |
| `attempt_number` | **Left exactly as stored.** See below |

### 8.3 `attempt_number` — deliberately not renumbered

[snapshot.ts:77](../lib/history/snapshot.ts) sets `attempt_number` from the
count of prior results at completion time. After a merge the sequence can show
`1, 2, 3` (from A) interleaved with `1` (from B).

Renumbering would be a rewrite of historical rows, which the brief forbids
without an explicit plan — and it would be *wrong*: the value records what was
true when the assessment was taken.

**Recommendation:** leave stored values untouched; My History already orders by
`created_at`, so the timeline is correct regardless. The reconciliation record
notes that attempt numbers are non-contiguous for this profile. If a contiguous
sequence is later wanted, it should be a *derived* display value
(`row_number() over (partition by profile_id, kind order by created_at)`), not
a mutation.

### 8.4 Future retakes (§14 of the brief)

After reconciliation, a new attempt is created under A. `buildResultSnapshot`
counts A's prior results — which now include B's — so the new row continues the
series naturally. May / July / August all sit under one `profile_id` and appear
in one chronological My History. Nothing extra is required.

---

## 9. Supabase Auth strategy

### 9.1 What the platform does and does not allow

| Capability | Available? |
|---|---|
| Change an auth user's email | ✅ `auth.admin.updateUserById(id, { email })` |
| Apply it without a confirmation mail | ✅ `{ email_confirm: true }` |
| **Change an auth user's UUID** | ❌ Not possible |
| **Move an identity row between users** | ❌ No admin API |
| Link a new provider to the *signed-in* user | ⚠️ `linkIdentity()` only, user-initiated, requires manual linking enabled — not an admin tool |
| Delete a user | ✅ — and it **cascades to `profiles` and every result**. Effectively forbidden here |

Because the UUID is immovable, reconciliation **must** re-parent application
rows. There is no alternative, and §8 shows that re-parenting is safe.

### 9.2 Retire, do not delete

B's auth user is **tombstoned**, never deleted:

- `updateUserById(B, { email: 'retired+<B-uuid>@identity.disc360.invalid' })`
  — frees the real address so it can be assigned to A
- `profiles.deactivated_at = now()` on B — `requireUser()` already signs out and
  blocks any deactivated profile ([guards.ts](../lib/auth/guards.ts))
- B's row survives with **zero owned rows**, preserving the audit trail

Deleting would cascade through `profiles` into `assessment_results`. Given that
the entire purpose here is to preserve history, deletion is off the table.

### 9.3 Ordering — every intermediate state must be recoverable

This is the most important paragraph in the document. Supabase's JS client
cannot wrap Auth mutations and SQL in one transaction, so the sequence is
ordered such that **any failure leaves the participant able to sign in and see
all of their data**:

```
1. Preflight            read-only. no writes.                    ← abort is free
2. Admin confirms       types the canonical email to confirm
3. SQL transaction      ← single security-definer RPC, atomic
      a. assert neither profile is super_admin / already retired
      b. capture counts_before
      c. abandon conflicting in-progress sessions
      d. re-parent every owner + authorship reference B → A
      e. dedupe team_members / organization_members
      f. drop B's notification_preferences, tombstone B's profile
      g. assert zero rows anywhere still reference B   ← hard failure → ROLLBACK
      h. assert score/date checksum unchanged          ← hard failure → ROLLBACK
      i. write aliases + identity_reconciliations(status='pending_auth')
4. Auth mutation        tombstone B's email, then set A's email
5. SQL finalise         profiles.email = new, status='completed'
```

If step 4 fails, the state is: **A owns everything; A still signs in with the
old address.** The person is not locked out and has lost nothing. The admin UI
surfaces a "complete authentication step" retry against the `pending_auth`
record. That is a deliberate choice — the failure mode is a stale login
address, never inaccessible history.

Step 3 is one Postgres transaction, so partial re-parenting cannot happen: the
`g`/`h` assertions run inside it and roll the whole thing back.

---

## 10. Email verification policy

| Case | Policy | Rationale |
|---|---|---|
| Target address has **no** confirmed auth account (§6) | **Require verification.** `updateUserById` without `email_confirm`; Supabase mails the link | Nobody has proven control. Unclicked = participant keeps the old login = safe |
| Target address **already has** a confirmed auth account (§7/§8) | **Admin-confirmed.** `email_confirm: true` | Control was already proven — the person authenticated with it. Re-verifying an address someone is already logged into adds ceremony, not safety |

Documented in the admin UI at the point of action, not only here.

---

## 11. RLS strategy

**No RLS policy changes.** Every existing predicate is `profile_id = auth.uid()`
and continues to be correct after a re-parent — that is precisely why
re-parenting is the right mechanism.

Post-conditions asserted **inside** the transaction:

| Guarantee | Assertion |
|---|---|
| No orphaned results | `select count(*) … where profile_id = B` = 0 across every owner table |
| No inaccessible history | A's post-count = A's pre-count + B's pre-count, per table |
| No duplicate memberships | `select team_id, count(*) from team_members where profile_id = A group by 1 having count(*) > 1` = ∅ |
| No cross-user access | B tombstoned + deactivated; `requireUser()` signs out any deactivated profile |
| No stale ownership | The `where profile_id = B` sweep covers every table enumerated in §2.1 and §2.2 — verified against `information_schema` in the migration test, so a future table added without being re-parented fails the test rather than silently stranding rows |

New tables get super-admin-only policies. Participants gain no new read surface
whatsoever.

---

## 12. Transaction and rollback strategy

- **Step 3 is atomic.** A `security definer` plpgsql function; any raised
  exception rolls back the entire re-parent.
- **`counts_before` is captured inside the transaction**, so the audit record
  cannot disagree with what actually happened.
- **Compensating action for step 4/5.** If Auth fails, the record stays
  `pending_auth` and is retryable. Nothing needs undoing.
- **Reversal window.** Because B is tombstoned rather than deleted and
  `identity_reconciliations` stores both ids, a mistaken merge is reversible:
  re-parent back the rows created before `completed_at`. This is a manual,
  audited super-admin operation, not a one-click undo — reversal is rarer than
  the mistake it fixes and deserves the same deliberation.
- **Pre-flight backup.** The rollout plan (§15) takes a Supabase point-in-time
  snapshot immediately before the first production reconciliation.

---

## 13. Audit trail

Every identity change writes **both**:

1. an `identity_reconciliations` row — the structured evidence
   (`counts_before` / `counts_after` / `conflicts_resolved`, canonical id,
   retired id, both addresses, `performed_by`, timestamps, status);
2. an `audit_logs` row — `identity.email_changed` / `identity.reconciled`,
   `entity_type = 'profile'`, `entity_id = canonical`, with safe metadata.

Never logged: passwords, tokens, session data, magic links, or any assessment
content. The brief's required field list maps one-to-one onto the schema in
§5.1.

---

## 14. Platform Admin UX

Lives at `/admin/users/[userId]` — already `requireSuperAdmin()`-gated
([admin/users](../app/admin/users/)). **Team facilitators get nothing.** Team
admin scope is `is_team_admin()`; this is `is_super_admin()`, a different check
entirely, and no membership role grants it.

Terminology follows §19 of the brief — "Manage identity", "Link login",
"Reconcile identity"; never "Merge users".

```
┌─ Manage identity ─────────────────────────────────────────────┐
│                                                               │
│  Prince Okafor                                                │
│                                                               │
│  Current sign-in     prince.new@company.com     (verified)    │
│  Previous            prince.old@company.com                   │
│                      changed 07 Aug 2026 · Platform Admin     │
│                                                               │
│  Results   DISC 3  ·  Focus 2  ·  Combined 1                  │
│  Teams     Applications & ERP · Enterprise Architecture       │
│                                                               │
│  [ Change sign-in email ]  [ Link another login ]             │
│  [ Review identity history ]                                  │
└───────────────────────────────────────────────────────────────┘
```

**Reconciliation is a three-step wizard, and nothing writes before step 3.**

```
Step 1 — Choose            Step 2 — Review               Step 3 — Confirm
─────────────────          ──────────────────            ─────────────────
IDENTITY A  ○ canonical    Authentication                CONFIRM IDENTITY
prince.old@company.com       new@company.com                RECONCILIATION
3 DISC · 2 Focus · 2 teams   → canonical participant
created 10 May 2026                                      Type the canonical
                           History preserved             email to confirm:
IDENTITY B  ○ canonical      3 DISC → 4 DISC             ┌──────────────┐
prince.new@company.com       2 Focus → 2 Focus           │              │
1 DISC · 0 Focus · 1 team    1 Combined → 1 Combined     └──────────────┘
created 07 Aug 2026
                           Memberships  3 → 4            [Back]
Recommended: Identity A      (1 duplicate on Team X      [Confirm reconciliation]
(holds established history)   will be merged)

                           ⚠ 1 in-progress attempt on
                             Identity B will be
                             abandoned

                           Duplicate profile
                             retired, not deleted
```

Design constraints, stated as rules:

- **No merge control is reachable without a completed preflight.** The confirm
  button does not render until the conflict report has been read.
- **Typed confirmation** of the canonical email — no misclick can merge two
  people.
- **Hard blocks:** either identity is `is_super_admin`; either is already
  retired; the two ids are equal.
- **No candidate is ever pre-selected by name, domain or similarity.** The
  admin picks both ids explicitly. Suggestion-by-similarity is deliberately
  omitted — it is the exact affordance §7 of the brief warns against.

### 14.1 Search (§12/§15)

`/admin/users` gains an alias-aware search: `profiles.full_name`,
`profiles.preferred_name`, `profiles.email`, **plus**
`participant_identity_aliases.email` (including retired). A hit on a retired
alias returns the canonical person, badged:

```
Prince Okafor    prince.new@company.com    [ matched previous email ]
```

Never a dead profile, never a second row.

---

## 15. Migration proposal — **not written, not applied**

Strictly additive. **No existing row is modified, no column dropped, no
constraint changed, no historical value rewritten.**

`00022_identity_reconciliation.sql` would add:

1. `participant_identity_aliases` + 3 indexes
2. `identity_reconciliations`
3. RLS on both — super-admin select only
4. `admin_preflight_identity_reconciliation(uuid, uuid)` — **read-only**
5. `admin_reconcile_identity(...)` — the atomic transaction of §9.3
6. `admin_change_signin_email(...)`
7. **Backfill:** one `status='active'`, `source='backfill'` alias per existing
   profile, from `profiles.email`. This inserts into a brand-new table only —
   it touches no existing row

Also proposed, and worth calling out separately because it is the one change
that affects existing behaviour:

8. a trigger keeping `profiles.email` in step with `auth.users.email` on
   UPDATE. Today they can silently diverge, which would break report delivery
   (§0). **This should be reviewed on its own merits** — it is a correctness
   fix that happens to be adjacent, not part of reconciliation.

**Nothing above will be applied to hosted Supabase without your explicit
approval**, and per the deployment history `supabase db push --linked` is
yours to run, not mine.

---

## 16. Does Team Summary delivery resolve through this layer?

**Yes — and it needs to.**

Today a recipient list would come from `team_members.email`, a roster string
captured at join time that nothing keeps current. After any email change it
points at a retired address. The canonical layer gives that feature a correct
answer:

```
for each team_members row on the team:
    profile_id present  →  profiles.email        (canonical, current)
    profile_id null     →  team_members.email    (unclaimed roster entry)
                           flagged "not yet joined"
```

This satisfies §13 of the Team Summary brief directly: current reconciled email
used, retired aliases never used by default, and undeliverable recipients
identifiable up front ("3 participants have no deliverable email address").

**Sequencing recommendation:** land identity first. Building Team Summary on
`team_members.email` would ship a recipient resolver that has to be rewritten
the moment reconciliation exists.

---

## 17. Tests required

**Pure / unit** (`node --test`, colocated)
- email normalisation + validation (reuse [identity.ts](../lib/reports/identity.ts) — already tested at `ecb2bef`)
- alias-state machine: exactly one active alias; retiring is idempotent
- canonical recommendation is a *suggestion* with no side effect
- conflict classifier: team overlap, active-attempt collision, singleton collision

**Database / integration** (local stack, seeded fixtures)
- ✓ simple change on an unused email preserves every row
- ✓ same profile id retains all results
- ✓ second login reconciled into an established participant
- ✓ **result count conserved exactly** — no duplication
- ✓ **score/date checksum byte-identical before and after** (scoring-freeze)
- ✓ memberships preserved; union of teams; duplicates collapsed to one
- ✓ team-specific historical context (`team_id`, `team_series_id`,
  `*_at_completion`) unchanged
- ✓ My History intact and chronologically correct
- ✓ new assessment after reconciliation appends to the same history
- ✓ old email locates the participant in admin search, badged as previous
- ✓ zero rows reference the retired profile — swept from
  `information_schema`, so a future table cannot be forgotten
- ✓ rollback on induced failure at each assertion point leaves the DB unchanged
- ✓ super-admin identity cannot be reconciled
- ✓ audit + reconciliation rows written for every change

**Playwright**
- the brief's 11-step scenario end to end: complete DISC as A → join team →
  report exists → create B → reconcile → sign in as B's address → see A's
  result → see the original team → **My History shows the original assessment
  once, not twice** → complete another → both appear chronologically
- ✗ a team facilitator (team_admin, not super_admin) cannot reach any identity
  surface
- ✗ Participant A and Participant B are never merged without explicit
  double-confirmation
- ✓ **participant report access from `ecb2bef` still works after
  reconciliation** — view, download PDF, email report, all under the canonical
  identity

**Gates:** ESLint · TypeScript · unit + scoring-freeze · production build ·
Playwright.

---

## 18. Rollout and rollback

**Rollout**
1. Apply `00022` to local, run the full gate.
2. Pre-flight read-only production counts: duplicate-name profiles,
   profiles sharing an email string, teams with two rows for one person.
   Establishes the real blast radius before anything runs.
3. You apply the migration to hosted Supabase (`db push --linked`), then
   `supabase migration list --linked` to confirm.
4. Verify the backfill: one active alias per profile, count matches
   `profiles`.
5. Ship the admin UI **read-only first** — "Manage identity" panel showing
   current/previous emails and counts, with the action buttons disabled. Lets
   you inspect the real graph before any write path is live.
6. Enable the write paths. First real reconciliation performed with a
   point-in-time snapshot taken immediately beforehand.

**Rollback**
- Migration is additive: dropping the two tables and three functions returns
  the schema exactly to `ecb2bef`. No existing row was touched, so nothing
  needs restoring.
- The optional email-sync trigger (§15.8) drops independently.
- A completed reconciliation is reversed by re-parenting back from the stored
  `identity_reconciliations` row and reactivating the tombstoned profile —
  possible precisely because nothing was deleted.
- Worst case: Supabase point-in-time restore.

---

## 19. Recommendation

Proceed, in this order:

1. `00022` migration — additive tables, RLS, preflight + reconcile functions,
   alias backfill. **Reviewed by you before it is applied anywhere.**
2. `profiles.email` ↔ `auth.users.email` sync — reviewed separately; it is a
   standing correctness bug, not a reconciliation feature.
3. Admin UI read-only, then the change-email flow, then reconciliation behind
   preflight + typed confirmation.
4. Test suite as §17, including the `ecb2bef` regression pass.
5. Team Summary delivery afterwards, resolving recipients through §16.

The core reassurance from this audit: **the canonical identity model is already
right.** Every result, session and membership already points at a stable UUID,
and every RLS policy already keys on it. What is missing is history for the
contact layer and a safe, audited tool for the case where one person ended up
with two of them.
