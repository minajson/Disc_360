import {
  WHO5_SOURCE_CITATION,
  WHO5_SOURCE_DOCUMENT,
  WHO5_SUGGESTED_CUTOFF_PERCENTAGE,
  WHO5_SUGGESTED_CUTOFF_RAW,
} from "./who5-items.ts";

/**
 * WHO-5 participant-facing copy.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY WHO-5 HAS ITS OWN COPY RATHER THAN SHARING GHQ'S.
 *
 * The two instruments run in OPPOSITE DIRECTIONS, and every sentence about a
 * score inherits that direction:
 *
 *   GHQ-12/28   0–12 / 0–28   higher = more reported distress
 *               at or above the threshold is the noteworthy side
 *
 *   WHO-5       0–100         higher = better reported wellbeing
 *               BELOW the cut-off is the noteworthy side
 *
 * Sharing one set of strings would therefore not be a style problem. A WHO-5
 * participant with strong wellbeing would read GHQ's at-or-above-threshold
 * language and be told the opposite of their result. That is the reason this
 * file exists, and the reason nothing here is imported from
 * `wellbeing-content.ts`.
 *
 * WHAT THE CUT-OFF IS ALLOWED TO SAY.
 *
 * WHO's own publication calls it a SUGGESTED cut-off, and an indication for
 * FURTHER ASSESSMENT — not a finding, not a classification, and certainly not
 * a diagnosis. The wording below stays inside that, states the source, and
 * never tells anybody they have a condition. No word here grades a person:
 * no "case", no "risk", no "poor", no "abnormal".
 * ─────────────────────────────────────────────────────────────────────
 */

export const WHO5_RESULT_HEADING = "Your wellbeing check-in";

/** Beside the figure. The instrument is half the meaning of the number. */
export const WHO5_SCORE_LABEL = "WHO-5 Well-Being Score";
export const WHO5_RAW_LABEL = "Raw score";

/**
 * What the number is, before any interpretation of it.
 *
 * Deliberately about REPORTING rather than about the person: the instrument
 * records what somebody said about the last two weeks, which is a different
 * claim from what they are like.
 */
export const WHO5_SCORE_MEANING =
  "Your WHO-5 score reflects how you reported your wellbeing over the recent assessment period. " +
  "It runs from 0 to 100, and a higher score means you reported better wellbeing.";

export const WHO5_DIRECTION_NOTE = "Higher is better on this scale.";

/** Shown when the score sits at or above the documented cut-off. */
export const WHO5_ABOVE_CUTOFF_HEADLINE = "At or above the WHO-5 suggested threshold";
export const WHO5_ABOVE_CUTOFF_BODY =
  "Your score is at or above the level at which the WHO-5 documentation suggests further " +
  "assessment may be worth considering. This is a check-in, not an assessment of your health, " +
  "and it says nothing about you beyond how you answered these five questions.";

/**
 * Shown when the score sits below it.
 *
 * Proportionate on purpose. It names what the number is relative to, says what
 * that is for, and stops — it does not tell somebody they are unwell, does not
 * instruct them to seek help, and does not imply a condition.
 */
export const WHO5_BELOW_CUTOFF_HEADLINE = "Below the WHO-5 suggested threshold";
export const WHO5_BELOW_CUTOFF_BODY =
  "This score is below the WHO-5 suggested threshold at which further assessment may be " +
  "considered. That is a prompt to look further if you want to, not a finding about your " +
  "health. Many things affect how the last two weeks felt.";

export function who5CutoffCopy(atOrAboveCutoff: boolean): { headline: string; body: string } {
  return atOrAboveCutoff
    ? { headline: WHO5_ABOVE_CUTOFF_HEADLINE, body: WHO5_ABOVE_CUTOFF_BODY }
    : { headline: WHO5_BELOW_CUTOFF_HEADLINE, body: WHO5_BELOW_CUTOFF_BODY };
}

/** The cut-off, with its provenance attached wherever it is shown. */
export const WHO5_CUTOFF_SOURCE_NOTE =
  `The suggested threshold is a score below ${WHO5_SUGGESTED_CUTOFF_PERCENTAGE} ` +
  `(a raw score below ${WHO5_SUGGESTED_CUTOFF_RAW}), described in ${WHO5_SOURCE_DOCUMENT} as a ` +
  "cut-off for poor mental well-being and an indication for further assessment. " +
  "It is guidance published with the instrument, not an assessment made by DISC360.";

/**
 * Movement between pulses.
 *
 * Direction only. A change of a few points on a five-item questionnaire is not
 * an improvement or a deterioration in anybody's health, and naming it as one
 * would be a clinical claim made out of arithmetic.
 */
export const WHO5_MOVEMENT_CAVEAT =
  "A change between check-ins shows how your answers differed, not whether your health has " +
  "changed. Short questionnaires move for many reasons.";

export const WHO5_TREND_HEADING = "Your WHO-5 check-ins over time";

/** Long-form disclaimer, rendered at the foot of every WHO-5 result. */
export const WHO5_DISCLAIMER_LONG =
  "The WHO-5 Well-Being Index is a short self-report questionnaire used for wellbeing " +
  "screening and monitoring. It is not a diagnostic instrument and does not identify any " +
  "medical or psychological condition. Your individual answers and score are private to you: " +
  "they are not visible to your manager, your facilitator, or platform administrators. " +
  `Source: ${WHO5_SOURCE_CITATION}`;

/** What the participant may do next. Never instruction, always option. */
export const WHO5_NEXT_STEPS_HEADING = "If you want to take this further";
export const WHO5_NEXT_STEPS_BODY =
  "You can keep this result, complete the check-in again at the next wave to see how your " +
  "answers change, or raise anything you would like to discuss with whoever supports " +
  "wellbeing in your organisation. That choice is yours, and nobody is notified of it.";
