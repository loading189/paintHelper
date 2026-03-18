import type { PropsWithChildren } from 'react';

type SectionTitleProps = PropsWithChildren<{
  eyebrow?: string;
  description?: string;
  className?: string;
}>;

export const SectionTitle = ({ children, eyebrow, description, className = '' }: SectionTitleProps) => (
  <div className={className}>
    {eyebrow ? <p className="studio-eyebrow">{eyebrow}</p> : null}
    <h2 className="text-[1.15rem] font-semibold tracking-[-0.02em] text-[color:var(--text-strong)] sm:text-[1.28rem]">{children}</h2>
    {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">{description}</p> : null}
  </div>
);
