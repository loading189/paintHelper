import type { HTMLAttributes, PropsWithChildren } from 'react';

type CardProps = PropsWithChildren<{
  className?: string;
}> &
  HTMLAttributes<HTMLElement>;

export const Card = ({ children, className = '', ...rest }: CardProps) => (
  <section
    className={`studio-card ${className}`.trim()}
    {...rest}
  >
    {children}
  </section>
);