import { Eyebrow } from "@/components/ui/Eyebrow";

interface PageIntroProps {
  eyebrow: string;
  title: string;
  lead?: string;
  children?: React.ReactNode;
}

/** Editorial opening composition shared by marketing pages. */
export function PageIntro({ eyebrow, title, lead, children }: PageIntroProps) {
  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col items-start gap-7 px-5 pb-14 pt-16 sm:px-8 sm:pt-20">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="max-w-4xl font-display text-h1 font-semibold text-balance">
        {title}
      </h1>
      {lead ? (
        <p className="max-w-2xl text-lead text-slate text-pretty">{lead}</p>
      ) : null}
      {children}
    </section>
  );
}
