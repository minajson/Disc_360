import "server-only";
import type { ReactElement } from "react";
import { createSupabaseAdminClient } from "@/lib/db/admin";

/**
 * Central email pipeline.
 * - Preference-gated per category (essential email always delivers).
 * - Without RESEND_API_KEY every message is logged, never sent (dev-safe).
 * - With a key outside production, only known dev domains receive mail —
 *   development must never email real people.
 * - Every attempt lands in notification_logs.
 */

export type EmailCategory =
  | "essential"
  | "assessment_reminders"
  | "team_updates"
  | "report_notifications"
  | "product_updates";

interface SendEmailInput {
  to: string;
  /** Profile of the recipient when known — enables preference gating + log linkage. */
  profileId?: string | null;
  template: string;
  subject: string;
  category: EmailCategory;
  react: ReactElement;
}

const DEV_SAFE_DOMAINS = ["disc360.dev", "atlasdemo.dev", "example.com"];

function isDevSafeRecipient(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return DEV_SAFE_DOMAINS.includes(domain);
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const admin = createSupabaseAdminClient();

  // Preference gate (service role: read-only preference check for the recipient).
  if (input.category !== "essential" && input.profileId) {
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("assessment_reminders, team_updates, report_notifications, product_updates")
      .eq("profile_id", input.profileId)
      .maybeSingle();
    if (prefs && prefs[input.category] === false) {
      await admin.from("notification_logs").insert({
        profile_id: input.profileId,
        email: input.to,
        template: input.template,
        subject: input.subject,
        status: "skipped",
        error: "recipient preference",
      });
      return;
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  const production = process.env.NODE_ENV === "production";

  // Dev safety: no key → log only; key in non-production → dev domains only.
  if (!apiKey || (!production && !isDevSafeRecipient(input.to))) {
    await admin.from("notification_logs").insert({
      profile_id: input.profileId ?? null,
      email: input.to,
      template: input.template,
      subject: input.subject,
      status: "logged",
      error: apiKey ? "non-production recipient guard" : null,
    });
    return;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    // Reply-To: until a DISC360 sending domain is verified, product mail goes
    // out on a shared/unbranded sender, so replies must be routed somewhere a
    // human reads. EMAIL_REPLY_TO carries that address (minajjumbo@gmail.com
    // pre-domain); once a branded domain exists it can be cleared.
    const replyTo = process.env.EMAIL_REPLY_TO?.trim();
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "DISC360 <notifications@disc360.app>",
      to: input.to,
      subject: input.subject,
      react: input.react,
      ...(replyTo ? { replyTo } : {}),
    });
    await admin.from("notification_logs").insert({
      profile_id: input.profileId ?? null,
      email: input.to,
      template: input.template,
      subject: input.subject,
      status: error ? "failed" : "sent",
      provider_id: data?.id ?? null,
      error: error?.message ?? null,
    });
  } catch (caught) {
    await admin.from("notification_logs").insert({
      profile_id: input.profileId ?? null,
      email: input.to,
      template: input.template,
      subject: input.subject,
      status: "failed",
      error: caught instanceof Error ? caught.message : "unknown send failure",
    });
  }
}
