import { useMemo } from 'react';
import { StudioPanel } from '../../components/studio/StudioPanel';
import { ActiveColorCard } from '../../components/studio/ActiveColorCard';
import type { Paint, PaintingSession } from '../../types/models';

export const ActivePaintingBoard = ({
  session,
  paints,
  onSessionChange,
  onOpenPrep,
}: {
  session: PaintingSession;
  paints: Paint[];
  onSessionChange: (session: PaintingSession) => void;
  onOpenPrep: (targetId: string) => void;
}) => {
  const activeTargets = useMemo(() => [...session.targets].sort((left, right) => Number(right.isPinned) - Number(left.isPinned) || left.sortIndex - right.sortIndex), [session.targets]);

  return (
    <div className="space-y-6">
      <StudioPanel
        tone="strong"
        eyebrow="Execution mode"
        title="Active painting dashboard"
        description="Large swatches, practical ratios, and the next move you need while the physical palette is in front of you."
      >
        <div className="flex flex-wrap gap-3">
          <div className="studio-mini-stat"><span>Session</span><strong>{session.name}</strong></div>
          <div className="studio-mini-stat"><span>Targets live</span><strong>{activeTargets.length}</strong></div>
          <div className="studio-mini-stat"><span>Mixed / adjusted</span><strong>{activeTargets.filter((target) => target.mixStatus === 'mixed' || target.mixStatus === 'adjusted').length}</strong></div>
        </div>
      </StudioPanel>

      <div className="space-y-5">
        {activeTargets.length ? activeTargets.map((target) => (
          <ActiveColorCard
            key={target.id}
            target={target}
            paints={paints}
            onStatusChange={(status) => onSessionChange({
              ...session,
              updatedAt: new Date().toISOString(),
              targets: session.targets.map((candidate) => candidate.id === target.id ? { ...candidate, mixStatus: status } : candidate),
            })}
            onOpenPrep={() => onOpenPrep(target.id)}
            onDuplicate={() => onSessionChange({
              ...session,
              updatedAt: new Date().toISOString(),
              targets: [...session.targets, { ...target, id: `${target.id}-dup-${Date.now()}`, name: `${target.name} Remix`, mixStatus: 'not-mixed', sortIndex: session.targets.length }],
            })}
          />
        )) : <div className="studio-empty-state">No active targets yet. Build them in prep mode, then start painting.</div>}
      </div>
    </div>
  );
};
