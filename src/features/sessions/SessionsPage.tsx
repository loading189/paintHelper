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
  <div className="space-y-6">
    <StudioPanel
      tone="strong"
      eyebrow="Projects"
      title="Painting projects"
      description="Manage local-only projects, reopen saved reference-led palettes, and jump straight back into Prep or Paint."
    >
      <div className="flex flex-wrap gap-3">
        <button className="studio-button studio-button-primary" type="button" onClick={onCreate}>Create project</button>
        <div className="studio-mini-stat"><span>Projects</span><strong>{sessions.length}</strong></div>
      </div>
    </StudioPanel>
    <div className="session-grid">
      {sessions.map((session) => (
        <button key={session.id} type="button" className={`session-card ${currentSessionId === session.id ? 'session-card-active' : ''}`} onClick={() => onSelect(session.id)}>
          <p className="studio-eyebrow">{session.status}</p>
          <h3 className="mt-2 text-xl font-semibold text-[color:var(--text-strong)]">{session.title}</h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">{session.notes ?? 'No project notes yet.'}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-[color:var(--text-subtle)]">
            <span>{session.targets.length} selected colors</span>
            <span>{session.extractedCandidatePalette.length + session.sampledColors.length} candidates</span>
            <span>Updated {new Date(session.updatedAt).toLocaleDateString()}</span>
          </div>
        </button>
      ))}
    </div>
  </div>
);
