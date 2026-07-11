import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "outline" | "ghost" | "ink";
export type ButtonSize = "md" | "lg";

export const buttonClasses = (
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition-all duration-200 ease-[var(--ease-meridian)] select-none",
    "disabled:pointer-events-none disabled:opacity-40",
    size === "md" && "min-h-11 px-6 text-sm",
    size === "lg" && "min-h-13 px-8 text-base",
    variant === "primary" &&
      "bg-botanical text-mineral shadow-[0_12px_24px_-14px_rgba(23,76,60,0.7)] hover:bg-botanical-deep active:scale-[0.99]",
    variant === "outline" &&
      "border border-hairline-strong bg-paper/60 text-ink hover:border-botanical hover:text-botanical active:scale-[0.99]",
    variant === "ghost" && "text-slate hover:bg-ink/5 hover:text-ink",
    variant === "ink" &&
      "bg-ink text-mineral hover:bg-ink/90 active:scale-[0.99]",
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
