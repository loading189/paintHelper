import styles from './SessionsPage.module.css';
import { StudioPanel } from '../../components/studio/StudioPanel';
import type { PaintingSession } from '../../types/models';

export const SessionsPage = ({
  sessions,
  currentSessionId,
  onSelect,
  onCreate,
}: {
  sessions: PaintingSession[];
  currentSessionId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) => (
  <div className={styles.page}>
    <StudioPanel
      tone="strong"
      eyebrow="Projects"
      title="Painting projects"
      description="Manage local-only projects, reopen saved reference-led palettes, and jump straight back into Prep or Paint."
    >
      <div className={styles.panelActions}>
        <button className="studio-button studio-button-primary" type="button" onClick={onCreate}>Create project</button>
        <div className={styles.miniStat}><span>Projects</span><strong>{sessions.length}</strong></div>
      </div>
    </StudioPanel>
    <div className={styles.sessionGrid}>
      {sessions.map((session) => (
        <button key={session.id} type="button" className={`${styles.sessionCard} ${currentSessionId === session.id ? styles.sessionCardActive : ''}`} onClick={() => onSelect(session.id)}>
          <p className="studio-eyebrow">{session.status}</p>
          <h3 className={styles.sessionTitle}>{session.title}</h3>
          <p className={styles.sessionNotes}>{session.notes ?? 'No project notes yet.'}</p>
          <div className={styles.sessionMeta}>
            <span>{session.targets.length} selected colors</span>
            <span>{session.extractedCandidatePalette.length + session.sampledColors.length} candidates</span>
            <span>Updated {new Date(session.updatedAt).toLocaleDateString()}</span>
          </div>
        </button>
      ))}
    </div>
  </div>
);
