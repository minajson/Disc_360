import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { LinkButton } from "@/components/ui/LinkButton";

export default function NotFound() {
  return (
    <>
      <MarketingNav />
      <main className="flex flex-1 items-center">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-7 px-5 py-28 text-center sm:px-8">
          <span className="font-mono text-sm tracking-[0.22em] text-faint">
            404
          </span>
          <h1 className="max-w-xl font-display text-h1 font-semibold text-balance">
            This page isn&rsquo;t on the map.
          </h1>
          <p className="max-w-md text-lead text-slate">
            The page you&rsquo;re looking for doesn&rsquo;t exist — or has
            moved somewhere calmer.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <LinkButton href="/">Back to home</LinkButton>
            <LinkButton href="/how-it-works" variant="outline">
              How DISC360 works
            </LinkButton>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
