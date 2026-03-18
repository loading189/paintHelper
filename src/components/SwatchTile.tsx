type SwatchTileProps = {
  label: string;
  hex: string;
  helper?: string;
  emphasis?: 'default' | 'hero';
  footer?: string;
  testId?: string;
};

export const SwatchTile = ({ label, hex, helper, emphasis = 'default', footer, testId }: SwatchTileProps) => (
  <div
    className={`swatch-tile ${emphasis === 'hero' ? 'min-h-[300px]' : 'min-h-[220px]'} rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)]/96 p-4 sm:p-5`}
    data-testid={testId}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="studio-eyebrow">{label}</p>
        <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-strong)]">{hex}</p>
      </div>
      {helper ? <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">{helper}</span> : null}
    </div>
    <div className="swatch-well mt-4 rounded-[24px] border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] p-3 sm:p-4">
      <div className={`rounded-[18px] border border-black/10 ${emphasis === 'hero' ? 'h-52 sm:h-60' : 'h-36 sm:h-40'}`} style={{ backgroundColor: hex }} />
    </div>
    {footer ? <p className="mt-4 text-sm leading-6 text-[color:var(--text-muted)]">{footer}</p> : null}
  </div>
);
