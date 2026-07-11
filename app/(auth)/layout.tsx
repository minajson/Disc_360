import Link from "next/link";
import { BrandMark } from "@/components/marketing/BrandMark";
import { AssessmentTransitionScene } from "@/components/media/AssessmentTransitionScene";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <AssessmentTransitionScene />
      <header className="relative z-10 mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <BrandMark />
        <Link href="/" className="text-sm text-slate transition-colors hover:text-ink">
          Back to site
        </Link>
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-12">
        {children}
      </main>
      <footer className="relative z-10 pb-8 text-center font-mono text-[11px] text-faint">
        DISC360 · a development tool, not a diagnostic instrument
      </footer>
    </div>
  );
}
