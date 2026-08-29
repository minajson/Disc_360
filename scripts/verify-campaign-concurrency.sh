#!/usr/bin/env bash
#
# The last place in a campaign can be taken exactly once — proven with two
# genuinely concurrent connections.
#
# ─────────────────────────────────────────────────────────────────────
# WHY THIS CANNOT BE A SQL HARNESS.
#
# `scripts/verify-campaign-pinning.sql` proves a full campaign refuses a new
# participant. It does so in ONE transaction, sequentially — which is the case
# that was never in doubt. The case that matters is two participants tapping
# "start" at the same instant: both read "one place left", both pass any check
# the application could make, and both insert.
#
# A single connection cannot exhibit that. This needs two, overlapping.
#
# WHAT MAKES IT SAFE.
#
# 00047's trigger takes `FOR UPDATE` on the campaign row BEFORE counting, so
# the second transaction blocks until the first commits and then counts a
# world that includes it. Without the lock both would count zero and both would
# be admitted.
#
# Everything is created under fixed markers and removed at the end, including
# on failure — see the trap.
# ─────────────────────────────────────────────────────────────────────
set -uo pipefail

DB="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
MARK="concurrency-harness"
TOKEN="concurrency-harness-token-00000001"

# `insert ... returning` prints the value AND the command tag ("INSERT 0 1") on
# the next line. Only the first line is the value; feeding the tag onward turns
# every later interpolation into invalid SQL, silently.
# `insert ... returning` prints the value AND the command tag ("INSERT 0 1") on
# the next line. Only the first line is the value; feeding the tag onward turns
# every later interpolation into invalid SQL, silently.
#
# And a failed fixture must STOP the run rather than yield an empty string that
# reappears as `campaign_id=''` fifty lines later — which is a real failure
# wearing the costume of a syntax error.
q() {
  local out
  if ! out=$(psql "$DB" -v ON_ERROR_STOP=1 -t -A -c "$1" 2>&1); then
    echo "FIXTURE FAILED: $1" >&2
    echo "$out" >&2
    exit 1
  fi
  printf '%s' "$out" | head -1
}

# Removes everything this harness creates, in dependency order.
#
# By ORGANISATION rather than by token: an interrupted run leaves a campaign
# whose token differs, and `organizations` is `on delete restrict` from both
# teams and campaigns — so a name-only delete silently fails and the next run
# accumulates another organisation instead of reusing one.
teardown() {
  psql "$DB" -q -c "
    delete from wellbeing_sessions where organization_id in
      (select id from public.organizations where name = '$MARK');
    delete from wellbeing_campaigns where organization_id in
      (select id from public.organizations where name = '$MARK');
    delete from team_members where team_id in
      (select id from teams where organization_id in
        (select id from public.organizations where name = '$MARK'));
    delete from teams where organization_id in
      (select id from public.organizations where name = '$MARK');
    -- Organisations BEFORE identities: organizations.created_by references a
    -- profile with ON DELETE RESTRICT, so deleting the actor first fails, which
    -- fails the auth.users delete behind it, which leaves the whole fixture in
    -- place and makes the next run collide on the email unique index.
    delete from public.organizations where name = '$MARK';
    delete from auth.users where email like 'conc-%@harness.invalid';
    delete from public.profiles where email like 'conc-%@harness.invalid';
  " >/dev/null 2>&1
}
trap teardown EXIT

teardown  # clear anything a killed earlier run left behind

# ── fixtures ─────────────────────────────────────────────────────────
for i in 1 2 3; do
  q "insert into auth.users
       (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
             'authenticated','authenticated','conc-$i@harness.invalid',
             'HARNESS-NO-LOGIN', null, now(), now(),
             '{\"provider\":\"email\",\"providers\":[\"email\"]}'::jsonb,
             jsonb_build_object('full_name','Conc $i'))" >/dev/null
done

ACTOR=$(q "select id from public.profiles where email='conc-1@harness.invalid'")
P1=$(q "select id from public.profiles where email='conc-2@harness.invalid'")
P2=$(q "select id from public.profiles where email='conc-3@harness.invalid'")
ORG=$(q "insert into public.organizations (name, created_by) values ('$MARK','$ACTOR') returning id")
VER=$(q "select id from wellbeing_versions where instrument_key='disc360_wellbeing_v1' and is_active")
TEAM=$(q "insert into teams (organization_id, name, team_code, created_by, assessment_type,
                             wellbeing_instrument_key, join_enabled)
          values ('$ORG','Concurrency','CONC-0001','$ACTOR','wellbeing','disc360_wellbeing_v1',false)
          returning id")
CAMP=$(q "insert into wellbeing_campaigns
            (organization_id, instrument_key, version_id, created_by, name, status,
             participant_capacity, join_token, team_id)
          values ('$ORG','disc360_wellbeing_v1','$VER','$ACTOR','Concurrency','active',
                  1,'$TOKEN','$TEAM')
          returning id")

echo "campaign $CAMP created with capacity 1"

# ── the race ─────────────────────────────────────────────────────────
#
# Both transactions open, pause on the SAME clock, then insert. The pause is
# inside the transaction and before the insert, so the two inserts genuinely
# overlap rather than one simply finishing first.
attempt() {
  local profile="$1" out="$2"
  psql "$DB" -v ON_ERROR_STOP=1 -q -c "
    begin;
    select pg_sleep(1);
    insert into wellbeing_sessions
      (profile_id, version_id, instrument_key, campaign_id, team_id, organization_id,
       consent_given, consent_at)
    values ('$profile','$VER','disc360_wellbeing_v1','$CAMP','$TEAM','$ORG', true, now());
    commit;
  " >"$out" 2>&1
  echo "$?" >>"$out"
}

A=$(mktemp) ; B=$(mktemp)
attempt "$P1" "$A" &
attempt "$P2" "$B" &
wait

STATUS_A=$(tail -1 "$A"); STATUS_B=$(tail -1 "$B")
echo "--- attempt A (exit $STATUS_A) ---"; sed '$d' "$A"
echo "--- attempt B (exit $STATUS_B) ---"; sed '$d' "$B"

ADMITTED=$(q "select count(distinct profile_id) from wellbeing_sessions where campaign_id='$CAMP'")
# Count FILES that carry the marker, not matching lines and not both at once —
# `grep -lc` combines two flags that mean different things and reports neither.
CAPACITY_ERRORS=0
for f in "$A" "$B"; do
  grep -q "CAMPAIGN_CAPACITY_REACHED" "$f" && CAPACITY_ERRORS=$((CAPACITY_ERRORS + 1))
done
rm -f "$A" "$B"

echo
echo "distinct participants admitted: $ADMITTED (capacity 1)"
echo "attempts refused for capacity  : $CAPACITY_ERRORS"

FAILED=0
[ "$ADMITTED" = "1" ] || { echo "FAIL — capacity 1 admitted $ADMITTED participants"; FAILED=1; }
[ "$CAPACITY_ERRORS" = "1" ] || { echo "FAIL — expected exactly one capacity refusal, got $CAPACITY_ERRORS"; FAILED=1; }

if [ "$FAILED" = "0" ]; then
  echo
  echo "PASS — two simultaneous admissions, exactly one place taken, one refused by the database"
fi
exit "$FAILED"
