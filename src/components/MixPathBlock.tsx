import type { MixPathStep } from '../types/models';

export const MixPathBlock = ({ steps, warnings, layeringSuggestion }: { steps: MixPathStep[]; warnings?: string[]; layeringSuggestion?: string }) => {
  if (steps.length === 0 && !warnings?.length && !layeringSuggestion) {
    return null;
  }

  return (
    <section className="studio-panel studio-panel-muted">
      <p className="studio-eyebrow">Mix path</p>
      <div className="mt-4 space-y-3">
        {steps.map((step, index) => {
          const title = step.role ? step.role.replace('-', ' ') : step.title ?? 'Step';
          const detail = step.instruction ?? step.detail ?? '';
          const key = `${step.paintName ?? step.title ?? 'step'}-${index}`;
          return (
            <div key={key} className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] px-4 py-3 text-sm">
              <p className="font-semibold capitalize text-[color:var(--text-strong)]">{title}</p>
              <p className="mt-1 leading-6 text-[color:var(--text-body)]">{detail}</p>
            </div>
          );
        })}
      </div>
      {warnings?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {warnings.map((warning) => (
            <span key={warning} className="studio-chip studio-chip-warm">{warning}</span>
          ))}
        </div>
      ) : null}
      {layeringSuggestion ? <p className="mt-4 text-sm leading-6 text-[color:var(--text-muted)]">{layeringSuggestion}</p> : null}
    </section>
  );
};
