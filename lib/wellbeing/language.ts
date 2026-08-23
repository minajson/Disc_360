/**
 * Wellbeing Pulse — the words the product is allowed to use.
 *
 * Pure and unit-tested, and every piece of participant- or management-facing
 * wellbeing copy is screened by it. Safety language in a screening product is
 * not a style preference: calling a score "depressed", "a case" or "unfit for
 * work" turns a 12-item questionnaire into a clinical claim the instrument
 * cannot support and the platform is not licensed to make.
 *
 * The screen is a test, not a runtime filter. Copy that fails is a build
 * failure — which is the point. A runtime filter would let bad wording ship
 * and then quietly rewrite it in front of a person.
 */

/**
 * Terms that must never appear in wellbeing copy.
 *
 * Grouped by why they are banned, because "why" is what a future author needs
 * when they want to add one back.
 */
export const BANNED_WELLBEING_TERMS: readonly { term: string; reason: string }[] = [
  // Diagnosis. GHQ-12 screens; it does not diagnose anything.
  { term: "diagnosis", reason: "GHQ-12 is a screening questionnaire, not a diagnostic test" },
  { term: "diagnose", reason: "GHQ-12 is a screening questionnaire, not a diagnostic test" },
  { term: "diagnosed", reason: "GHQ-12 is a screening questionnaire, not a diagnostic test" },
  { term: "diagnostic", reason: "GHQ-12 is a screening questionnaire, not a diagnostic test" },
  { term: "clinical", reason: "implies a clinical finding the instrument cannot support" },
  { term: "clinically", reason: "implies a clinical finding the instrument cannot support" },
  { term: "psychiatric", reason: "implies a psychiatric determination" },
  { term: "disorder", reason: "names a condition the instrument does not detect" },
  { term: "illness", reason: "names a condition the instrument does not detect" },
  { term: "mentally ill", reason: "explicitly forbidden framing of an above-threshold score" },
  { term: "mental illness", reason: "names a condition the instrument does not detect" },
  { term: "depressed", reason: "a named condition, not a screening outcome" },
  { term: "depression", reason: "a named condition, not a screening outcome" },
  { term: "anxiety disorder", reason: "a named condition, not a screening outcome" },
  { term: "burnout", reason: "a named construct this instrument does not measure" },
  { term: "patient", reason: "participants are not patients" },
  { term: "symptom", reason: "frames responses as clinical signs" },
  { term: "severity", reason: "the 0–12 total is a count, not a severity scale" },
  { term: "case", reason: "'caseness' framing labels a person as a psychiatric case" },
  { term: "caseness", reason: "labels a person as a psychiatric case" },

  // Employment consequence. Never permitted, anywhere.
  { term: "unfit for work", reason: "explicitly forbidden employment-fitness claim" },
  { term: "fitness for work", reason: "implies an employment-selection use" },
  { term: "unhealthy", reason: "a judgement about the person rather than the responses" },
  { term: "at risk", reason: "implies a predictive clinical claim" },
  { term: "high risk", reason: "implies a predictive clinical claim" },
  { term: "danger", reason: "alarm framing on a screening score" },
  { term: "alarming", reason: "alarm framing on a screening score" },
  { term: "critical", reason: "alarm framing on a screening score" },
  { term: "severe", reason: "implies a severity grading the instrument does not provide" },

  // Treatment. An algorithm must not prescribe.
  { term: "treatment", reason: "the product does not recommend treatment" },
  { term: "therapy", reason: "the product does not recommend treatment" },
  { term: "prescribe", reason: "the product does not recommend treatment" },
  { term: "you should seek", reason: "an algorithmic referral instruction" },

  // Causal and cross-instrument claims.
  { term: "caused by", reason: "aggregate movement is association, never causation" },
  { term: "because of the", reason: "attributes a change to a named cause" },
  { term: "led to poorer", reason: "attributes a change to a named cause" },
  { term: "overall employee score", reason: "no composite across instruments may exist" },
  { term: "combined score", reason: "wellbeing is never combined with DISC or Focus" },
  { term: "wellbeing index", reason: "no validated composite index exists" },
  { term: "ranked", reason: "employees are never ranked on wellbeing" },
  { term: "ranking", reason: "employees are never ranked on wellbeing" },
];

/**
 * Phrases that describe a movement as meaningful without a validated
 * minimum-change threshold. Matched as patterns because the shape is the
 * problem, not any single word.
 */
export const UNSUPPORTED_CHANGE_PATTERNS: readonly { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\b(improved|worsened|deteriorated|declined)\s+by\s+\d/i,
    reason: "no validated minimum-change threshold supports a magnitude claim",
  },
  {
    pattern: /\b\d+\s*%\s*(better|worse|improvement|decline)/i,
    reason: "a percentage change on a 0–12 count is not interpretable",
  },
  {
    pattern: /\bmental health (has )?(improved|declined|worsened)/i,
    reason: "the instrument does not measure 'mental health' as a quantity",
  },
  {
    pattern: /\bsignificant(ly)? (improvement|decline|better|worse)/i,
    reason: "'significant' asserts a statistical or clinical test that was not run",
  },
];

/**
 * Sanctioned phrases, stripped before screening.
 *
 * A few banned words are legitimate — and required — inside a specific
 * negation. "Does not provide a diagnosis" is the disclaimer the product must
 * carry; banning the word outright would ban the disclaimer.
 *
 * This is an allowlist of exact phrases, not of words. "Diagnosis" remains
 * unusable anywhere else, so a new sentence cannot borrow the exemption.
 */
export const SANCTIONED_PHRASES: readonly { phrase: string; why: string }[] = [
  {
    phrase: "does not provide a diagnosis",
    why: "the required screening disclaimer (§8)",
  },
  {
    phrase: "is not a diagnosis",
    why: "the required screening disclaimer, short form",
  },
  {
    phrase: "not a diagnostic",
    why: "used to state what the instrument is not",
  },
  {
    phrase: "is not a clinical",
    why: "used to state what the instrument is not",
  },
  {
    phrase: "no clinical",
    why: "used to state the absence of a clinical claim",
  },
  {
    phrase: "clinical or occupational-health governance",
    why: "names the role that owns the threshold, not a clinical claim about a person",
  },
  {
    phrase: "clinical governance",
    why: "names the role that owns the policy, not a clinical claim about a person",
  },
  {
    phrase: "not a medical, clinical or employment-selection",
    why: "the platform-wide disclaimer already in use for DISC and Focus",
  },
];

export interface LanguageViolation {
  term: string;
  reason: string;
  excerpt: string;
}

/**
 * Screens one piece of copy.
 *
 * Word-boundary matching, so "casement" does not trip "case" and "increase"
 * does not trip "case". Returns every violation rather than the first, because
 * an author fixing copy wants the whole list.
 */
export function screenWellbeingCopy(text: string): LanguageViolation[] {
  const violations: LanguageViolation[] = [];
  // Sanctioned phrases are blanked (not deleted) so reported offsets still
  // line up with the original text.
  let scanned = text;
  for (const { phrase } of SANCTIONED_PHRASES) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    scanned = scanned.replace(new RegExp(escaped, "gi"), (match) => " ".repeat(match.length));
  }
  const haystack = scanned.toLowerCase();

  for (const { term, reason } of BANNED_WELLBEING_TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Plurals count. "12 probable cases" is precisely the caseness framing the
    // ban exists for, and a bare \bcase\b would sail straight past it.
    const matcher = new RegExp(`\\b${escaped}(?:es|s)?\\b`, "i");
    const match = matcher.exec(haystack);
    if (match) {
      violations.push({ term: match[0], reason, excerpt: excerptAround(text, match.index) });
    }
  }

  for (const { pattern, reason } of UNSUPPORTED_CHANGE_PATTERNS) {
    const match = pattern.exec(scanned);
    if (match) {
      violations.push({ term: match[0], reason, excerpt: excerptAround(text, match.index) });
    }
  }

  return violations;
}

/** Screens a whole content map and reports which key failed. */
export function screenWellbeingContent(
  entries: Record<string, string>,
): { key: string; violations: LanguageViolation[] }[] {
  return Object.entries(entries)
    .map(([key, value]) => ({ key, violations: screenWellbeingCopy(value) }))
    .filter((entry) => entry.violations.length > 0);
}

function excerptAround(text: string, index: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + 60);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}
