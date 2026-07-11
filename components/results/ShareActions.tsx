"use client";

import { useState } from "react";
import { LinkButton } from "@/components/ui/LinkButton";

export function ShareActions() {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Clipboard unavailable (permissions/insecure context) — no-op.
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-full accent-gradient px-6 py-2.5 font-display text-sm font-semibold text-midnight-950 shadow-[0_8px_32px_-8px_rgba(79,227,193,0.45)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
      >
        <svg
          viewBox="0 0 20 20"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 3v9M6.5 8.5 10 12l3.5-3.5" />
          <path d="M4 14.5V16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.5" />
        </svg>
        Download report
      </button>
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-2 rounded-full border border-line-strong px-6 py-2.5 font-display text-sm font-semibold text-ink transition-all duration-200 hover:border-accent/60 hover:bg-accent/5"
      >
        <svg
          viewBox="0 0 20 20"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8.5 11.5 11.5 8.5" />
          <path d="M7 13 5.5 14.5a2.83 2.83 0 0 1-4-4L5 7a2.83 2.83 0 0 1 4 0" />
          <path d="M13 7l1.5-1.5a2.83 2.83 0 0 1 4 4L15 13a2.83 2.83 0 0 1-4 0" />
        </svg>
        {copied ? "Link copied" : "Copy report link"}
      </button>
      <LinkButton href="/dashboard" variant="outline">
        View dashboard
      </LinkButton>
      <LinkButton href="/assessment" variant="ghost">
        Retake assessment
      </LinkButton>
    </div>
  );
}
