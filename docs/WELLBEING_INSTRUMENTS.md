# Wellbeing Pulse — instrument reference

Factual reference for management evaluation. Compiled from the instrument
registry (`data/wellbeing-instruments.ts`) and the four scoring engines, so
every figure here is the figure the product actually uses.

**This document makes no recommendation and no marketing claim.** Choosing an
instrument is a governance decision with clinical and legal dimensions that
this reference cannot weigh.

**Status of third-party content:** GHQ-12, GHQ-28 and WHO-5 questionnaire
wording is **not present in this repository**. Their engines, structures,
history models and analytics are complete and tested; only the item text is
withheld pending confirmation of digital-use rights. DISC360 Wellbeing Pulse
V1 is original DISC360 content and is fully active.

---

## At a glance

| | GHQ-12 | GHQ-28 | WHO-5 | DISC360 Wellbeing V1 |
|---|---|---|---|---|
| Publisher | Goldberg & Williams (GL Assessment) | Goldberg & Hillier (GL Assessment) | World Health Organization | DISC360 |
| Measures | Psychological distress | Psychological distress + profile | Positive wellbeing | Workplace wellbeing reflection |
| Items | 12 | 28 | 5 | 12 |
| Response options | 4 | 4 | 6 | 5 |
| Time | 2–3 min | 5–7 min | 1–2 min | 2–3 min |
| Primary score | 0–12 | 0–28 | 0–100 | 0–100 (Wellbeing Index) |
| Direction | ↑ = more distress | ↑ = more distress | ↑ = more wellbeing | ↑ = more wellbeing |
| Secondary stored | Likert 0–36 | Likert 0–84 | Raw 0–25 | Raw 0–48 |
| Sub-scores | None | 4 subscales | None | 6 dimensions |
| Threshold | Configured (default 4) | Configured (default 5) | None configured | **None — not validated** |
| Licensing | Rights required | Rights required | CC BY-NC-SA 3.0 IGO | Original content |
| Readiness | Engine ready, content pending | Engine ready, content pending | Engine ready, content pending | **Fully active** |

---

## GHQ-12

**What it measures.** A count of areas a person reports as worse than usual
recently. A distress screener, not a diagnosis and not a severity scale.

**Scoring.** Bimodal `0-0-1-1` by response position → 0–12. A secondary Likert
total (`0-1-2-3` → 0–36) is stored for research and trend work and is not shown
to participants or to management analytics by default. No item is
reverse-scored: the published response sets already run from "no worse than
usual" toward "worse than usual".

**Threshold.** Governance-configured, defaulting to the widely-used 3/4
cut-off (threshold = 4: 0–3 below, 4–12 at or above). Every result stores the
threshold in force when it completed, so revising policy never re-reads
history. Cut-offs vary materially by population, setting and language; the
default has not been validated against any specific workforce.

**Analytics.** Participation, median total, mean as secondary, 0–12
distribution with the threshold marked, % at or above threshold, trends,
and comparison by team / department / work location / office location. No
subscales are invented.

**Licensing.** Digital-use permission being pursued internally. Item wording
not committed.

---

## GHQ-28

**What it measures.** The same construct as GHQ-12 over 28 items, with a
four-part profile.

**Scoring.** Bimodal `0-0-1-1` → 0–28. Secondary Likert `0-1-2-3` → 0–84.
Implemented as a **separate engine** from GHQ-12, not the same scorer with a
larger loop.

**Subscales.** Four blocks of seven items — Somatic symptoms (1–7), Anxiety /
insomnia (8–14), Social dysfunction (15–21), Severe depression (22–28).

> **These are profile dimensions only.** No threshold, band or verdict is
> attached to any subscale, in the engine, the schema or any surface. The
> configured threshold applies to the **total score** alone. A high block does
> not make anyone "a case".

**Threshold.** Governance-configured, default 5, with the same
population-dependency caveat as GHQ-12.

**Analytics.** As GHQ-12, plus a four-subscale aggregate profile. No subscale
thresholds; no individual ranking.

**Licensing.** Digital-use permission being pursued internally. Item wording
not committed.

---

## WHO-5

**What it measures.** Current positive wellbeing over the preceding two weeks.
Runs in the opposite direction to the GHQ instruments.

**Scoring.** Five items scored 0–5 → raw 0–25, then the instrument's own
documented transformation **raw × 4** → 0–100. This is deliberately *not* the
`(raw / max) × 100` formula the DISC360 index uses; they agree numerically on
WHO-5's own numbers and are different documented rules belonging to different
instruments.

**Threshold.** None configured in this deployment. No classification is
invented.

**Licensing and attribution.** © World Health Organization, CC BY-NC-SA 3.0
IGO. Intended use here is internal and non-commercial. The required
attribution is rendered wherever WHO-5 results appear and includes an explicit
statement that **WHO does not endorse DISC360 or Wellbeing Pulse**. No WHO logo
is used. Item wording is not committed pending confirmation of the exact source
version.

---

## DISC360 Wellbeing Pulse V1

**What it measures.** How working life has felt over the past two weeks, across
six dimensions. A reflection and monitoring instrument — not clinical, not
diagnostic, and **not psychometrically validated**.

**Scoring.** Twelve positively-worded items, five ordered responses (Never …
Almost always) scored 0–4 → raw 0–48, normalised `(raw / 48) × 100` → Wellbeing
Index 0–100. One documented rounding rule (half-up) shared by the index and
every dimension.

**Dimensions.** Six, two items each, raw 0–8 normalised to 0–100: Capacity,
Recovery & Demand, Emotional Resilience, Connection & Safety, Purpose &
Confidence, Everyday Wellbeing.

**Threshold.** **None in V1, deliberately.** The instrument has not been
validated, so it reports a number and its movement and declines to grade
anyone. The database refuses a threshold on a non-GHQ result. Any descriptive
bands introduced later would be product design choices, not clinical
thresholds, and would need governing as such.

**Analytics.** Participation, median index, mean as secondary, bucketed 0–100
distribution, six-dimension organisational profile with higher/lower-scoring
dimensions named as *areas for attention*, trends, and the full comparison set.

**Licensing.** Original DISC360 content. No third-party dependency.

---

## Common to all four

**Longitudinal.** Every completed pulse is a separate immutable row. Retakes
never overwrite. Context (Department / Function, Work Location, Office
Location, job title, team, organisation) is snapshotted at completion, so later
changes never rewrite history. History is **split by instrument** — the four
never share a chart, an axis or a movement figure.

**Privacy.** Individual sessions, responses and results are readable by their
owner and by nobody else — not team admins, not organization admins, not
coaches, not wellbeing roles, and **not platform super administrators**.
Verified against the database: an account for which both `is_super_admin()` and
`is_team_admin()` return true sees zero wellbeing rows. Facilitators see
completion state only; names and scores are read from different tables by
different queries.

**Suppression.** Minimum reporting cohort of 7 completed responses, plus
complementary suppression so a hidden group cannot be recovered by subtraction
from a published parent. Applied server-side before any figure enters a
payload, and to dimension and subscale metrics as well as headline ones.

**No combination.** No instrument's score is added to, averaged with, ranked
against or converted into another's — nor into DISC or Focus Pulse. Enforced by
separate engines with no shared imports, per-instrument analytics queries, and
source-level tests that fail the build if any of that changes.

**Reporting.** Private participant PDF per instrument, sharing one renderer and
one opt-in email workflow. No score in any email subject line, URL or log.

---

## Product readiness

| Capability | GHQ-12 | GHQ-28 | WHO-5 | DISC360 V1 |
|---|---|---|---|---|
| Scoring engine | ✅ tested + frozen | ✅ tested + frozen | ✅ tested + frozen | ✅ tested + frozen |
| Schema + history | ✅ | ✅ | ✅ | ✅ |
| Analytics | ✅ | ✅ | ✅ | ✅ |
| PDF + email | ✅ | ✅ | ✅ | ✅ |
| Questionnaire content | ⏳ rights pending | ⏳ rights pending | ⏳ source/licence confirmation | ✅ shipped |
| Participant launch | 🔒 blocked | 🔒 blocked | 🔒 blocked | ✅ available |

Blocked instruments are blocked **structurally**: a `structure_only` or
`demo_restricted` version cannot be activated, and the licensing gate requires
non-production *and* an explicit demo flag before a restricted instrument can be
served at all.

---

## Testing strategy

**Instrument content comes from migrations. Seeds supply people, never
questionnaires.** That separation is the whole point: a seed that manufactures
its own questionnaire lets a test keep passing against content that has drifted
away from the instrument actually shipped. There is no longer a separate
wellbeing smoke questionnaire — `scripts/seed-wellbeing-smoke.sql` was retired.

| Purpose | Use | Why |
|---|---|---|
| Participant / e2e functional testing | **`disc360_wellbeing_v1`**, installed and activated by migrations | It is real, runnable, licensed-to-us content. Testing the flow against the shipped instrument is the only way a passing test means anything. |
| Management / analytics demo | **`scripts/seed-wellbeing-demo.sql`** | Synthetic participants and results only — four waves, several departments, one deliberately suppressed cohort. It writes no questionnaire. |
| GHQ-12 · GHQ-28 · WHO-5 | **structure-only** — item counts, response positions, subscale blocks | No wording until authorised content is loaded. They carry no prompts, cannot be activated, and cannot be served. |

Running the wellbeing suite therefore needs nothing but:

```bash
npx supabase start
npx supabase db reset                                   # installs DISC360 Wellbeing V1, active
npm run build && npx playwright test e2e/wellbeing.spec.ts
```

Add the demo population only when exercising analytics:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -f scripts/seed-wellbeing-demo.sql
```

### Seed scripts fail closed

Every SQL script under `scripts/` that can write refuses a non-local database,
and the refusal is terminal. Both halves matter: `raise exception` inside a
`DO` block ends only that block, so without `\set ON_ERROR_STOP on` psql prints
the refusal and then seeds the database anyway — which is what these scripts
used to do. The guard accepts loopback and the RFC1918 ranges a local or Docker
Postgres uses, and refuses everything else, so a hosted instance is rejected on
its address rather than on a hard-coded list that misses a Docker network.

Both properties are tested rather than asserted in prose:
`lib/wellbeing/seed-safety.test.ts` checks every writing script for the flag,
the ranges, and the ORDER of the two, and the privacy harness evaluates the
guard predicate against real loopback, private and public addresses.
