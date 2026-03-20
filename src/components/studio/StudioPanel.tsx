import type { HTMLAttributes, PropsWithChildren } from 'react';

type StudioPanelProps = PropsWithChildren<{
  title?: string;
  eyebrow?: string;
  description?: string;
  tone?: 'default' | 'strong' | 'muted';
  className?: string;
}> & HTMLAttributes<HTMLElement>;

export const StudioPanel = ({ children, title, eyebrow, description, tone = 'default', className = '', ...rest }: StudioPanelProps) => (
  <section className={`studio-surface studio-surface-${tone} ${className}`.trim()} {...rest}>
    {eyebrow || title || description ? (
      <header className="mb-5">
        {eyebrow ? <p className="studio-eyebrow">{eyebrow}</p> : null}
        {title ? <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">{title}</h2> : null}
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">{description}</p> : null}
      </header>
    ) : null}
    {children}
  </section>
);
