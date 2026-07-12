import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { BrandMark } from "@/components/marketing/BrandMark";
import { AdminNav } from "@/components/admin/AdminNav";
import { signOut } from "@/lib/actions/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireSuperAdmin();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-hairline bg-canvas">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-4">
            <BrandMark />
            <span className="rounded-full bg-ink px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-mineral">
              Platform admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/app" className="text-sm text-slate hover:text-ink">
              Return to DISC360
            </Link>
            <span className="hidden font-mono text-xs text-faint sm:inline">
              {profile.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-full border border-hairline px-4 py-2 text-sm text-slate transition-colors hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[180px_1fr]">
        <aside>
          <AdminNav />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
