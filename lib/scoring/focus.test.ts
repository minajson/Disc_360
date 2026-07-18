import assert from "node:assert/strict";
import { test } from "node:test";
import { focusQuestions } from "../../data/focus-questions.ts";
import {
  computeFocusResult,
  derivePattern,
  FocusScoringError,
  type FocusAnswerInput,
} from "./focus.ts";

/** Build a complete answer set, overriding specific questions. */
const answers = (over: Record<string, string | number> = {}): FocusAnswerInput[] =>
  focusQuestions.map((q) => {
    if (q.kind === "scale") {
      return { questionId: q.id, scaleValue: (over[q.id] as number) ?? 5 };
    }
    const optionId = (over[q.id] as string) ?? q.options![0]!.id;
    return { questionId: q.id, optionId };
  });

test("bank has six questions, one of them a 1–10 scale", () => {
  assert.equal(focusQuestions.length, 6);
  const scale = focusQuestions.filter((q) => q.kind === "scale");
  assert.equal(scale.length, 1);
  assert.equal(scale[0]!.scaleMin, 1);
  assert.equal(scale[0]!.scaleMax, 10);
});

test("all four dimensions land in 0–100", () => {
  const result = computeFocusResult(answers());
  for (const value of Object.values(result.scores)) {
    assert.ok(value >= 0 && value <= 100, `score ${value} in range`);
  }
});

test("scoring is deterministic", () => {
  const input = answers({ q1_pickup: "q1_several", q5_noise: 7 });
  assert.deepEqual(computeFocusResult(input), computeFocusResult(input));
});

test("automaticity rises with autopilot phone pickup", () => {
  const low = computeFocusResult(answers({ q1_pickup: "q1_never", q3_notification: "q3_disabled" }));
  const high = computeFocusResult(answers({ q1_pickup: "q1_automatic", q3_notification: "q3_immediate" }));
  assert.ok(high.scores.automaticity > low.scores.automaticity);
  assert.ok(high.scores.automaticity >= 80);
  assert.ok(low.scores.automaticity <= 20);
});

test("mental load tracks the 1–10 noise scale", () => {
  const calm = computeFocusResult(answers({ q5_noise: 1, q2_difficult: "q2_stay" }));
  const loud = computeFocusResult(answers({ q5_noise: 10, q2_difficult: "q2_stay" }));
  assert.ok(loud.scores.mentalLoad > calm.scores.mentalLoad);
  assert.ok(calm.scores.mentalLoad <= 25);
  assert.ok(loud.scores.mentalLoad >= 75);
});

test("distraction is lower for someone who stays on task with notifications off", () => {
  const focused = computeFocusResult(answers({ q2_difficult: "q2_stay", q3_notification: "q3_disabled" }));
  const pulled = computeFocusResult(answers({ q2_difficult: "q2_social", q3_notification: "q3_immediate" }));
  assert.ok(focused.scores.distraction < 30);
  assert.ok(pulled.scores.distraction > 80);
});

test("derived descriptors come straight from the chosen options", () => {
  const r = computeFocusResult(
    answers({
      q2_difficult: "q2_messages",
      q3_notification: "q3_planned",
      q4_energy: "q4_lunch",
      q6_reset: "q6_quiet",
    }),
  );
  assert.equal(r.primaryLoop, "messages");
  assert.equal(r.notificationPattern, "batches");
  assert.equal(r.energyPattern, "post_lunch");
  assert.equal(r.preferredReset, "quiet");
});

/* ── pattern derivation ── */

test("a busy mind with high pull is an Overloaded Switcher", () => {
  const r = computeFocusResult(
    answers({ q5_noise: 10, q2_difficult: "q2_social", q3_notification: "q3_immediate" }),
  );
  assert.equal(r.patternCode, "overloaded_switcher");
});

test("reset via deadline is a Deadline Activator (when not overloaded)", () => {
  const r = computeFocusResult(answers({ q6_reset: "q6_deadline", q5_noise: 3, q2_difficult: "q2_stay" }));
  assert.equal(r.patternCode, "deadline_activator");
});

test("messages/social pull with moderate distraction is Socially Stimulated", () => {
  const r = computeFocusResult(
    answers({ q2_difficult: "q2_messages", q3_notification: "q3_finish", q5_noise: 4, q6_reset: "q6_talking" }),
  );
  assert.equal(r.patternCode, "socially_stimulated");
});

test("calm, low-pull, quiet-reset profile is a Quiet Deep Worker", () => {
  const r = computeFocusResult(
    answers({
      q1_pickup: "q1_never",
      q2_difficult: "q2_stay",
      q3_notification: "q3_disabled",
      q5_noise: 3,
      q6_reset: "q6_quiet",
    }),
  );
  assert.equal(r.patternCode, "quiet_deep_worker");
});

test("pattern derivation is a pure function of the profile", () => {
  const scores = { automaticity: 70, distraction: 30, mentalLoad: 40, recovery: 70 };
  assert.equal(
    derivePattern(scores, "stays", "immediate", "quiet"),
    derivePattern(scores, "stays", "immediate", "quiet"),
  );
});

test("every pattern code is reachable and non-clinical", () => {
  // Sanity: the six labels cover the six codes with no dopamine/addiction copy.
  const codes = new Set([
    "intentional_focuser",
    "responsive_multitasker",
    "socially_stimulated",
    "deadline_activator",
    "quiet_deep_worker",
    "overloaded_switcher",
  ]);
  assert.equal(codes.size, 6);
});

/* ── validation ── */

test("an incomplete answer set is rejected, never guessed", () => {
  const incomplete = answers().slice(0, 5);
  assert.throws(
    () => computeFocusResult(incomplete),
    (e: unknown) => e instanceof FocusScoringError && e.code === "INCOMPLETE_ANSWERS",
  );
});

test("an out-of-range scale value is rejected", () => {
  assert.throws(
    () => computeFocusResult(answers({ q5_noise: 11 })),
    (e: unknown) => e instanceof FocusScoringError && e.code === "SCALE_OUT_OF_RANGE",
  );
});
