-- What a Wellbeing Pulse invitation may say before anybody has signed in.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHY THIS EXISTS.
--
-- The invitation is the first thing a person sees after scanning a printed
-- code, and they have no account yet. To be honest with them it has to name
-- the questionnaire they are being asked to complete and roughly how long it
-- takes — "twelve questions, about two to three minutes" is the difference
-- between agreeing and closing the page.
--
-- That information lives on `teams.wellbeing_instrument_key`, and `teams` is
-- correctly unreadable to an anonymous visitor. Rather than widen that policy
-- — which would expose every team's configuration to the world — this returns
-- exactly two fields, for exactly one token, from inside the database.
--
-- WHY NOT EXTEND resolve_join_token.
--
-- That function is on the DISC join path in production right now. Adding an
-- output column changes its return type, which means dropping and recreating
-- it, which means a window where the ordinary join is broken. A separate
-- function is additive, independently revocable, and cannot affect DISC.
--
-- WHAT IT DELIBERATELY DOES NOT RETURN.
--
-- No participant, no member, no count, no result, no score, no organisation
-- id, no team id. A caller who guesses a token learns the questionnaire and
-- the facilitator's display name — which is what the printed invitation next
-- to the code already says out loud.
--
-- Rollback: `drop function public.wellbeing_join_context(uuid);`
-- ─────────────────────────────────────────────────────────────────────

create function public.wellbeing_join_context(p_token uuid)
returns table (instrument_key text, facilitator_name text)
language sql
stable
security definer
set search_path = public
as $$
  select t.wellbeing_instrument_key, t.facilitator_name
  from public.teams t
  where t.invite_token = p_token
    -- Only for a wellbeing campaign, and only while it is joinable. A DISC
    -- team's token returns nothing at all, so this cannot become a general
    -- team-configuration oracle.
    and t.assessment_type = 'wellbeing'
    and t.archived_at is null
    and t.join_enabled;
$$;

revoke all on function public.wellbeing_join_context(uuid) from public;
-- `anon` deliberately: the invitation is public by necessity — it is what a
-- printed QR code resolves to, for someone who has no account yet.
grant execute on function public.wellbeing_join_context(uuid) to anon, authenticated, service_role;

comment on function public.wellbeing_join_context(uuid) is
  'Participant-safe context for a Wellbeing Pulse invitation: the configured instrument and the facilitator name. Returns nothing for a DISC team, an archived campaign or a closed one.';
