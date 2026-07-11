"use server";

import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(2, "Please tell us your name").max(120),
  email: z.string().email("Please use a valid email address"),
  topic: z.enum(["teams", "coaching", "enterprise", "support", "other"]),
  message: z.string().min(10, "A sentence or two helps us route this").max(4000),
});

export interface ContactFormState {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<"name" | "email" | "topic" | "message", string>>;
}

const INBOX_FILE = path.join(process.cwd(), ".contact-inbox.jsonl");

/**
 * Receives contact messages. In development they land in a local inbox file
 * (git-ignored); Phase 6 routes them into notification_logs + email.
 */
export async function submitContact(
  _previous: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    topic: formData.get("topic"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    const fieldErrors: ContactFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof NonNullable<ContactFormState["fieldErrors"]>;
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const record = { ...parsed.data, receivedAt: new Date().toISOString() };
  try {
    await fs.appendFile(INBOX_FILE, JSON.stringify(record) + "\n", "utf8");
  } catch (error) {
    console.error("[contact] failed to persist message", error);
    return {
      status: "error",
      message: "Something went wrong on our side — please email hello@disc360.app directly.",
    };
  }

  return {
    status: "success",
    message: "Thank you — we read every message and reply within two business days.",
  };
}
