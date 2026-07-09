import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "ghost" | "outline";
export type ButtonSize = "md" | "lg";

export const buttonClasses = (
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold tracking-tight transition-all duration-200 ease-[var(--ease-atlas)] select-none",
    "disabled:pointer-events-none disabled:opacity-40",
    size === "md" && "px-6 py-2.5 text-sm",
    size === "lg" && "px-8 py-3.5 text-base",
    variant === "primary" &&
      "accent-gradient text-midnight-950 shadow-[0_8px_32px_-8px_rgba(79,227,193,0.45)] hover:shadow-[0_12px_40px_-8px_rgba(79,227,193,0.6)] hover:brightness-110 active:scale-[0.98]",
    variant === "ghost" &&
      "text-ink-secondary hover:text-ink hover:bg-white/5 active:scale-[0.98]",
    variant === "outline" &&
      "border border-line-strong text-ink hover:border-accent/60 hover:bg-accent/5 active:scale-[0.98]",
    className,
  );

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
}
