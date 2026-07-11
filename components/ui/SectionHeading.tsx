import { cn } from "@/lib/utils/cn";
import { Eyebrow } from "@/components/ui/Eyebrow";

interface SectionHeadingProps {
  eyebrow?: string;
  index?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  index,
  title,
  description,
  align = "left",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow ? <Eyebrow index={index}>{eyebrow}</Eyebrow> : null}
      <h2 className="max-w-3xl font-display text-h2 font-semibold text-balance">
        {title}
      </h2>
      {description ? (
        <p className="max-w-xl text-lead text-slate text-pretty">
          {description}
        </p>
      ) : null}
    </div>
  );
}
