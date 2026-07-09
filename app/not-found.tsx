import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { PageContainer } from "@/components/layout/PageContainer";
import { GlowPulse } from "@/components/motion/GlowPulse";
import { LinkButton } from "@/components/ui/LinkButton";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="relative flex flex-1 items-center overflow-hidden">
        <div aria-hidden className="atlas-grid absolute inset-0" />
        <GlowPulse className="left-1/2 top-1/3 -translate-x-1/2" size={520} />
        <PageContainer className="relative flex flex-col items-center gap-6 py-28 text-center">
          <span className="font-mono text-sm tracking-[0.2em] text-ink-muted">
            404
          </span>
          <h1 className="max-w-lg font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            This coordinate isn&rsquo;t on the map.
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-ink-secondary">
            The page you&rsquo;re looking for doesn&rsquo;t exist — or the
            session and report it pointed to has moved on.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <LinkButton href="/">Back to home</LinkButton>
            <LinkButton href="/assessment" variant="outline">
              Take the assessment
            </LinkButton>
          </div>
        </PageContainer>
      </main>
      <SiteFooter />
    </>
  );
}
