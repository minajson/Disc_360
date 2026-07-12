import { LinkButton } from "@/components/ui/LinkButton";

export function FinalConversion() {
  return (
    <section className="rule-t bg-sand/60">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-8 px-5 py-24 text-center sm:px-8 lg:py-32">
        <h2 className="max-w-3xl font-display text-h1 font-semibold text-balance">
          The next difficult conversation is coming.
          <br />
          <span className="italic text-botanical">Walk in prepared.</span>
        </h2>
        <p className="max-w-xl text-lead text-slate">
          Free personal profile. Team map for $8.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <LinkButton href="/sign-up" size="lg">
            Take the individual assessment
          </LinkButton>
          <LinkButton href="/sign-up?intent=team" size="lg" variant="outline">
            Create a team
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
