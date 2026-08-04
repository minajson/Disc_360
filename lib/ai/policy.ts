/**
 * AI generation policy — pure, deterministic, unit-tested.
 *
 * Everything here answers "may this call happen, and what may it see?"
 * without touching the network, so the rules can be tested exhaustively and
 * cannot drift from what the server actually enforces.
 */

/** Generations one facilitator may run per rolling window. */
export const RATE_LIMIT = 20;

/** Rolling window, in milliseconds. */
export const RATE_WINDOW_MS = 60 * 60 * 1000;

export interface RateDecision {
  allowed: boolean;
  used: number;
  remaining: number;
  /** Human sentence shown when a request is refused. */
  reason: string | null;
}

/**
 * Rate limit from a durable count of prior generations.
 *
 * The count comes from audit rows rather than process memory: a serverless
 * deployment runs many instances, and an in-memory bucket would let the limit
 * be multiplied by however many happened to be warm.
 */
export function rateDecision(
  usedInWindow: number,
  limit: number = RATE_LIMIT,
): RateDecision {
  const used = Math.max(0, usedInWindow);
  const remaining = Math.max(0, limit - used);
  return {
    allowed: used < limit,
    used,
    remaining,
    reason:
      used < limit
        ? null
        : `You have generated ${used} insight narratives in the last hour, which is the limit. Try again shortly — the existing evidence-based insights remain available in the meantime.`,
  };
}

/* ── payload minimisation ───────────────────────────────────────────── */

/**
 * The only shape that may be sent to a model.
 *
 * Deliberately narrow. There is no name, email, id, department roster,
 * free-text note or assessment response anywhere in it — a facilitator's
 * team could be re-derived from none of these fields. The model receives
 * aggregate numbers and the category it is writing about, and nothing else.
 */
export interface NarrativePayloadCard {
  category: string;
  /** Deterministic title, for context only — the model may rewrite it. */
  title: string;
  observation: string;
  interpretation: string[];
  /**
   * Evidence as metric names, never chip labels.
   *
   * The deterministic layer's own labels can carry a department or group name
   * (department comparison in particular), so the builder substitutes a
   * positional alias — "Group A" — and re-attaches the real label when the
   * card is rendered. `metric` rather than `label` so the leak walk below can
   * treat `label` as identifying without exempting a path.
   */
  evidence: { metric: string; value: string }[];
  signal: string;
  sampleSize: number;
  populationSize: number;
}

export interface NarrativePayload {
  /** Generic scope word — never the team's actual name. */
  scopeKind: "team" | "department" | "organization";
  cards: NarrativePayloadCard[];
}

const IDENTIFYING_KEYS = new Set([
  "name",
  "label",
  "email",
  "id",
  "teamId",
  "teamName",
  "profileId",
  "member",
  "members",
  "participants",
  "responses",
  "note",
  "notes",
  "department",
]);

/**
 * Asserts a payload carries nothing identifying before it leaves the server.
 *
 * A belt-and-braces check rather than the primary control — the payload is
 * built field by field from the deterministic cards — but it means a future
 * edit that widens the payload fails a test instead of quietly shipping
 * participant data to a third party.
 */
export function payloadLeaks(payload: unknown): string[] {
  const leaks: string[] = [];
  const walk = (value: unknown, path: string) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    if (typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) {
        if (IDENTIFYING_KEYS.has(key)) leaks.push(`${path}.${key}`);
        walk(entry, `${path}.${key}`);
      }
    }
  };
  walk(payload, "payload");
  return leaks;
}

/* ── narrative acceptance ───────────────────────────────────────────── */

/**
 * Language a generated narrative may never contain, whatever the model
 * returns. Mirrors the register rules the deterministic layer already
 * enforces, applied to text the platform did not write.
 */
const FORBIDDEN =
  /\b(diagnos\w*|disorder\w*|syndrome\w*|patholog\w*|clinical\w*|therapy|therapies|therapeutic\w*|mental health|treatment\w*|symptom\w*|IQ|incompeten\w*|unfit|toxic|lazy|weak(er|est)? (member|people|person|performer)\w*|difficult (member|people|person)\w*|poor perform\w*|should be (fired|promoted|removed)|hire|fire|promot\w* decisions?)\b/i;

const CAUSAL = /\b(because of|caused by|proves|guarantees|will definitely|always results in)\b/i;

export interface NarrativeCheck {
  ok: boolean;
  problems: string[];
}

/**
 * Applies the register rules to arbitrary generated lines.
 *
 * The card check below and the brief/summary checks in `narrative.ts` all go
 * through this, so there is exactly one definition of what the platform will
 * not say — extending it covers every generated surface at once.
 */
export function screenLines(lines: readonly string[]): string[] {
  const problems: string[] = [];
  for (const line of lines) {
    if (FORBIDDEN.test(line)) problems.push(`forbidden register: "${line.slice(0, 60)}"`);
    if (CAUSAL.test(line)) problems.push(`causal claim: "${line.slice(0, 60)}"`);
  }
  return problems;
}

/**
 * Validates one generated narrative before it is allowed near a page.
 *
 * A model that returns something out of register is treated exactly like a
 * model that is unavailable: the deterministic narrative renders instead.
 * Silent acceptance is the one outcome that is never allowed.
 */
export function checkNarrative(input: {
  headline: string;
  observation: string;
  interpretation: string[];
}): NarrativeCheck {
  const problems = screenLines([
    input.headline,
    input.observation,
    ...input.interpretation,
  ]);

  if (!input.headline.trim()) problems.push("empty headline");
  if (!input.observation.trim()) problems.push("empty observation");
  if (input.interpretation.length < 2) {
    problems.push("fewer than two interpretation points");
  }

  // Length guards: a runaway generation is a wall of text on a slide.
  if (input.headline.length > 140) problems.push("headline too long");
  if (input.observation.length > 700) problems.push("observation too long");
  if (input.interpretation.some((line) => line.length > 400)) {
    problems.push("interpretation point too long");
  }

  return { ok: problems.length === 0, problems };
}
