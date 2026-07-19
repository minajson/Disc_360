"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

export const authInputClasses =
  "w-full rounded-xl border border-hairline bg-paper px-4 py-3 text-sm text-ink placeholder:text-faint focus:border-botanical focus:outline-none";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  error?: string;
}

export function TextField({ label, id, error, className, ...props }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(authInputClasses, error && "border-disc-d", className)}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-disc-d">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type PasswordFieldProps = Omit<TextFieldProps, "type">;

/**
 * Password input with an accessible show/hide toggle.
 *
 * The toggle is a real button (keyboard reachable, 44px touch target,
 * aria-pressed + a state-specific label) positioned inside the field. Only the
 * input's `type` flips — name, id and autocomplete are untouched, so password
 * managers keep working exactly as before.
 */
export function PasswordField({ label, id, error, className, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(authInputClasses, "pr-12", error && "border-disc-d", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate transition-colors hover:text-ink focus-visible:text-botanical"
        >
          {visible ? (
            /* eye-off */
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c7 0 10 7 10 7a17.2 17.2 0 0 1-2.2 3.2M6.6 6.6C3.8 8.4 2 12 2 12s3 7 10 7a9.9 9.9 0 0 0 5.4-1.6" />
              <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              <path d="m3 3 18 18" />
            </svg>
          ) : (
            /* eye */
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-disc-d">
          {error}
        </p>
      ) : null}
    </div>
  );
}
