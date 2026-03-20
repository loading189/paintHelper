import { analyzeColor } from '../../lib/color/colorAnalysis';
import type { PaintingTarget } from '../../types/models';
import { MixStatusChip } from './MixStatusChip';

export const TargetCard = ({
  target,
  selected,
  onSelect,
  onTogglePin,
}: {
  target: PaintingTarget;
  selected?: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
}) => {
  const analysis = analyzeColor(target.hex);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`target-card text-left ${selected ? 'target-card-selected' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="studio-eyebrow">{target.role}</p>
          <h3 className="mt-2 text-lg font-semibold text-[color:var(--text-strong)]">{target.name}</h3>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">{target.hex} · {analysis?.hueFamily ?? 'neutral'} · {analysis?.valueClassification ?? 'mid'}</p>
        </div>
        <button type="button" className="studio-icon-button" onClick={(event) => { event.stopPropagation(); onTogglePin(); }} aria-label="Toggle pin">
          {target.isPinned ? '★' : '☆'}
        </button>
      </div>
      <div className="target-swatch mt-4" style={{ backgroundColor: target.hex }} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <MixStatusChip status={target.mixStatus} />
        {target.recipe?.practicalRatioText ? <span className="studio-chip studio-chip-info">{target.recipe.practicalRatioText}</span> : <span className="studio-chip">Recipe pending</span>}
        {target.familyGroup ? <span className="studio-chip">Family set</span> : null}
      </div>
    </button>
  );
};
