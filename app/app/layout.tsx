import { requireOnboarded } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app/AppHeader";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireOnboarded();

  return (
    <>
      <AppHeader preferredName={profile.preferred_name || profile.full_name} />
      <main className="flex-1 bg-mineral">{children}</main>
    </>
  );
}
