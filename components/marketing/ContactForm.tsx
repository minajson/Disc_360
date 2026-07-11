"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import {
  submitContact,
  type ContactFormState,
} from "@/lib/actions/contact";

const initialState: ContactFormState = { status: "idle", message: "" };

const inputClasses =
  "w-full rounded-xl border border-hairline bg-paper px-4 py-3 text-sm text-ink placeholder:text-faint focus:border-botanical focus:outline-none";

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={id} role="alert" className="text-xs text-disc-d">
      {error}
    </p>
  );
}

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, initialState);

  if (state.status === "success") {
    return (
      <div className="paper-card flex flex-col items-center gap-3 p-10 text-center" role="status">
        <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="var(--color-botanical)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.5 11 15.5 16.5 9" />
        </svg>
        <p className="max-w-sm text-sm leading-relaxed text-slate">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="paper-card flex flex-col gap-5 p-8" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-name" className="text-sm font-medium text-ink">
            Name
          </label>
          <input
            id="contact-name"
            name="name"
            autoComplete="name"
            required
            aria-describedby="contact-name-error"
            className={cn(inputClasses, state.fieldErrors?.name && "border-disc-d")}
          />
          <FieldError id="contact-name-error" error={state.fieldErrors?.name} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-email" className="text-sm font-medium text-ink">
            Work email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-describedby="contact-email-error"
            className={cn(inputClasses, state.fieldErrors?.email && "border-disc-d")}
          />
          <FieldError id="contact-email-error" error={state.fieldErrors?.email} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-topic" className="text-sm font-medium text-ink">
          What is this about?
        </label>
        <select id="contact-topic" name="topic" className={inputClasses} defaultValue="teams">
          <option value="teams">Bringing DISC360 to my team</option>
          <option value="coaching">Coaching and consulting</option>
          <option value="enterprise">Enterprise and organizations</option>
          <option value="support">Product support</option>
          <option value="other">Something else</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-message" className="text-sm font-medium text-ink">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          required
          aria-describedby="contact-message-error"
          className={cn(inputClasses, "resize-y", state.fieldErrors?.message && "border-disc-d")}
        />
        <FieldError id="contact-message-error" error={state.fieldErrors?.message} />
      </div>

      {state.status === "error" && !state.fieldErrors ? (
        <p role="alert" className="text-sm text-disc-d">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
