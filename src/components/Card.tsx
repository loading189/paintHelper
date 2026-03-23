import type { HTMLAttributes, PropsWithChildren } from 'react';

type CardProps = PropsWithChildren<{
  className?: string;
}> &
  HTMLAttributes<HTMLElement>;

export const Card = ({ children, className = '', ...rest }: CardProps) => (
  <section
    className={`studio-card rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)]/95 p-6 shadow-[var(--shadow-soft)] backdrop-blur-sm sm:p-7 ${className}`.trim()}
    {...rest}
  >
    <div className="studio-card__inner">{children}</div>
  </section>
);
