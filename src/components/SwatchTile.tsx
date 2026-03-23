type SwatchTileProps = {
  label: string;
  hex: string;
  helper?: string;
  emphasis?: 'default' | 'hero';
  footer?: string;
  testId?: string;
};

export const SwatchTile = ({
  label,
  hex,
  helper,
  emphasis = 'default',
  footer,
  testId,
}: SwatchTileProps) => {
  const isHero = emphasis === 'hero';

  return (
    <div
      className={`rounded-[16px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)]/88 p-4 ${
        isHero ? 'min-h-[250px]' : 'min-h-[190px]'
      }`}
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="studio-kicker">{label}</p>
          <p
            className={`mt-1.5 font-semibold tracking-[-0.05em] text-[color:var(--text-strong)] ${
              isHero ? 'text-[1.35rem] sm:text-[1.5rem]' : 'text-[1rem]'
            }`}
          >
            {hex}
          </p>
        </div>

        {helper ? (
          <span className="inline-flex h-7 items-center rounded-[9px] border border-[color:var(--border-soft)] px-2.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
            {helper}
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-[12px] border border-[color:var(--border-soft)] bg-[color:var(--surface-inset)] p-2.5">
        <div
          className={`rounded-[10px] border border-black/10 ${
            isHero ? 'h-44 sm:h-52' : 'h-28 sm:h-32'
          }`}
          style={{ backgroundColor: hex }}
        />
      </div>

      {footer ? (
        <p className="mt-3 text-[0.82rem] leading-6 text-[color:var(--text-muted)]">
          {footer}
        </p>
      ) : null}
    </div>
  );
};