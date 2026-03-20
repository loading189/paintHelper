export const SwatchComparisonPanel = ({ targetHex, predictedHex }: { targetHex: string; predictedHex?: string }) => (
  <div className="grid gap-4 sm:grid-cols-2">
    <div className="comparison-block">
      <p className="studio-eyebrow">Target</p>
      <div className="comparison-swatch mt-3" style={{ backgroundColor: targetHex }} />
      <p className="mt-3 text-sm text-[color:var(--text-muted)]">{targetHex}</p>
    </div>
    <div className="comparison-block">
      <p className="studio-eyebrow">Predicted</p>
      <div className="comparison-swatch mt-3" style={{ backgroundColor: predictedHex ?? '#17191d' }} />
      <p className="mt-3 text-sm text-[color:var(--text-muted)]">{predictedHex ?? 'No recipe selected'}</p>
    </div>
  </div>
);
