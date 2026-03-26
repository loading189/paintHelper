import styles from './SwatchTile.module.css';

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
      className={`${styles.tile} ${isHero ? styles.tileHero : styles.tileDefault}`}
      data-testid={testId}
    >
      <div className={styles.tileHeader}>
        <div>
          <p className="studio-kicker">{label}</p>
          <p className={`${styles.hex} ${isHero ? styles.hexHero : styles.hexDefault}`}>
            {hex}
          </p>
        </div>

        {helper ? (
          <span className={styles.helper}>
            {helper}
          </span>
        ) : null}
      </div>

      <div className={styles.swatchFrame}>
        <div
          className={`${styles.swatch} ${isHero ? styles.swatchHero : styles.swatchDefault}`}
          style={{ backgroundColor: hex }}
        />
      </div>

      {footer ? (
        <p className={styles.footer}>
          {footer}
        </p>
      ) : null}
    </div>
  );
};
