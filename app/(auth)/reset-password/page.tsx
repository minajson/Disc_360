import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Set a new password"
      lead="Choose a new password for your account — at least 10 characters."
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
