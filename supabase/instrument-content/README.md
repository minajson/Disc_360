# Held instrument content

Questionnaire wording and instrument activation that is **deliberately not part
of the migration set**.

## Why these are not migrations

`supabase db push` applies **every** pending migration — it has no
target-version flag. So a migration that exists is a migration that ships. The
only reliable way to keep licensed third-party wording, and the `is_active`
flips that switch an instrument on, out of production is to keep them out of
`supabase/migrations/`.

That is why `supabase/migrations/` skips **00038** and **00040**. The gap is
intentional and is the audit trail: those numbers were created, never applied
remotely, and are held here.

## What each file does

| File | Content it loads | Activation it performs |
|---|---|---|
| `00038_who5_content.sql` | WHO-5: 5 items, 30 response anchors (WHO, CC BY-NC-SA 3.0 IGO) | sets the WHO-5 version `licensed` + `is_active` |
| `00040_ghq_content_and_who5_wording.sql` | GHQ-12: 12 items, 48 anchors · GHQ-28: 28 items, 112 anchors · WHO-5 wording alignment (all GL Assessment / WHO third-party text) | sets the GHQ-12, GHQ-28 and WHO-5 versions `licensed` + `is_active` |

Both couple **content** with **activation**. That coupling is the reason they
are held as a unit: there is no way to take the engine's readiness without also
taking the switch.

## Why each instrument is held

- **GHQ-12** — the exact attribution wording required by GL Assessment is
  **unconfirmed**. `00040`'s own `licence_note` records this: the wording "must
  be confirmed with GL Assessment before external production release".
  `data/wellbeing-instruments.ts` carries `attribution: null` rather than an
  invented string.
- **GHQ-28** — Section D asks directly about not wanting to live. The
  participant-facing support wording must come from Occupational Health and has
  not been approved. `GHQ28_SUPPORT_APPROVED === false`.
- **WHO-5** — certified end to end (7/7 browser journey) but not being switched
  on this release.

None of these is a technical readiness question. Every engine, scoring path,
report, analytics surface and test is complete and passing.

## Running them locally

After `npx supabase db reset`:

```sh
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f supabase/instrument-content/00038_who5_content.sql
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f supabase/instrument-content/00040_ghq_content_and_who5_wording.sql
```

Order matters: 00038 before 00040. Each refuses to run against a non-local host.

The end-to-end suite needs both — without them WHO-5 has no questionnaire and
`e2e/who5-journey.spec.ts` cannot run. See also
`scripts/seed-wellbeing-demo.sql`, which the wellbeing analytics specs need.

## Promoting a file when governance approves

1. Resolve the blocker and record the evidence (attribution wording, OH sign-off).
2. `git mv` the file back into `supabase/migrations/` with a **new** number —
   never reuse 00038 or 00040, which history records as created-and-unapplied.
3. Delete the held header, including the `ON_ERROR_STOP` line and the
   local-host guard. A migration must be able to run against production.
4. If only *content* is wanted and not *activation*, split the `update
   public.wellbeing_versions ... is_active = true` statements into a separate,
   later migration. Content and activation are separable and should stay so.
