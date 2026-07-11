import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthCard
      title="Welcome back"
      lead="Sign in to your profile, teams and reports."
      footer={
        <>
          New to DISC360?{" "}
          <Link href="/sign-up" className="font-medium text-botanical hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <OAuthButtons />
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}
