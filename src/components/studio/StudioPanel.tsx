import type { HTMLAttributes, PropsWithChildren } from 'react';
import styles from './StudioPanel.module.css';

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
      <header className={styles.header}>
        {eyebrow ? <p className="studio-eyebrow">{eyebrow}</p> : null}
        {title ? <h2 className={styles.title}>{title}</h2> : null}
        {description ? <p className={styles.description}>{description}</p> : null}
      </header>
    ) : null}
    {children}
  </section>
);
