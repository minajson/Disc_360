import { GlowPulse } from "@/components/motion/GlowPulse";

interface DimensionalHeroProps {
  children: React.ReactNode;
  /** Ambient glow layout preset. */
  glow?: "hero" | "centered";
}

/**
 * Dimensional backdrop for hero-grade sections: blueprint grid plus ambient
 * glows behind relatively-positioned content. Motion-ready swap point —
 * internals may become a 3D scene while the wrapper contract stays stable.
 */
export function DimensionalHero({ children, glow = "hero" }: DimensionalHeroProps) {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="atlas-grid absolute inset-0" />
      {glow === "hero" ? (
        <>
          <GlowPulse className="-top-40 left-1/2 -translate-x-1/2" size={720} />
          <GlowPulse
            className="top-1/3 -right-48"
            color="var(--color-accent-alt)"
            size={520}
          />
        </>
      ) : (
        <GlowPulse className="-top-48 left-1/2 -translate-x-1/2" size={640} />
      )}
      {children}
    </section>
  );
}
