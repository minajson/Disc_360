"use client";

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
