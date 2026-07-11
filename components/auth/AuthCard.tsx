interface AuthCardProps {
  title: string;
  lead?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthCard({ title, lead, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-md">
      <div className="paper-card flex flex-col gap-6 p-8 sm:p-10">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-h3 font-semibold">{title}</h1>
          {lead ? <p className="text-sm leading-relaxed text-slate">{lead}</p> : null}
        </div>
        {children}
      </div>
      {footer ? (
        <div className="pt-5 text-center text-sm text-slate">{footer}</div>
      ) : null}
    </div>
  );
}
