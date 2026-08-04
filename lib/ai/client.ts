import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * The only place this platform talks to a model.
 *
 * Server-only by import, so a client bundle that reaches for it fails the
 * build rather than shipping a key. The key itself is read from the
 * environment at call time and never leaves this module.
 */

export const NARRATIVE_MODEL = "claude-opus-5";

/**
 * Headroom for eight categories of prose plus a brief and a summary — and,
 * on this model, for the thinking that precedes them, which `max_tokens`
 * caps together with the text. Sized so a full generation cannot be truncated
 * into a silent fallback; only tokens actually produced are billed.
 */
const MAX_TOKENS = 32_000;

/** Facilitators wait for this in a server action, so it cannot hang. */
const TIMEOUT_MS = 150_000;

/** True when a key is configured. False everywhere else — deliberately. */
export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cached: Anthropic | null = null;

function client(): Anthropic {
  if (!cached) {
    cached = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: TIMEOUT_MS,
      // One retry. A second attempt costs a facilitator another wait of the
      // same length, and the deterministic narrative is already on the page.
      maxRetries: 1,
    });
  }
  return cached;
}

export type GenerationResult<T> =
  | { ok: true; data: T; model: string; usage: { input: number; output: number } }
  | { ok: false; reason: string };

/**
 * Runs one structured generation.
 *
 * Structured output rather than free text plus a parser: the schema is
 * enforced by the API, so a malformed reply is impossible rather than merely
 * unlikely. Every failure path returns `ok: false` with a short reason — the
 * caller's job is to fall back, never to surface an exception to a facilitator
 * mid-workshop.
 */
export async function generateStructured<Schema extends z.ZodType>(input: {
  system: string;
  user: string;
  schema: Schema;
  effort?: "low" | "medium" | "high";
}): Promise<GenerationResult<z.infer<Schema>>> {
  if (!aiConfigured()) return { ok: false, reason: "not-configured" };

  try {
    /*
     * Streamed, then collected with finalMessage(). A generation this long
     * would otherwise sit on one open request for its whole duration, which
     * is what request timeouts are made of; streaming also keeps the platform
     * honest about `max_tokens` being large enough never to truncate.
     */
    const response = await client()
      .beta.messages.stream({
        model: NARRATIVE_MODEL,
        max_tokens: MAX_TOKENS,
        // Opus 5 thinks by default; adaptive at medium effort is right for
        // writing to a brief — enough to hold the register rules across eight
        // categories, not enough to spend a facilitator's patience.
        thinking: { type: "adaptive" },
        output_config: {
          effort: input.effort ?? "medium",
          format: zodOutputFormat(input.schema),
        },
        // A safety decline is re-run on Anthropic's recommended substitute
        // inside the same call rather than surfacing as a dead end.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: input.system,
        messages: [{ role: "user", content: input.user }],
      })
      .finalMessage();

    // Checked before touching content: a refused response has no narrative in
    // it, and reading `parsed_output` first would mask why.
    if (response.stop_reason === "refusal") {
      return { ok: false, reason: "refused" };
    }
    if (response.stop_reason === "max_tokens") {
      return { ok: false, reason: "truncated" };
    }
    if (!response.parsed_output) {
      return { ok: false, reason: "unparsable" };
    }

    return {
      ok: true,
      data: response.parsed_output,
      model: response.model,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, reason: "auth" };
    if (error instanceof Anthropic.RateLimitError) return { ok: false, reason: "provider-rate-limit" };
    if (error instanceof Anthropic.APIConnectionTimeoutError) return { ok: false, reason: "timeout" };
    if (error instanceof Anthropic.APIError) return { ok: false, reason: `api-${error.status ?? "error"}` };
    return { ok: false, reason: "unavailable" };
  }
}
