type SwatchTileProps = {
  label: string;
  hex: string;
  helper?: string;
  emphasis?: 'default' | 'hero';
  footer?: string;
  testId?: string;
};

export const SwatchTile = ({ label, hex, helper, emphasis = 'default', footer, testId }: SwatchTileProps) => {
  const isHero = emphasis === 'hero';

  return (
    <div
      className={`swatch-tile rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)]/96 p-4 sm:p-5 ${
        isHero ? 'min-h-[300px] shadow-[inset_0_1px_0_rgba(255,255,255,0.32)]' : 'min-h-[220px]'
      }`}
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="studio-eyebrow">{label}</p>
          <p className={`mt-2 font-semibold tracking-[-0.03em] text-[color:var(--text-strong)] ${isHero ? 'text-[1.5rem] sm:text-[1.7rem]' : 'text-lg'}`}>{hex}</p>
        </div>
        {helper ? <span className="studio-chip">{helper}</span> : null}
      </div>
      <div className={`swatch-well mt-4 rounded-[24px] border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] ${isHero ? 'p-3 sm:p-4' : 'p-3'}`}>
        <div className={`rounded-[18px] border border-black/10 ${isHero ? 'h-52 sm:h-60' : 'h-36 sm:h-40'}`} style={{ backgroundColor: hex }} />
      </div>
      {footer ? <p className="mt-4 text-sm leading-6 text-[color:var(--text-muted)]">{footer}</p> : null}
    </div>
  );
};
