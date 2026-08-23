import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ABSOLUTE_MIN_COHORT,
  checkSlice,
  DEFAULT_MIN_COHORT,
  isPublishable,
  resolveMinCohort,
  suppressPartition,
  SUPPRESSION_MESSAGE,
  type CohortInput,
} from "./suppression.ts";

interface Stats {
  median: number;
}

const cohort = (key: string, completed: number): CohortInput<Stats> => ({
  key,
  label: key,
  completed,
  stats: { median: completed },
});

/** Keys whose figures actually reached the payload. */
const publishedKeys = (result: ReturnType<typeof suppressPartition<Stats>>) =>
  result.cohorts.filter((entry) => !entry.suppressed).map((entry) => entry.key);

/* ── the floor ──────────────────────────────────────────────────────── */

test("the default minimum cohort is 7", () => {
  assert.equal(DEFAULT_MIN_COHORT, 7);
});

test("6 is suppressed, 7 publishes — the boundary is at the floor itself", () => {
  assert.equal(isPublishable(6), false);
  assert.equal(isPublishable(7), true);
  assert.equal(checkSlice(6).publishable, false);
  assert.equal(checkSlice(6).message, SUPPRESSION_MESSAGE);
  assert.equal(checkSlice(7).publishable, true);
  assert.equal(checkSlice(7).message, null);
});

test("the floor is configurable upward but never below the absolute minimum", () => {
  assert.equal(resolveMinCohort(undefined), 7);
  assert.equal(resolveMinCohort(null), 7);
  assert.equal(resolveMinCohort(10), 10);
  assert.equal(resolveMinCohort(ABSOLUTE_MIN_COHORT), ABSOLUTE_MIN_COHORT);
  for (const bad of [4, 0, -1, 7.5]) {
    assert.throws(() => resolveMinCohort(bad), RangeError, `refuses ${bad}`);
  }
});

/* ── primary suppression ────────────────────────────────────────────── */

test("a suppressed cohort returns no figures at all — not a hidden chart", () => {
  const result = suppressPartition([cohort("small", 3), cohort("big", 20), cohort("mid", 9)]);
  const small = result.cohorts.find((entry) => entry.key === "small")!;
  assert.equal(small.suppressed, true);
  assert.equal(small.stats, null, "statistics never enter the payload");
  assert.equal(small.completed, null, "the count is a cohort figure too");
  assert.equal(small.reason, "below_minimum");
  assert.equal(small.message, SUPPRESSION_MESSAGE);
});

test("cohorts at or above the floor keep their figures", () => {
  const result = suppressPartition([cohort("a", 7), cohort("b", 30)]);
  assert.deepEqual(publishedKeys(result), ["a", "b"]);
  assert.deepEqual(result.cohorts[0]!.stats, { median: 7 });
  assert.equal(result.cohorts[0]!.completed, 7);
});

/* ── complementary suppression — §12 ────────────────────────────────── */

test("Production 8 = Office 6 + Field 2: neither is published", () => {
  // Both fall below the floor on the primary rule alone.
  const result = suppressPartition([cohort("Office Based", 6), cohort("Field Based", 2)]);
  assert.equal(result.fullySuppressed, true);
  assert.equal(result.suppressedCount, 2);
  for (const entry of result.cohorts) {
    assert.equal(entry.stats, null);
    assert.equal(entry.completed, null);
  }
});

test("Office 18 + Field 2 of 20: publishing Office alone would give away Field", () => {
  const result = suppressPartition([cohort("Office Based", 18), cohort("Field Based", 2)]);
  const office = result.cohorts.find((entry) => entry.key === "Office Based")!;
  const field = result.cohorts.find((entry) => entry.key === "Field Based")!;

  assert.equal(field.suppressed, true);
  assert.equal(field.reason, "below_minimum");
  assert.equal(
    office.suppressed,
    true,
    "the only publishable sibling is withheld too — otherwise 20 − 18 = 2",
  );
  assert.equal(office.reason, "complementary");
  assert.equal(result.fullySuppressed, true);
});

test("exactly one cohort below the floor always drags a second one with it", () => {
  const result = suppressPartition([
    cohort("Engineering", 40),
    cohort("Legal", 3),
    cohort("Production", 25),
    cohort("Wells", 12),
  ]);
  assert.equal(result.suppressedCount, 2, "never exactly one");
  const legal = result.cohorts.find((entry) => entry.key === "Legal")!;
  const wells = result.cohorts.find((entry) => entry.key === "Wells")!;
  assert.equal(legal.reason, "below_minimum");
  assert.equal(wells.reason, "complementary", "the smallest publishable cohort pairs with it");
  assert.deepEqual(publishedKeys(result).sort(), ["Engineering", "Production"]);
});

test("the complementary pick is the smallest publishable cohort, so most data survives", () => {
  const result = suppressPartition([
    cohort("A", 100),
    cohort("B", 8),
    cohort("C", 90),
    cohort("D", 4),
  ]);
  assert.deepEqual(publishedKeys(result).sort(), ["A", "C"]);
  assert.equal(result.cohorts.find((entry) => entry.key === "B")!.reason, "complementary");
});

test("no partition ever ends with exactly one suppressed cohort", () => {
  // Exhaustive over every three-cohort shape in a realistic range.
  for (let a = 0; a <= 12; a += 1) {
    for (let b = 0; b <= 12; b += 1) {
      for (let c = 0; c <= 12; c += 1) {
        const result = suppressPartition([cohort("a", a), cohort("b", b), cohort("c", c)]);
        assert.notEqual(
          result.suppressedCount,
          1,
          `sizes ${a}/${b}/${c} left a single derivable cohort`,
        );
      }
    }
  }
});

test("two cohorts below the floor need no complementary pick", () => {
  const result = suppressPartition([cohort("A", 50), cohort("B", 3), cohort("C", 2)]);
  assert.deepEqual(publishedKeys(result), ["A"]);
  assert.equal(result.suppressedCount, 2, "two unknowns and one equation is not solvable");
});

test("a zero-response cohort is suppressed like any other and cannot uncover a sibling", () => {
  const result = suppressPartition([cohort("Office", 18), cohort("Field", 2), cohort("Other", 0)]);
  assert.equal(result.suppressedCount, 2);
  assert.deepEqual(publishedKeys(result), ["Office"]);
  // Residual is 2 across two withheld cohorts — neither is determined, because
  // the reader is not told that "Other" is empty.
  for (const key of ["Field", "Other"]) {
    assert.equal(result.cohorts.find((entry) => entry.key === key)!.completed, null);
  }
});

/* ── degenerate partitions ──────────────────────────────────────────── */

test("a single-cohort partition is the parent, and follows the parent's rule", () => {
  assert.equal(suppressPartition([cohort("only", 30)]).fullySuppressed, false);
  assert.equal(suppressPartition([cohort("only", 3)]).fullySuppressed, true);
});

test("an empty partition is safe and publishes nothing", () => {
  const result = suppressPartition<Stats>([]);
  assert.deepEqual(result.cohorts, []);
  assert.equal(result.publishedCount, 0);
  assert.equal(result.fullySuppressed, true);
});

test("every cohort below the floor suppresses the whole partition", () => {
  const result = suppressPartition([cohort("A", 1), cohort("B", 2), cohort("C", 3)]);
  assert.equal(result.fullySuppressed, true);
  assert.equal(result.publishedCount, 0);
});

/* ── coverage reporting ─────────────────────────────────────────────── */

test("counts stay withheld by default and are only revealed on explicit request", () => {
  const cells = [cohort("A", 40), cohort("B", 3), cohort("C", 9)];
  assert.equal(suppressPartition(cells).cohorts[1]!.completed, null);

  const revealed = suppressPartition(cells, { revealCounts: true });
  assert.equal(revealed.cohorts[1]!.completed, 3, "coverage view, no parent total alongside");
  assert.equal(revealed.cohorts[1]!.stats, null, "figures stay withheld regardless");
});

test("a raised floor suppresses more, never less", () => {
  const cells = [cohort("A", 9), cohort("B", 40), cohort("C", 30)];
  assert.equal(suppressPartition(cells, { minCohort: 7 }).publishedCount, 3);

  // At 15, A(9) drops below the floor — and because it would then be the only
  // hidden cohort, the complementary rule takes the smallest publishable one
  // (C) with it. Raising the floor by six costs two cohorts, not one.
  const raised = suppressPartition(cells, { minCohort: 15 });
  assert.equal(raised.publishedCount, 1);
  assert.deepEqual(publishedKeys(raised), ["B"]);
  assert.equal(raised.cohorts.find((entry) => entry.key === "C")!.reason, "complementary");
});
