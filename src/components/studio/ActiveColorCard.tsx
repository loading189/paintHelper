import type { Paint, PaintingTarget } from '../../types/models';
import { MixStatusChip } from './MixStatusChip';

export const ActiveColorCard = ({
  target,
  paints,
  onStatusChange,
  onOpenPrep,
  onDuplicate,
}: {
  target: PaintingTarget;
  paints: Paint[];
  onStatusChange: (status: PaintingTarget['mixStatus']) => void;
  onOpenPrep: () => void;
  onDuplicate: () => void;
}) => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint.name]));
  const recipe = target.recipe;

  return (
    <article className="active-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="studio-eyebrow">{target.role} target</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-strong)]">{target.name}</h3>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">{target.hex}</p>
        </div>
        <MixStatusChip status={target.mixStatus} />
      </div>
      <div className="active-swatch mt-5" style={{ backgroundColor: target.hex }} />
      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr),280px]">
        <div>
          <p className="studio-eyebrow">Practical ratio</p>
          <p className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-[color:var(--text-strong)]">{recipe?.practicalRatioText ?? 'Pending'}</p>
          <ul className="mt-4 space-y-2 text-sm text-[color:var(--text-body)]">
            {recipe?.components.map((component) => (
              <li key={component.paintId} className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] px-4 py-3">
                {paintMap.get(component.paintId) ?? component.paintId} · {component.percentage}%
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          <div className="studio-panel-block">
            <p className="studio-eyebrow">Next adjustment</p>
            <p className="mt-3 text-sm leading-6 text-[color:var(--text-body)]">{recipe?.nextAdjustments?.[0] ?? 'Generate a prep recipe to surface adjustment guidance.'}</p>
          </div>
          <div className="studio-panel-block">
            <p className="studio-eyebrow">Mix path</p>
            <p className="mt-3 text-sm leading-6 text-[color:var(--text-body)]">{recipe?.mixPath?.[0]?.title ?? recipe?.mixStrategy?.[0] ?? 'No mix path yet.'}</p>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {(['not-mixed', 'mixed', 'adjusted', 'remix-needed'] as const).map((status) => (
          <button key={status} className="studio-button studio-button-secondary" type="button" onClick={() => onStatusChange(status)}>
            {status.replace('-', ' ')}
          </button>
        ))}
        <button className="studio-button studio-button-secondary" type="button" onClick={onOpenPrep}>Open in prep</button>
        <button className="studio-button studio-button-secondary" type="button" onClick={onDuplicate}>Duplicate</button>
      </div>
    </article>
  );
};
