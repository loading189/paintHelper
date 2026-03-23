import type { MixPathStep } from '../types/models';

export const MixPathBlock = ({
  steps,
  warnings,
  layeringSuggestion,
}: {
  steps: MixPathStep[];
  warnings?: string[];
  layeringSuggestion?: string;
}) => {
  if (steps.length === 0 && !warnings?.length && !layeringSuggestion) {
    return null;
  }

  return (
    <section className="studio-block">
      <div className="studio-block-header">
        <p className="studio-kicker">Mix path</p>
      </div>

      {steps.length ? (
        <div className="studio-step-list">
          {steps.map((step, index) => {
            const title =
              step.role?.replace('-', ' ') ?? step.title ?? `Step ${index + 1}`;
            const detail = step.instruction ?? step.detail ?? '';
            const key = `${step.paintName ?? step.title ?? 'step'}-${index}`;

            return (
              <div key={key} className="studio-step-row">
                <div className="studio-step-index">{index + 1}</div>
                <div className="studio-step-content">
                  <p className="studio-step-title">{title}</p>
                  <p className="studio-step-detail">{detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {warnings?.length ? (
        <div className="studio-inline-tags">
          {warnings.map((warning) => (
            <span key={warning} className="studio-tag studio-tag-warm">
              {warning}
            </span>
          ))}
        </div>
      ) : null}

      {layeringSuggestion ? (
        <div className="studio-note">
          <span className="studio-note-label">Layering note</span>
          <p className="studio-note-copy">{layeringSuggestion}</p>
        </div>
      ) : null}
    </section>
  );
};