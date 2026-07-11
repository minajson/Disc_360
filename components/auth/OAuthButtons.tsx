"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/db/browser";

const providers = [
  {
    id: "google" as const,
    label: "Continue with Google",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.2h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.2-2.1 3.7-5.1 3.7-8.7Z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.2-7-5.1l-3.9 3C3.2 21.2 7.3 24 12 24Z" />
        <path fill="#FBBC05" d="M5 14.3c-.2-.7-.4-1.5-.4-2.3 0-.8.1-1.6.4-2.3l-3.9-3A11.9 11.9 0 0 0 0 12c0 1.9.5 3.8 1.3 5.4l3.7-3.1Z" />
        <path fill="#EA4335" d="M12 4.7c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.2 0 12 0 7.3 0 3.2 2.8 1.3 6.7l3.9 3c1-2.9 3.7-5 6.8-5Z" />
      </svg>
    ),
  },
  {
    id: "azure" as const,
    label: "Continue with Microsoft",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <rect x="1" y="1" width="10.4" height="10.4" fill="#F25022" />
        <rect x="12.6" y="1" width="10.4" height="10.4" fill="#7FBA00" />
        <rect x="1" y="12.6" width="10.4" height="10.4" fill="#00A4EF" />
        <rect x="12.6" y="12.6" width="10.4" height="10.4" fill="#FFB900" />
      </svg>
    ),
  },
];

/**
 * OAuth entry points. Providers activate when credentials are configured in
 * Supabase (see .env.example); a friendly error shows otherwise.
 */
export function OAuthButtons() {
  const [error, setError] = useState<string | null>(null);

  const signInWith = async (provider: "google" | "azure") => {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        ...(provider === "azure" ? { scopes: "email openid profile" } : {}),
      },
    });
    if (oauthError) {
      setError(
        "This sign-in provider isn't configured yet — use email and password, or contact your administrator.",
      );
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => void signInWith(provider.id)}
          className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-full border border-hairline-strong bg-paper text-sm font-medium text-ink transition-colors hover:border-botanical"
        >
          {provider.icon}
          {provider.label}
        </button>
      ))}
      {error ? (
        <p role="alert" className="text-xs text-disc-d">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3 py-2" aria-hidden>
        <span className="h-px flex-1 bg-hairline" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
          or with email
        </span>
        <span className="h-px flex-1 bg-hairline" />
      </div>
    </div>
  );
}
