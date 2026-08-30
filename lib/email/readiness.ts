import "server-only";

/**
 * Whether this deployment can actually send email — and what is missing.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS AS A SURFACE AND NOT A COMMENT IN A RUNBOOK.
 *
 * `sendEmail()` is deliberately honest: with no provider key it records the
 * message and reports `logged`, and the participant is told their report was
 * not sent. That is the correct behaviour and it is also completely silent
 * about WHY. In production every `notification_logs` row read `logged` and
 * every wellbeing delivery read `not_delivered / no email provider
 * configured`, for weeks, with nothing on any admin screen saying that a key
 * was missing.
 *
 * So the readiness is reported where the log is read.
 *
 * IT REPORTS PRESENCE, NEVER VALUES.
 *
 * `hasKey` is a boolean. The key itself is never returned, never logged and
 * never rendered — an admin screen that printed a provider credential would be
 * a worse problem than the one this solves. `sender` is not a secret (it is
 * the From address recipients already see) and is shown so a misconfigured
 * sender is visible.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface EmailReadiness {
  /** True when a provider key is present. The key itself never leaves here. */
  hasKey: boolean;
  /** The From address messages will carry, or the built-in default. */
  sender: string;
  /** Whether a Reply-To is configured. */
  hasReplyTo: boolean;
  /** True when the sender is Resend's shared test address. */
  usingSharedSender: boolean;
  /**
   * Whether this deployment restricts recipients.
   *
   * Outside production a real address is refused even WITH a key, so that
   * development never emails a customer. It is reported because "the key is
   * set and nothing arrives" is otherwise a mystery.
   */
  restrictsRecipients: boolean;
  /** Everything that must be set before a real message can be delivered. */
  missing: string[];
}

const DEFAULT_SENDER = "DISC360 <notifications@disc360.app>";
/** Resend's shared test sender: delivers, but only in a limited test mode. */
const SHARED_SENDER = "onboarding@resend.dev";

export function readEmailReadiness(env: NodeJS.ProcessEnv = process.env): EmailReadiness {
  const hasKey = Boolean(env.RESEND_API_KEY?.trim());
  const sender = env.EMAIL_FROM?.trim() || DEFAULT_SENDER;
  const hasReplyTo = Boolean(env.EMAIL_REPLY_TO?.trim());
  const production = env.NODE_ENV === "production";

  const missing: string[] = [];
  if (!hasKey) missing.push("RESEND_API_KEY");
  if (!env.EMAIL_FROM?.trim()) missing.push("EMAIL_FROM");
  // Not required to deliver, but a message nobody can reply to is a support
  // problem rather than a delivery one, so it is listed as outstanding.
  if (!hasReplyTo) missing.push("EMAIL_REPLY_TO");

  return {
    hasKey,
    sender,
    hasReplyTo,
    usingSharedSender: sender.includes(SHARED_SENDER),
    restrictsRecipients: hasKey && !production,
    missing,
  };
}

/** One sentence for an administrator, naming the consequence and the fix. */
export function describeEmailReadiness(readiness: EmailReadiness): string {
  if (!readiness.hasKey) {
    return (
      "No email provider is configured, so every message is recorded here and none is " +
      "delivered. Participants are told their report was not sent. Set RESEND_API_KEY to " +
      "start sending."
    );
  }
  if (readiness.restrictsRecipients) {
    return (
      "A provider key is set, but this is not the production deployment, so only known " +
      "development addresses receive mail. Everything else is recorded and not delivered."
    );
  }
  if (readiness.usingSharedSender) {
    return (
      "Sending through Resend's shared test address. Delivery is limited until a domain is " +
      "verified in Resend and EMAIL_FROM is set to an address on it."
    );
  }
  return "Email is configured and messages are being delivered through the provider.";
}
