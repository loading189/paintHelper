import type { PaintingSession } from '../../types/models';

export const SessionHeader = ({
  session,
  onRename,
  onDescriptionChange,
  onStartPainting,
}: {
  session: PaintingSession;
  onRename: (name: string) => void;
  onDescriptionChange: (value: string) => void;
  onStartPainting: () => void;
}) => (
  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),auto] xl:items-end">
    <div className="space-y-3">
      <div>
        <p className="studio-eyebrow">Current session</p>
        <input className="studio-input studio-input-hero mt-2" value={session.name} onChange={(event) => onRename(event.target.value)} aria-label="Session name" />
      </div>
      <textarea
        className="studio-textarea min-h-28"
        value={session.description ?? ''}
        onChange={(event) => onDescriptionChange(event.target.value)}
        placeholder="Describe the painting goal, lighting situation, or substrate notes."
        aria-label="Session description"
      />
    </div>
    <div className="flex flex-col gap-3 xl:min-w-[220px]">
      <div className="studio-mini-stat">
        <span>Status</span>
        <strong>{session.status === 'active' ? 'Painting live' : 'Planning board'}</strong>
      </div>
      <div className="studio-mini-stat">
        <span>Targets</span>
        <strong>{session.targets.length}</strong>
      </div>
      <button className="studio-button studio-button-primary w-full" type="button" onClick={onStartPainting}>
        {session.status === 'active' ? 'Painting in progress' : 'Start painting mode'}
      </button>
    </div>
  </div>
);
