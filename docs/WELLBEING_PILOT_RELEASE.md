# Wellbeing Pilot — release order for 00033–00037

Written after the Step 4 production acceptance failed. It records what depends
on what, why the earlier staged plan is no longer the safe one, and the order
that is.

**Nothing here has been applied.** Hosted migration history is `00001`–`00032`.

## The situation this order has to survive

The production code is **already deployed** and calls schema that is **not yet
applied**. That is the wrong way round, and it is why the pilot's invitation
currently reads "Not open yet" for everybody:

| Deployed code | Needs | Applied? |
|---|---|---|
| `lib/wellbeing/analytics.ts` → `wellbeing_participant_counts(p_wave…)` | 00034 (via 00033) | no |
| `lib/wellbeing/readiness.ts` → `wellbeing_sub_units` | 00035 | no |
| `lib/wellbeing/snapshot.ts` → `sub_unit_at_completion` | 00035 | no |
| `lib/join/context.ts` → `wellbeing_join_context()` | 00036 | no |

So the migrations are not a new feature to schedule; they are the missing half
of what is already live. Applying them is the repair, not the risk.

## Dependency graph

```
00032  campaign type + trigger            ── APPLIED (and left the pilot mislabelled)
  │
  ├── 00037  type integrity ──────────────── replaces 00032's trigger function;
  │            · corrected backfill           adds teams.wellbeing_conversion_blocked_reason
  │            · refuses real DISC history    + the check constraint
  │            · fails loudly
  │
  └── 00036  wellbeing_join_context() ────── reads teams.assessment_type = 'wellbeing'
               ↑ FUNCTIONAL dependency on 00037: without the corrected
                 backfill this RPC returns nothing for the pilot, because the
                 pilot is still typed 'disc'.

00030  wellbeing_participant_counts(uuid, text)
  │
  └── 00033  …(uuid, text, uuid)  ────────── drops and recreates the 00030 signature
        │
        └── 00034  …(uuid, text, uuid, uuid) ── drops and recreates 00033's signature
                     + wellbeing_waves, wave columns on sessions/results
             ↑ HARD dependency: 00034 drops the exact signature 00033 creates.
               Applying 00034 without 00033 fails.

00035  wellbeing_sub_units ──────────────── independent table; adds sub-unit
                                             columns to wellbeing_sessions and
                                             wellbeing_results. No dependency on
                                             00033/00034/00036/00037.
```

Two independent chains, plus one standalone:

- **type chain** — 00032 → 00037, with 00036 functionally downstream of 00037
- **counts chain** — 00030 → 00033 → 00034 (strictly ordered, signature churn)
- **standalone** — 00035

Numeric order satisfies every edge, so `00033 → 00034 → 00035 → 00036 → 00037`
is valid. The only real freedom is where the **data** remediation sits.

## Recommended order

Option **B**, amended — schema first, remediation last:

1. **Deploy the code fix** (this branch). It is safe against the current
   database: the routing and consent changes touch no new schema, and the
   readiness fix makes the missing tables report as *infrastructure activating*
   instead of falsely telling a facilitator to add a Sub-unit value.
2. **Apply 00033 → 00034 → 00035 → 00036 → 00037**, in one sitting, in numeric
   order. After this the pilot is typed `wellbeing` by 00037's corrected
   backfill, and readiness passes.
3. **Verify** the acceptance flow against the real token before touching any
   participant data.
4. **Run the remediation** — `supabase/remediations/00001_pilot_stray_session.sql`
   — to remove the empty DISC session shell.

### Why not option A (repair the artefact first)

Deleting the stray session first would let 00032's *original* backfill convert
the pilot, which sounds tidier and is worse in two ways. It repairs one row
while leaving the rule that mislabelled it intact, so the next campaign that
acquires a session shell drifts the same way. And it performs a production
deletion **before** the code that makes the deletion unnecessary is in place —
if anything goes wrong mid-sequence, a participant row has already gone.

Under option B the deletion is last, optional to the correctness of the
product, and reversible in the only sense that matters: by then nothing depends
on it.

### Why the remediation is still worth running

00037 converts the pilot whether or not the shell is removed. The shell is
removed because a DISC session attached to a wellbeing campaign is a resumable
DISC assessment offered to a wellbeing participant — untrue, and confusing on
any surface that lists it.

## What is verified, and where

| Claim | Proof |
|---|---|
| all 37 migrations apply to an empty database | `npx supabase db reset` |
| the pilot converts; participant, membership, campaign survive | `scripts/verify-campaign-conversion.sql` — CASE A |
| a team with real DISC history is refused, and keeps every result | same — CASE B |
| the silent state is unrepresentable | same — check constraint, trigger disabled |
| the remediation removes exactly one row | `supabase/remediations/00001_pilot_stray_session.sql`, before/after counts |
| it refuses a database it was not audited against | same, exit 3 |
| individual wellbeing results stay private to the participant | `scripts/verify-wellbeing-privacy.sql` |

## Rollback

- **00037** — `alter table public.teams drop constraint teams_wellbeing_type_is_explicit;`
  `alter table public.teams drop column wellbeing_conversion_blocked_reason;`
  then restore 00032's `enforce_wellbeing_campaign_type()` body.
- **00036** — `drop function public.wellbeing_join_context(uuid);`
- **00035** — additive; drop the table and the two snapshot columns.
- **00034 / 00033** — recreating an earlier `wellbeing_participant_counts`
  signature means rolling both back together, in reverse order.

The type conversion itself is data, not schema: rolling 00037 back does not
re-label the pilot as DISC, and should not.
