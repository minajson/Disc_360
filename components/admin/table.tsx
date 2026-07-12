import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/** Shared admin table chrome: search box, sortable headers, pager. */

export function AdminSearch({
  placeholder,
  defaultValue,
  extra,
}: {
  placeholder: string;
  defaultValue?: string;
  extra?: React.ReactNode;
}) {
  return (
    <form method="get" className="flex flex-wrap items-center gap-3">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label="Search"
        className="w-64 rounded-full border border-hairline bg-paper px-4 py-2 text-sm text-ink placeholder:text-faint focus:border-botanical focus:outline-none"
      />
      {extra}
      <button
        type="submit"
        className="rounded-full border border-hairline px-4 py-2 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical"
      >
        Search
      </button>
    </form>
  );
}

export function SortHeader({
  basePath,
  params,
  field,
  label,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  field: string;
  label: string;
}) {
  const active = params.sort === field;
  const nextDir = active && params.dir === "asc" ? "desc" : "asc";
  const query = new URLSearchParams(
    Object.entries({ ...params, sort: field, dir: nextDir, page: "1" }).filter(
      (entry): entry is [string, string] => Boolean(entry[1]),
    ),
  );
  return (
    <Link
      href={`${basePath}?${query.toString()}`}
      className={cn(
        "inline-flex items-center gap-1 hover:text-ink",
        active ? "text-ink" : "text-faint",
      )}
    >
      {label}
      {active ? <span aria-hidden>{params.dir === "asc" ? "↑" : "↓"}</span> : null}
    </Link>
  );
}

export function Pager({
  basePath,
  params,
  page,
  pageCount,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const link = (target: number) => {
    const query = new URLSearchParams(
      Object.entries({ ...params, page: String(target) }).filter(
        (entry): entry is [string, string] => Boolean(entry[1]),
      ),
    );
    return `${basePath}?${query.toString()}`;
  };
  return (
    <nav aria-label="Pagination" className="flex items-center gap-3 pt-2">
      {page > 1 ? (
        <Link href={link(page - 1)} className="text-sm text-slate hover:text-ink">
          ← Previous
        </Link>
      ) : null}
      <span className="font-mono text-xs text-faint">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={link(page + 1)} className="text-sm text-slate hover:text-ink">
          Next →
        </Link>
      ) : null}
    </nav>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red" | "blue" | "neutral";
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    green: "bg-disc-s-soft text-disc-s",
    amber: "bg-disc-i-soft text-disc-i",
    red: "bg-disc-d-soft text-disc-d",
    blue: "bg-disc-c-soft text-disc-c",
    neutral: "bg-ink/5 text-slate",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
        styles[tone],
      )}
    >
      {children}
    </span>
  );
}
