-- ─────────────────────────────────────────────────────────────────────
-- Wellbeing Pulse — an OPERATIONAL campaign lifecycle a facilitator drives.
--
-- WHAT WAS WRONG IN PRODUCTION.
--
-- A facilitator opening a freshly created campaign was told
--
--     Closed — "Joining is switched off. Existing responses are unaffected."
--
-- with no control anywhere in the product to switch it on, while the campaign
-- was in fact admitting participants perfectly well. Two different facts were
-- being read as one:
--
--   · `wellbeing_campaigns.status` — what actually decides admission, via
--     `wellbeing_campaign_admits()` and `wellbeing_campaign_by_token()`.
--   · `teams.join_enabled` — a DISC concept. The roster team behind a
--     wellbeing campaign is created with `join_enabled = false` ON PURPOSE, so
--     that `resolve_join_token` can never deliver a wellbeing participant into
--     the DISC assessment. The facilitator's status panel read THAT flag and
--     reported the deliberate DISC lock as the campaign being closed.
--
-- So the displayed lifecycle described a safeguard, not the campaign. This
-- migration makes `wellbeing_campaigns.status` the single authority and gives
-- the lifecycle the one state it was missing.
--
-- THE LIFECYCLE.
--
--   draft   — prepared, not yet admitting. Deliberate; never the default.
--   active  — OPEN. Participants can join.
--   paused  — temporarily not admitting. Responses already given are
--             untouched, and the facilitator can resume.
--   closed  — ended. Historical data retained.
--   archived— off the working list, kept for the record.
--
-- NOTHING HERE DELETES A RESPONSE. Pausing, closing, reopening and archiving
-- are status transitions on this row alone; no statement in this product's
-- lifecycle path touches `wellbeing_sessions`, `wellbeing_responses` or
-- `wellbeing_results`, and `lib/wellbeing/campaign-lifecycle.test.ts` asserts it.
--
-- WHY `paused` IS SAFE TO ADD TO THE ENUM.
--
-- Every existing consumer refuses anything that is not `active`:
--   · `wellbeing_campaign_admits()`  — `when c.status <> 'active' then false`
--   · `wellbeing_campaign_by_token()` — `is_open = (c.status = 'active' and …)`
-- so a paused campaign fails closed the moment the value exists, before any
-- application code learns the word. The new value is deliberately NOT used in
-- this migration: `ALTER TYPE … ADD VALUE` may not be referenced in the
-- transaction that adds it.
-- ─────────────────────────────────────────────────────────────────────

alter type public.wellbeing_campaign_status add value if not exists 'paused' after 'active';

-- ── when each transition happened ────────────────────────────────────
--
-- `closed_at` already existed. These two complete the record so the
-- facilitator panel can say "paused on 12 March" rather than only "paused",
-- and so an audit reader can reconstruct a campaign's operational history from
-- the row itself as well as from `audit_logs`.
alter table public.wellbeing_campaigns
  add column if not exists opened_at timestamptz,
  add column if not exists paused_at timestamptz;

comment on column public.wellbeing_campaigns.opened_at is
  'When the campaign most recently began admitting participants. Set on creation for a campaign that opens immediately, and again on every resume/reopen.';
comment on column public.wellbeing_campaigns.paused_at is
  'When joining was most recently paused. Cleared on resume. Never affects stored responses.';

-- Every campaign that exists today was created `active` and has been admitting
-- since it was created, so that is its true opening moment.
update public.wellbeing_campaigns
   set opened_at = created_at
 where opened_at is null
   and status = 'active';

comment on column public.wellbeing_campaigns.status is
  'THE authority on whether this campaign admits participants. teams.join_enabled is a DISC invitation flag and is deliberately false for every wellbeing roster — it must never be read as a wellbeing lifecycle state.';

-- ── the status index has to cover the whole working set ──────────────
--
-- The partial index was `where status = 'active'`, which is exactly the rows a
-- facilitator's campaign list does NOT need help finding — the list is
-- "everything I am running", and a paused or draft campaign is the one a
-- facilitator is looking for.
drop index if exists public.wellbeing_campaigns_status_idx;
create index wellbeing_campaigns_status_idx
  on public.wellbeing_campaigns (organization_id, status);

do $$ begin
  raise notice 'wellbeing campaign lifecycle: paused added; status is the single authority on admission';
end $$;
