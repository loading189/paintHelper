import type { AdjustmentSuggestion } from '../types/models';

export const NextAdjustmentBlock = ({ adjustments, title = 'Next adjustments' }: { adjustments: AdjustmentSuggestion[]; title?: string }) => {
  if (adjustments.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[28px] border border-[rgba(84,111,88,0.16)] bg-[rgba(84,111,88,0.08)] p-4">
      <p className="studio-eyebrow">{title}</p>
      <div className="mt-3 space-y-2.5">
        {adjustments.map((adjustment) => (
          <div key={`${adjustment.priority}-${adjustment.detail}`} className="rounded-[20px] border border-[rgba(84,111,88,0.14)] bg-[rgba(251,248,243,0.78)] px-4 py-3 text-sm text-[color:var(--text-body)]">
            <p className="font-semibold text-[color:var(--text-strong)]">{adjustment.priority} · {adjustment.label}</p>
            <p className="mt-1 leading-6">{adjustment.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
