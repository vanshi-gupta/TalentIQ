import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-accent">{eyebrow}</p>}
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.025em] text-plum-950 sm:text-[30px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-plum-700">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
