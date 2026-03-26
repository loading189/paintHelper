import type { ReactNode } from 'react';
import type { PaintingSession } from '../types/models';
import { SectionTitle } from './SectionTitle';
import styles from './SessionHeader.module.css';

export const SessionHeader = ({
  session,
  summary,
  actions,
}: {
  session: PaintingSession;
  summary: Array<{ label: string; value: string | number; note: string }>;
  actions?: ReactNode;
}) => (
  <div className={styles.layout}>
    <div>
      <SectionTitle
        eyebrow="Painting session"
        description={
          session.subject
            ? `Subject: ${session.subject}`
            : 'Build, prepare, and paint from a saved project.'
        }
      >
        {session.title}
      </SectionTitle>

      <div className={styles.badges}>
        <span className={`${styles.badge} ${styles.badgePrimary}`}>{session.status}</span>
        {session.lightingNotes ? <span className={styles.badge}>Lighting noted</span> : null}
        {session.canvasNotes ? <span className={styles.badge}>Canvas noted</span> : null}
      </div>
    </div>

    <div className={styles.summary}>
      {summary.map((item) => (
        <div key={item.label} className={styles.summaryItem}>
          <p className="studio-kicker">{item.label}</p>
          <p className={styles.summaryValue}>{item.value}</p>
          <p className={styles.summaryNote}>{item.note}</p>
        </div>
      ))}
      {actions}
    </div>
  </div>
);
