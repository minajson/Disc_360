import { LinkButton } from "@/components/ui/LinkButton";

interface CtaBandProps {
  title: string;
  lead?: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}

export function CtaBand({ title, lead, primary, secondary }: CtaBandProps) {
  return (
    <section className="rule-t bg-sand/60">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-6 px-5 py-20 text-center sm:px-8">
        <h2 className="max-w-2xl font-display text-h2 font-semibold text-balance">
          {title}
        </h2>
        {lead ? <p className="max-w-xl text-lead text-slate">{lead}</p> : null}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <LinkButton href={primary.href} size="lg">
            {primary.label}
          </LinkButton>
          {secondary ? (
            <LinkButton href={secondary.href} size="lg" variant="outline">
              {secondary.label}
            </LinkButton>
          ) : null}
        </div>
      </div>
    </section>
  );
}
