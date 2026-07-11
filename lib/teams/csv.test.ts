import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMemberCsv } from "./csv.ts";

test("parses name,email,department rows", () => {
  const { rows, errors } = parseMemberCsv(
    "Ada Lovelace, ada@example.com, Engineering\nGrace Hopper, grace@example.com",
  );
  assert.equal(errors.length, 0);
  assert.deepEqual(rows, [
    { display_name: "Ada Lovelace", email: "ada@example.com", department: "Engineering" },
    { display_name: "Grace Hopper", email: "grace@example.com", department: null },
  ]);
});

test("skips a header row", () => {
  const { rows } = parseMemberCsv("Name, Email, Department\nAda, ada@example.com");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.display_name, "Ada");
});

test("normalizes emails and deduplicates within one import", () => {
  const { rows } = parseMemberCsv("Ada, ADA@Example.com\nAda Again, ada@example.com");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.email, "ada@example.com");
});

test("reports invalid lines without dropping valid ones", () => {
  const { rows, errors } = parseMemberCsv(
    "Ada, ada@example.com\nnot-a-valid-line\nBob, not-an-email",
  );
  assert.equal(rows.length, 1);
  assert.equal(errors.length, 2);
});

test("strips wrapping quotes", () => {
  const { rows } = parseMemberCsv('"Ada Lovelace", "ada@example.com", "Engineering"');
  assert.deepEqual(rows[0], {
    display_name: "Ada Lovelace",
    email: "ada@example.com",
    department: "Engineering",
  });
});
