import type { PropsWithChildren } from 'react';

type SectionTitleProps = PropsWithChildren<{
  eyebrow?: string;
  description?: string;
  className?: string;
}>;

export const SectionTitle = ({
  children,
  eyebrow,
  description,
  className = '',
}: SectionTitleProps) => (
  <div className={`studio-section-title ${className}`.trim()}>
    {eyebrow ? <p className="studio-kicker">{eyebrow}</p> : null}
    <h2 className="studio-section-heading">{children}</h2>
    {description ? (
      <p className="studio-section-description">{description}</p>
    ) : null}
  </div>
);