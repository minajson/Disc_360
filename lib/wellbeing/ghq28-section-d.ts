import { GHQ28_BIMODAL_WEIGHTS } from "../../data/ghq28-items.ts";
import { GHQ28_ITEM_CONTENT } from "../../data/ghq28-content.ts";

/**
 * Did this GHQ-28 attempt answer positively on any Section D item?
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS, AND WHAT IT IS DELIBERATELY NOT.
 *
 * GHQ-28's Section D asks directly about not wanting to live — including
 * "Felt that life isn't worth living?" and "Thought of the possibility of
 * doing away with yourself?". The supplied assessment guide states that a
 * positive answer there "requires immediate professional clinical evaluation,
 * regardless of the overall cumulative test score".
 *
 * That instruction cannot be implemented as written in this product, and the
 * conflict is worth stating rather than papering over. Individual wellbeing
 * results are private to the participant — no facilitator, Occupational Health
 * physician, analyst, governance role, organisation admin or platform super
 * admin can read one. So there is nobody for this product to notify, and
 * building a notification would mean breaking the confidentiality that makes
 * an honest answer possible in the first place.
 *
 * The resolution the product owner chose is PARTICIPANT-FACING SIGNPOSTING
 * ONLY: the person who answered sees support information on their own result,
 * and nothing is sent to anybody. This function is the detection half of that,
 * and it is used on exactly one surface.
 *
 * SO, EXPLICITLY:
 *
 *   · It triggers no email, no alert, no audit row, no analytics event.
 *   · It is never called from a facilitator, analytics or reporting surface.
 *   · Its result is never stored — it is derived, shown, and discarded, so
 *     there is no column anybody could later query or join against.
 *
 * Pure and dependency-free so the behaviour can be tested directly.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Section D item indices, 0-based, in administration order.
 *
 * Derived from the content bank rather than hard-coded as 21–27, so a change
 * to the item ordering moves this with it instead of silently pointing at the
 * wrong seven questions.
 */
export const GHQ28_SECTION_D_INDICES: readonly number[] = GHQ28_ITEM_CONTENT.filter(
  (item) => item.subscale === "severe_depression",
).map((item) => item.position);

/**
 * A response position counts as positive when it carries a binary weight of 1
 * — the third or fourth anchor, "Rather more than usual" or "Much more than
 * usual". Read from the weights rather than hard-coded as `>= 2`, so the two
 * cannot disagree.
 */
export function isPositiveResponse(position: number): boolean {
  return (GHQ28_BIMODAL_WEIGHTS[position] ?? 0) === 1;
}

/**
 * @param itemPositions the stored `item_positions` array, in administration
 *        order. A short or malformed array yields `false` rather than throwing:
 *        this drives a supportive message, and it must never be the reason a
 *        participant cannot see their own result.
 */
export function hasPositiveSectionD(itemPositions: readonly number[] | null | undefined): boolean {
  if (!itemPositions) return false;
  return GHQ28_SECTION_D_INDICES.some((index) => {
    const position = itemPositions[index];
    return typeof position === "number" && isPositiveResponse(position);
  });
}
