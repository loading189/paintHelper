import type { AdjustmentSuggestion } from '../types/models';

export const NextAdjustmentBlock = ({
  adjustments,
  title = 'Next adjustments',
}: {
  adjustments: AdjustmentSuggestion[];
  title?: string;
}) => {
  if (adjustments.length === 0) {
    return null;
  }

  return (
    <section className="studio-block studio-block-tinted">
      <div className="studio-block-header">
        <p className="studio-kicker">{title}</p>
      </div>

      <div className="studio-adjustment-list">
        {adjustments.map((adjustment, index) => (
          <div
            key={`${adjustment.priority}-${adjustment.detail}-${index}`}
            className="studio-adjustment-row"
          >
            <div className="studio-adjustment-meta">
              <span className="studio-adjustment-priority">
                {adjustment.priority}
              </span>
              <span className="studio-adjustment-label">
                {adjustment.label}
              </span>
            </div>
            <p className="studio-adjustment-detail">{adjustment.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
};