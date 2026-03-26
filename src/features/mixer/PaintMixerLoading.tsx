import styles from './PaintMixerLoading.module.css';

export const PaintMixerLoading = () => {
  const drops = ['#d8d0c6', '#a89581', '#6f7f89'];

  return (
    <div className={styles.shell} role="status" aria-live="polite">
      <div className={styles.row}>
        <div className={`paint-loader-orbit ${styles.orbitCenter}`} aria-hidden="true">
          <div className={styles.dropRow}>
            {drops.map((color, index) => (
              <span
                key={color}
                className={`paint-loader-drop ${styles.drop}`}
                style={{ backgroundColor: color, animationDelay: `${index * 120}ms` }}
              />
            ))}
          </div>
        </div>
        <div>
          <p className={styles.title}>Building spectral paint studies…</p>
          <p className={styles.copy}>Holding briefly so the result reads like a considered lab pass, not a twitchy refresh.</p>
        </div>
      </div>
    </div>
  );
};
