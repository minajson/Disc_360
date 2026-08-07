import { cn } from "@/lib/utils/cn";
import { REPORT_BUTTON } from "@/components/report/styles";

/**
 * Downloads the participant's own report. A plain anchor, so it works before
 * hydration and on a phone with a flaky connection: the route handler
 * authorizes, renders and names the file server-side.
 */
export function DownloadPdfLink({
  href,
  className,
  label = "Download PDF",
}: {
  href: string;
  className?: string;
  label?: string;
}) {
  return (
    <a href={href} download className={cn(REPORT_BUTTON, className)}>
      <svg
        viewBox="0 0 20 20"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M10 3v9M6.5 8.5 10 12l3.5-3.5" />
        <path d="M4 14.5V16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.5" />
      </svg>
      {label}
    </a>
  );
}
