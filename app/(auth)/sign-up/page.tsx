import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getOAuthProviderStatus } from "@/lib/auth/oauth-providers";
import { AuthCard } from "@/components/auth/AuthCard";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { SignUpForm } from "@/components/auth/SignUpForm";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  const providers = getOAuthProviderStatus();

  return (
    <AuthCard
      title="Create your account"
      lead="Your profile is free — the assessment takes about seven minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-botanical hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Suspense>
        <OAuthButtons providers={providers} />
      </Suspense>
      <Suspense>
        <SignUpForm />
      </Suspense>
    </AuthCard>
  );
}
