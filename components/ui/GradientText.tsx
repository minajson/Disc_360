import { cn } from "@/lib/utils/cn";

export function GradientText({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("accent-gradient-text", className)} {...props} />;
}
