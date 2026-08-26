import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * Every SQL script that can write must fail CLOSED.
 *
 * This exists because the guard these scripts already carried did not work.
 * `raise exception` inside a DO block ends that block; psql reports the error
 * and then runs the next statement. So a script that announced it would
 * "refuse to seed a non-local host" printed the refusal and seeded it anyway
 * — including rows in `auth.users`. Only `\set ON_ERROR_STOP on` makes the
 * refusal terminal, and only if it appears before the guard runs.
 *
 * The rule is therefore about ORDER as much as presence, which is exactly the
 * kind of thing that gets quietly reintroduced by a later edit.
 */

const SCRIPTS_DIR = new URL("../../scripts/", import.meta.url);

const sqlScripts = readdirSync(SCRIPTS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .map((name) => ({ name, source: readFileSync(new URL(name, SCRIPTS_DIR), "utf8") }));

/** A script that can write is one carrying a top-level DML statement. */
const writers = sqlScripts.filter(({ source }) =>
  source.split("\n").some((line) => /^\s*(insert|update|delete|truncate)\s/i.test(line)),
);

test("there are SQL scripts to check, so these tests are not vacuous", () => {
  assert.ok(sqlScripts.length > 0, "no .sql scripts found under scripts/");
  assert.ok(writers.length > 0, "no writing .sql scripts found — the guard rule would be untested");
});

for (const { name, source } of writers) {
  test(`${name} aborts on the first error`, () => {
    assert.match(
      source,
      /^\\set ON_ERROR_STOP on$/m,
      "without this the local-host guard is decorative — psql continues past a raised exception",
    );
  });

  test(`${name} refuses a non-local database`, () => {
    assert.match(source, /inet_server_addr\(\)/, "it must test the server address");
    // Loopback and the private ranges a local/Docker Postgres uses. A hosted
    // instance is on none of these, so anything else is refused.
    for (const range of ["127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]) {
      assert.ok(
        source.includes(range),
        `${name} must accept ${range} — a hard-coded address list misses other Docker networks`,
      );
    }
    assert.match(source, /raise exception[^;]*non-local host/i, "and refuse anything else");
  });

  test(`${name} arms the guard before it writes anything`, () => {
    const stop = source.indexOf("\\set ON_ERROR_STOP on");
    const guard = source.indexOf("inet_server_addr()");
    const firstWrite = source.split("\n").findIndex((line) => /^\s*(insert|update|delete|truncate)\s/i.test(line));
    const guardLine = source.slice(0, guard).split("\n").length;
    assert.ok(stop >= 0 && stop < guard, "ON_ERROR_STOP must come before the guard, or it cannot stop it");
    assert.ok(guardLine < firstWrite + 1, "the guard must come before the first write");
  });
}

test("the retired smoke questionnaire seed is gone and unreferenced", () => {
  // Instrument content is installed by migrations and owned by the governed
  // registry; seeds supply PARTICIPANTS and RESULTS only. A seed that
  // manufactures a questionnaire lets a test drift away from the shipped one.
  assert.ok(
    !sqlScripts.some(({ name }) => name.includes("smoke")),
    "scripts/seed-wellbeing-smoke.sql was retired — do not reintroduce a seeded questionnaire",
  );
  for (const { name, source } of sqlScripts) {
    assert.ok(
      !source.includes("seed-wellbeing-smoke"),
      `${name} still references the retired smoke seed`,
    );
  }
});

test("no seed script inserts a questionnaire VERSION or ITEM", () => {
  for (const { name, source } of sqlScripts.filter((s) => s.name.startsWith("seed-"))) {
    for (const table of ["wellbeing_versions", "wellbeing_items", "wellbeing_item_options"]) {
      assert.ok(
        !new RegExp(`insert\\s+into\\s+public\\.${table}\\b`, "i").test(source),
        `${name} must not manufacture instrument content — that belongs to a migration`,
      );
    }
  }
});

/* ── remediations fail closed too, in the other direction ────────────── */
//
// A production remediation is the one writing script whose correct target IS a
// hosted database, so the local-only rule above cannot apply to it. The
// obligation is the same though — running it anywhere unintended must be an
// explicit refusal, never a quiet no-op that reads like success — so it is
// pinned to the identities the audit was performed against.
//
// These live in supabase/remediations/ rather than scripts/ precisely so the
// two rules cannot be confused for one another, and so a seed can never
// acquire a production-shaped guard by being edited in place.

const REMEDIATIONS_DIR = new URL("../../supabase/remediations/", import.meta.url);

const remediations = readdirSync(REMEDIATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .map((name) => ({ name, source: readFileSync(new URL(name, REMEDIATIONS_DIR), "utf8") }));

test("there are remediations to check, so these tests are not vacuous", () => {
  assert.ok(remediations.length > 0, "no .sql files found under supabase/remediations/");
});

for (const { name, source } of remediations) {
  test(`${name} aborts on the first error`, () => {
    assert.match(
      source,
      /^\\set ON_ERROR_STOP on$/m,
      "without this every guard below is decorative — psql continues past a raised exception",
    );
  });

  test(`${name} refuses a database it was not audited against`, () => {
    const stop = source.indexOf("\\set ON_ERROR_STOP on");
    const guard = source.indexOf("Refusing:");
    assert.ok(guard > 0, "it must refuse an unintended database explicitly");
    assert.ok(stop >= 0 && stop < guard, "ON_ERROR_STOP must come before the refusal");
    const firstWrite = source
      .split("\n")
      .findIndex((line) => /^\s*(insert|update|delete|truncate)\s/i.test(line));
    const guardLine = source.slice(0, guard).split("\n").length;
    assert.ok(guardLine < firstWrite + 1, "the guard must come before the first write");
  });

  test(`${name} writes only through a primary key`, () => {
    // A remediation is reviewed against specific rows. A predicate that
    // describes a CLASS of rows can match something added between the audit
    // and the run; a primary key cannot.
    const statements = [...source.matchAll(/^\s*(delete|update)\s[^;]+;/gim)].map((m) => m[0]);
    for (const statement of statements) {
      assert.match(
        statement,
        /where id = /,
        `${name} writes without a primary-key predicate: ${statement.trim()}`,
      );
    }
  });

  test(`${name} proves it took nothing else with it`, () => {
    assert.match(
      source,
      /raise exception 'ABORT:/,
      "it must verify the rows it was NOT supposed to touch are still there",
    );
  });
}
