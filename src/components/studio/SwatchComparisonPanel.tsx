import styles from './SwatchComparisonPanel.module.css';

export const SwatchComparisonPanel = ({ targetHex, predictedHex }: { targetHex: string; predictedHex?: string }) => (
  <div className={styles.grid}>
    <div className={styles.block}>
      <p className="studio-eyebrow">Target</p>
      <div className={styles.swatch} style={{ backgroundColor: targetHex }} />
      <p className={styles.label}>{targetHex}</p>
    </div>
    <div className={styles.block}>
      <p className="studio-eyebrow">Predicted</p>
      <div className={styles.swatch} style={{ backgroundColor: predictedHex ?? '#17191d' }} />
      <p className={styles.label}>{predictedHex ?? 'No recipe selected'}</p>
    </div>
  </div>
);
